import { Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { EditableAvatar } from '@/components/AvatarPicker';
import { PageShell, PageTitle } from '@/components/PageShell';
import { Segmented, Switch } from '@/components/ui';
import { cn } from '@/lib/cn';
import { playSound } from '@/lib/sounds';
import { useAuth } from '@/stores/auth';
import { applyTheme, useSettings, type BoardTheme, type ThemeMode } from '@/stores/settings';

const BOARDS: { id: BoardTheme; name: string; light: string; dark: string }[] = [
  { id: 'walnut', name: 'Walnut', light: '#f0d9b5', dark: '#b58863' },
  { id: 'cocoa', name: 'Cocoa', light: '#e8d3b9', dark: '#8b6b52' },
  { id: 'sage', name: 'Sage', light: '#eeeed2', dark: '#769656' },
  { id: 'dusk', name: 'Dusk', light: '#dee3e6', dark: '#8ca2ad' },
  { id: 'rose', name: 'Rose', light: '#f3e0dc', dark: '#c48b86' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card-surface p-6">
      <h2 className="mb-3 font-display text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

function AccountSection() {
  const auth = useAuth();
  const [username, setUsername] = useState(auth.profile?.username ?? '');
  const [bio, setBio] = useState(auth.profile?.bio ?? '');
  const [guest, setGuest] = useState(auth.guestName);
  if (!auth.session) {
    return (
      <Section title="Guest profile">
        <div className="mb-4">
          <EditableAvatar />
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            auth.renameGuest(guest);
            toast.success('Saved');
          }}
        >
          <input className="input" value={guest} onChange={(e) => setGuest(e.target.value)} maxLength={20} />
          <button className="btn-primary">Save</button>
        </form>
      </Section>
    );
  }
  return (
    <Section title="Profile">
      <div className="mb-4">
        <EditableAvatar />
      </div>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const err = await auth.updateProfile({ username, bio: bio || null });
          if (err) toast.error(err);
          else toast.success('Profile updated');
        }}
      >
        <label className="block space-y-1.5">
          <span className="label">Username</span>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20} />
        </label>
        <label className="block space-y-1.5">
          <span className="label">Bio</span>
          <textarea className="input min-h-20" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} />
        </label>
        <button className="btn-primary">Save profile</button>
      </form>
    </Section>
  );
}

export default function SettingsPage() {
  const s = useSettings();
  return (
    <PageShell>
      <PageTitle eyebrow="Make yourself at home" title="Settings" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Appearance">
          <div className="label mb-1.5">Theme</div>
          <Segmented
            value={s.theme}
            onChange={(theme: ThemeMode) => {
              s.set({ theme });
              applyTheme(theme);
            }}
            options={[
              { value: 'light', label: '☀️ Light' },
              { value: 'system', label: '🖥️ System' },
              { value: 'dark', label: '🌙 Dark' },
            ]}
          />
          <div className="label mb-1.5 mt-5">Board</div>
          <div className="grid grid-cols-5 gap-2">
            {BOARDS.map((b) => (
              <button
                key={b.id}
                onClick={() => s.set({ board: b.id })}
                className={cn('rounded-xl p-1.5 transition', s.board === b.id ? 'bg-terracotta/15 ring-2 ring-terracotta' : 'hover:bg-surface-2')}
                aria-pressed={s.board === b.id}
              >
                <div className="relative grid aspect-square grid-cols-2 overflow-hidden rounded-lg">
                  {[b.light, b.dark, b.dark, b.light].map((c, i) => (
                    <span key={i} style={{ background: c }} />
                  ))}
                  {s.board === b.id && (
                    <Check className="absolute inset-0 m-auto rounded-full bg-terracotta p-0.5 text-white" size={18} />
                  )}
                </div>
                <span className="mt-1 block text-xs font-bold">{b.name}</span>
              </button>
            ))}
          </div>
          <Switch checked={s.coordinates} onCheckedChange={(v) => s.set({ coordinates: v })} label="Board coordinates" />
          <Switch checked={s.animations} onCheckedChange={(v) => s.set({ animations: v })} label="Piece animations" />
        </Section>

        <Section title="Gameplay">
          <Switch checked={s.showLegalMoves} onCheckedChange={(v) => s.set({ showLegalMoves: v })} label="Show legal moves" hint="Dots on squares you can move to." />
          <Switch checked={s.highlightLines} onCheckedChange={(v) => s.set({ highlightLines: v })} label="Highlight card lines" hint="Tint the file & rank a card unlocks." />
          <Switch checked={s.autoQueen} onCheckedChange={(v) => s.set({ autoQueen: v })} label="Auto-queen" hint="Always promote to a queen." />
          <Switch checked={s.confirmResign} onCheckedChange={(v) => s.set({ confirmResign: v })} label="Confirm before resigning" />
          <Switch checked={s.flipLocal} onCheckedChange={(v) => s.set({ flipLocal: v })} label="Flip board in pass & play" />
        </Section>

        <Section title="Sound">
          <Switch checked={s.sound} onCheckedChange={(v) => s.set({ sound: v })} label="Sound effects" />
          <label className="flex items-center gap-4 py-2">
            <span className="font-bold">Volume</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={s.volume}
              onChange={(e) => s.set({ volume: Number(e.target.value) })}
              onPointerUp={() => playSound('cardPlay')}
              className="flex-1 accent-[var(--color-terracotta)]"
              aria-label="Volume"
            />
          </label>
        </Section>

        <AccountSection />

        <Section title="Keyboard shortcuts">
          <ul className="space-y-2 text-sm">
            <li><span className="kbd">1</span>–<span className="kbd">9</span> play the nth card in your hand</li>
            <li><span className="kbd">U</span> call UNO</li>
            <li><span className="kbd">F</span> flip the board</li>
          </ul>
        </Section>
      </div>
    </PageShell>
  );
}
