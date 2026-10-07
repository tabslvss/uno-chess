import { Check, Copy, Share2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export function CopyInvite({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Invite link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Couldn’t copy — select the link instead.');
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title: 'UNO Chess', text: 'Play UNO Chess with me!', url });
    } catch {
      /* cancelled */
    }
  };
  return (
    <div className="mt-5 flex w-full items-center gap-2">
      <input readOnly value={url} className="input font-mono text-sm" onFocus={(e) => e.currentTarget.select()} aria-label="Invite link" />
      <button className="btn-primary !px-3" onClick={copy} aria-label="Copy invite link">
        {copied ? <Check size={18} /> : <Copy size={18} />}
      </button>
      {'share' in navigator && (
        <button className="btn-secondary !px-3" onClick={share} aria-label="Share invite link">
          <Share2 size={18} />
        </button>
      )}
    </div>
  );
}
