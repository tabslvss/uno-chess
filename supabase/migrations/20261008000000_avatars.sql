-- ════════════════════════════════════════════════════════════════════
-- Avatars: every player gets a random DiceBear avatar, and avatar_url may
-- only point at the DiceBear API (no arbitrary images / tracking pixels).
--   https://api.dicebear.com/9.x/<style>/svg?seed=<seed>
-- ════════════════════════════════════════════════════════════════════

create or replace function public.random_avatar_url()
returns text
language sql
volatile
as $$
  select 'https://api.dicebear.com/9.x/'
    || (array['thumbs','adventurer','big-smile','fun-emoji','lorelei','notionists','avataaars','bottts','croodles','pixel-art'])[1 + floor(random() * 10)::int]
    || '/svg?seed='
    || substr(md5(random()::text || clock_timestamp()::text), 1, 12);
$$;

-- Backfill anyone without a valid avatar (e.g. OAuth profile pictures).
update public.profiles
set avatar_url = public.random_avatar_url()
where avatar_url is null
   or avatar_url !~ '^https://api\.dicebear\.com/9\.x/[a-z-]+/svg\?seed=[A-Za-z0-9_-]{1,64}$';

alter table public.profiles drop constraint if exists profiles_avatar_url_check;
alter table public.profiles alter column avatar_url set default public.random_avatar_url();
alter table public.profiles add constraint profiles_avatar_url_check
  check (avatar_url ~ '^https://api\.dicebear\.com/9\.x/[a-z-]+/svg\?seed=[A-Za-z0-9_-]{1,64}$');
alter table public.profiles alter column avatar_url set not null;

-- New sign-ups get a random avatar (ignore OAuth pictures).
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
  values (new.id, candidate, public.random_avatar_url())
  on conflict (id) do nothing;
  return new;
end $$;
