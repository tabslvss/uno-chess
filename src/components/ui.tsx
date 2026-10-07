import * as RDialog from '@radix-ui/react-dialog';
import * as RSwitch from '@radix-ui/react-switch';
import * as RTabs from '@radix-ui/react-tabs';
import * as RTooltip from '@radix-ui/react-tooltip';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

// ───────────────────────── Dialog ─────────────────────────
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  dismissable = true,
  hideClose = false,
}: {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
  dismissable?: boolean;
  hideClose?: boolean;
}) {
  return (
    <RDialog.Root open={open} onOpenChange={(o) => (dismissable || o ? onOpenChange?.(o) : undefined)}>
      <AnimatePresence>
        {open && (
          <RDialog.Portal forceMount>
            <RDialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-[#2b1d14]/45 backdrop-blur-[3px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </RDialog.Overlay>
            <RDialog.Content
              asChild
              forceMount
              onEscapeKeyDown={(e) => !dismissable && e.preventDefault()}
              onPointerDownOutside={(e) => !dismissable && e.preventDefault()}
              onInteractOutside={(e) => !dismissable && e.preventDefault()}
            >
              <motion.div
                className={cn(
                  'card-surface fixed left-1/2 top-1/2 z-50 w-[min(92vw,28rem)] max-h-[90dvh] overflow-y-auto p-6',
                  className,
                )}
                initial={{ opacity: 0, scale: 0.94, x: '-50%', y: '-46%' }}
                animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
                exit={{ opacity: 0, scale: 0.96, x: '-50%', y: '-48%' }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              >
                <RDialog.Title className="font-display text-2xl font-bold">{title}</RDialog.Title>
                {description ? (
                  <RDialog.Description className="mt-1 text-sm text-ink-soft">{description}</RDialog.Description>
                ) : (
                  <RDialog.Description className="sr-only">{typeof title === 'string' ? title : 'Dialog'}</RDialog.Description>
                )}
                <div className="mt-4">{children}</div>
                {dismissable && !hideClose && (
                  <RDialog.Close className="btn-ghost absolute right-3 top-3 !p-2" aria-label="Close">
                    <X size={18} />
                  </RDialog.Close>
                )}
              </motion.div>
            </RDialog.Content>
          </RDialog.Portal>
        )}
      </AnimatePresence>
    </RDialog.Root>
  );
}

// ───────────────────────── Tooltip ─────────────────────────
export function Tip({ content, children, side = 'top' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  if (!content) return <>{children}</>;
  return (
    <RTooltip.Root delayDuration={250}>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          side={side}
          sideOffset={6}
          className="z-[60] max-w-64 rounded-lg bg-ink px-2.5 py-1.5 text-xs font-bold text-bg shadow-lg data-[state=delayed-open]:animate-in"
        >
          {content}
          <RTooltip.Arrow className="fill-ink" />
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}

export const TooltipProvider = RTooltip.Provider;

// ───────────────────────── Tabs ─────────────────────────
export function Tabs({
  value,
  onValueChange,
  items,
  className,
  listClassName,
}: {
  value: string;
  onValueChange: (v: string) => void;
  items: { value: string; label: ReactNode; content: ReactNode }[];
  className?: string;
  listClassName?: string;
}) {
  return (
    <RTabs.Root value={value} onValueChange={onValueChange} className={cn('flex min-h-0 flex-col', className)}>
      <RTabs.List className={cn('flex gap-1 rounded-xl bg-surface-2 p-1', listClassName)}>
        {items.map((it) => (
          <RTabs.Trigger
            key={it.value}
            value={it.value}
            className="relative flex-1 rounded-lg px-3 py-1.5 text-sm font-extrabold text-ink-soft transition data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-sm"
          >
            {it.label}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
      {items.map((it) => (
        <RTabs.Content key={it.value} value={it.value} className="min-h-0 flex-1 outline-none">
          {it.content}
        </RTabs.Content>
      ))}
    </RTabs.Root>
  );
}

// ───────────────────────── Switch ─────────────────────────
export function Switch({ checked, onCheckedChange, label, hint }: { checked: boolean; onCheckedChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-2">
      <span>
        <span className="block font-bold">{label}</span>
        {hint && <span className="block text-sm text-ink-soft">{hint}</span>}
      </span>
      <RSwitch.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="relative h-7 w-12 shrink-0 rounded-full bg-line transition data-[state=checked]:bg-sage"
      >
        <RSwitch.Thumb className="block h-5 w-5 translate-x-1 rounded-full bg-white shadow transition data-[state=checked]:translate-x-6" />
      </RSwitch.Root>
    </label>
  );
}

// ───────────────────────── misc ─────────────────────────
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn('inline-block h-5 w-5 animate-spin rounded-full border-[3px] border-current border-t-transparent', className)}
      aria-label="Loading"
    />
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
}) {
  return (
    <div className={cn('flex gap-1 rounded-xl bg-surface-2 p-1', className)} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 rounded-lg px-3 py-1.5 text-sm font-extrabold transition',
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-ink-soft hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
