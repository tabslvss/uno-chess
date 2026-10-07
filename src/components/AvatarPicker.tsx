import { Dices, Pencil, RefreshCw, Shuffle } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Avatar } from '@/components/Avatar';
import { Dialog, Spinner, Tip } from '@/components/ui';
import { avatarUrl, parseAvatar, randomAvatar, randomSeed, type AvatarStyle } from '@/lib/avatar';
import { cn } from '@/lib/cn';
import { displayName, myAvatar, useAuth } from '@/stores/auth';

const GRID = 12;

/** Dialog to browse styles, shuffle, and pick a DiceBear avatar. */
export function AvatarPicker({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const auth = useAuth();
  const current = myAvatar(auth);
  const [selected, setSelected] = useState(current);
  const style: AvatarStyle = 'adventurer';
  const [seeds, setSeeds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const name = displayName(auth);

  const regenerate = () => setSeeds(Array.from({ length: GRID }, randomSeed));

  // Reset to the saved avatar each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setSelected(current);
    regenerate();
  }, [open, current]);

  const candidates = useMemo(() => seeds.map((s) => avatarUrl(style, s)), [seeds, style]);

  const save = async () => {
    setSaving(true);
    const err = await auth.setAvatar(selected);
    setSaving(false);
    if (err) return toast.error(err);
    toast.success('Looking good!');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Choose your avatar" description="Pick one you like, or keep shuffling until something clicks." className="w-[min(94vw,36rem)]">
      <div className="space-y-5" data-testid="avatar-picker">
        <div className="flex items-center gap-4 rounded-2xl bg-surface-2 p-4">
          <motion.div key={selected} initial={{ scale: 0.8, rotate: -8 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}>
            <Avatar seed={name} url={selected} name={name} size={88} className="rounded-2xl" />
          </motion.div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="truncate font-display text-xl font-bold">{name}</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-mustard !py-2"
                data-testid="avatar-shuffle"
                onClick={() => setSelected(avatarUrl(style, randomSeed()))}
              >
                <Dices size={16} /> Shuffle
              </button>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="label">Pick one</span>
            <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={regenerate} data-testid="avatar-more">
              <RefreshCw size={14} /> More options
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {candidates.map((url) => (
              <button
                key={url}
                type="button"
                aria-label="Choose this avatar"
                aria-pressed={selected === url}
                data-testid="avatar-option"
                onClick={() => setSelected(url)}
                className={cn(
                  'rounded-2xl p-1 transition hover:-translate-y-0.5',
                  selected === url ? 'bg-brand/15 ring-2 ring-brand' : 'hover:bg-surface-2',
                )}
              >
                <Avatar seed={name} url={url} name={name} size={64} className="!h-auto !w-full aspect-square" />
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button type="button" className="btn-primary flex-1" onClick={save} disabled={saving || selected === current} data-testid="avatar-save">
            {saving ? <Spinner className="h-4 w-4 border-2" /> : 'Save avatar'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

/** One-tap re-roll: new random avatar in the same style, saved immediately. */
export function useRandomizeAvatar() {
  const auth = useAuth();
  return async () => {
    const style = parseAvatar(myAvatar(auth))?.style;
    const err = await auth.setAvatar(randomAvatar(style));
    if (err) toast.error(err);
  };
}

/** The current player's avatar with edit + randomize controls. */
export function EditableAvatar({ size = 72 }: { size?: number }) {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const randomize = useRandomizeAvatar();
  const name = displayName(auth);
  const url = myAvatar(auth);
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative rounded-3xl"
        aria-label="Change avatar"
        data-testid="my-avatar"
      >
        <motion.span key={url} initial={{ scale: 0.85 }} animate={{ scale: 1 }} className="block">
          <Avatar seed={name} url={url} name={name} size={size} className="rounded-3xl" />
        </motion.span>
        <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-brand text-white shadow-md ring-2 ring-surface transition group-hover:scale-110">
          <Pencil size={13} />
        </span>
      </button>
      <div className="flex flex-col gap-1.5">
        <button type="button" className="btn-secondary !py-1.5 text-xs" onClick={() => setOpen(true)}>
          <Pencil size={14} /> Choose
        </button>
        <Tip content="New random avatar in the same style">
          <button type="button" className="btn-mustard !py-1.5 text-xs" onClick={() => void randomize()} data-testid="avatar-randomize">
            <Shuffle size={14} /> Randomize
          </button>
        </Tip>
      </div>
      <AvatarPicker open={open} onOpenChange={setOpen} />
    </div>
  );
}
