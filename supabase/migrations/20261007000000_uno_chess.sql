-- ════════════════════════════════════════════════════════════════════
-- UNO Chess — database schema
--   profiles        public player profiles (1:1 with auth.users)
--   ratings         Glicko-2 rating per time category (bullet/blitz/rapid)
--   games           finished games (rated and casual) with full move log
--   rating_history  one row per rated game per player (for charts)
--   leaderboard     view: ranked players per category
--
-- Ratings and games are written ONLY by the game server (service role)
-- through public.record_game(), so clients can never edit their rating.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists citext;

-- ─────────────────────────── profiles ───────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    citext not null unique
              check (username ~ '^[A-Za-z0-9_.-]{3,20}$'),
  avatar_url  text check (avatar_url is null or char_length(avatar_url) <= 500),
  bio         text check (bio is null or char_length(bio) <= 280),
  country     text check (country is null or country ~ '^[A-Z]{2}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles are public" on public.profiles;
create policy "profiles are public" on public.profiles
  for select using (true);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Create a profile automatically on sign-up (email, magic link or OAuth).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  candidate text;
  tries int := 0;
begin
  base := coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    nullif(new.raw_user_meta_data ->> 'user_name', ''),
    nullif(new.raw_user_meta_data ->> 'preferred_username', ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'player'
  );
  base := left(regexp_replace(base, '[^A-Za-z0-9_.-]', '', 'g'), 16);
  if char_length(base) < 3 then base := 'player'; end if;
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) and tries < 20 loop
    candidate := base || floor(random() * 10000)::int::text;
    tries := tries + 1;
  end loop;
  insert into public.profiles (id, username, avatar_url)
  values (new.id, candidate, new.raw_user_meta_data ->> 'avatar_url')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Cheap availability check for the sign-up form.
create or replace function public.username_available(name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select name ~ '^[A-Za-z0-9_.-]{3,20}$'
     and not exists (select 1 from public.profiles where username = name::citext);
$$;
grant execute on function public.username_available(text) to anon, authenticated;

-- ─────────────────────────── ratings ───────────────────────────
create table if not exists public.ratings (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  category   text not null check (category in ('bullet', 'blitz', 'rapid')),
  rating     double precision not null default 1200,
  rd         double precision not null default 350,
  vol        double precision not null default 0.06,
  games      integer not null default 0,
  wins       integer not null default 0,
  losses     integer not null default 0,
  draws      integer not null default 0,
  peak       double precision not null default 1200,
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);
create index if not exists ratings_category_rating_idx on public.ratings (category, rating desc);

alter table public.ratings enable row level security;
drop policy if exists "ratings are public" on public.ratings;
create policy "ratings are public" on public.ratings for select using (true);

-- ─────────────────────────── games ───────────────────────────
create table if not exists public.games (
  id                  text primary key,
  white_id            uuid references public.profiles (id) on delete set null,
  black_id            uuid references public.profiles (id) on delete set null,
  white_name          text not null,
  black_name          text not null,
  rated               boolean not null default false,
  mode                text not null check (mode in ('private', 'casual', 'ranked')),
  time_control        text not null,
  category            text not null check (category in ('bullet', 'blitz', 'rapid')),
  winner              text check (winner in ('w', 'b')),
  reason              text not null,
  white_rating_before integer,
  white_rating_after  integer,
  black_rating_before integer,
  black_rating_after  integer,
  turns               integer not null default 0,
  history             jsonb not null default '[]'::jsonb,
  ended_at            timestamptz not null default now()
);
create index if not exists games_white_idx on public.games (white_id, ended_at desc);
create index if not exists games_black_idx on public.games (black_id, ended_at desc);

alter table public.games enable row level security;
drop policy if exists "games are public" on public.games;
create policy "games are public" on public.games for select using (true);

-- ─────────────────────────── rating history ───────────────────────────
create table if not exists public.rating_history (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  category   text not null,
  rating     double precision not null,
  game_id    text references public.games (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists rating_history_user_idx on public.rating_history (user_id, category, created_at);

alter table public.rating_history enable row level security;
drop policy if exists "rating history is public" on public.rating_history;
create policy "rating history is public" on public.rating_history for select using (true);

-- ─────────────────────────── leaderboard ───────────────────────────
create or replace view public.leaderboard
with (security_invoker = true) as
select
  r.category,
  rank() over (partition by r.category order by r.rating desc) as rank,
  p.id as user_id,
  p.username,
  p.avatar_url,
  p.country,
  round(r.rating)::int as rating,
  round(r.rd)::int as rd,
  r.games,
  r.wins,
  r.losses,
  r.draws,
  round(r.peak)::int as peak
from public.ratings r
join public.profiles p on p.id = r.user_id
where r.games >= 1;

-- ─────────────────────────── record_game() ───────────────────────────
-- Called by the game server (service role) when a game ends.
-- payload: {
--   id, white_id, black_id, white_name, black_name, rated, mode, time_control,
--   category, winner, reason, turns, history,
--   white: {rating, rd, vol, before}, black: {rating, rd, vol, before}   -- rated only
-- }
create or replace function public.record_game(payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cat text := payload ->> 'category';
  rated boolean := coalesce((payload ->> 'rated')::boolean, false);
  winner text := payload ->> 'winner';
  side text;
  uid uuid;
  r jsonb;
  score numeric;
begin
  insert into public.games (
    id, white_id, black_id, white_name, black_name, rated, mode, time_control, category,
    winner, reason, turns, history,
    white_rating_before, white_rating_after, black_rating_before, black_rating_after
  ) values (
    payload ->> 'id',
    nullif(payload ->> 'white_id', '')::uuid,
    nullif(payload ->> 'black_id', '')::uuid,
    payload ->> 'white_name',
    payload ->> 'black_name',
    rated,
    payload ->> 'mode',
    payload ->> 'time_control',
    cat,
    winner,
    payload ->> 'reason',
    coalesce((payload ->> 'turns')::int, 0),
    coalesce(payload -> 'history', '[]'::jsonb),
    round((payload -> 'white' ->> 'before')::numeric),
    round((payload -> 'white' ->> 'rating')::numeric),
    round((payload -> 'black' ->> 'before')::numeric),
    round((payload -> 'black' ->> 'rating')::numeric)
  )
  on conflict (id) do nothing;

  if not found or not rated then
    return;
  end if;

  foreach side in array array['white', 'black'] loop
    uid := nullif(payload ->> (side || '_id'), '')::uuid;
    r := payload -> side;
    continue when uid is null or r is null;
    score := case
      when winner is null then 0.5
      when (winner = 'w') = (side = 'white') then 1
      else 0 end;
    insert into public.ratings as t (user_id, category, rating, rd, vol, games, wins, losses, draws, peak)
    values (
      uid, cat, (r ->> 'rating')::float8, (r ->> 'rd')::float8, (r ->> 'vol')::float8, 1,
      (score = 1)::int, (score = 0)::int, (score = 0.5)::int,
      greatest(1200, (r ->> 'rating')::float8)
    )
    on conflict (user_id, category) do update set
      rating = excluded.rating,
      rd = excluded.rd,
      vol = excluded.vol,
      games = t.games + 1,
      wins = t.wins + excluded.wins,
      losses = t.losses + excluded.losses,
      draws = t.draws + excluded.draws,
      peak = greatest(t.peak, excluded.rating),
      updated_at = now();
    insert into public.rating_history (user_id, category, rating, game_id)
    values (uid, cat, (r ->> 'rating')::float8, payload ->> 'id');
  end loop;
end $$;

revoke all on function public.record_game(jsonb) from public, anon, authenticated;
grant execute on function public.record_game(jsonb) to service_role;
