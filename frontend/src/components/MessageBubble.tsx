import { Check, Copy, ShieldQuestion } from "lucide-react";

import Linkify from "@/components/Linkify";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatClock } from "@/lib/beam";
import type { BeamThreadMessage } from "@/hooks/useBeamRoom";

interface MessageBubbleProps {
  message: BeamThreadMessage;
  copied: boolean;
  onCopy: (message: BeamThreadMessage) => void;
}

export default function MessageBubble({ message, copied, onCopy }: MessageBubbleProps) {
  const { mine, decrypted } = message;

  return (
    <div
      data-testid="message-bubble-item"
      className={cn("flex animate-beam-in", mine ? "justify-end" : "justify-start")}
    >
      <article
        className={cn(
          "group relative max-w-[92%] rounded-lg border px-3.5 py-2.5 sm:max-w-[78%] sm:px-4 sm:py-3",
          mine
            ? "border-emerald-600/55 bg-[#162b22] text-emerald-50"
            : "border-[#2b3145] bg-[#181b26] text-slate-100",
          copied && "animate-beam-flash",
        )}
      >
        <header className="mb-1.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.16em]">
          <span
            data-testid="message-sender-label"
            className={cn(
              "rounded-sm px-1.5 py-0.5",
              mine ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-500/15 text-slate-300",
            )}
          >
            {mine ? `${message.deviceLabel} · you` : message.deviceLabel}
          </span>
          <time
            data-testid="message-timestamp"
            dateTime={message.createdAt}
            className="tabular-nums text-muted-foreground"
          >
            {formatClock(message.createdAt)}
          </time>
        </header>

        {decrypted ? (
          <p
            data-testid="message-text-content"
            className="font-mono text-[13.5px] leading-relaxed break-words whitespace-pre-wrap selection:bg-emerald-500/30 sm:text-sm"
          >
            <Linkify text={message.text ?? ""} />
          </p>
        ) : (
          <p className="flex items-center gap-2 font-mono text-[13px] text-muted-foreground italic">
            <ShieldQuestion className="size-3.5 shrink-0" aria-hidden="true" />
            Encrypted with a different key — this device cannot read it.
          </p>
        )}

        <footer className="mt-2 flex items-center justify-end">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            data-testid="message-copy-button"
            disabled={!decrypted}
            onClick={() => onCopy(message)}
            className={cn(
              "h-6 gap-1 px-1.5 text-[10px] font-medium uppercase tracking-[0.14em]",
              mine
                ? "text-emerald-300/80 hover:bg-emerald-500/15 hover:text-emerald-200"
                : "text-slate-400 hover:bg-slate-400/15 hover:text-slate-100",
            )}
          >
            {copied ? (
              <>
                <Check className="size-3" aria-hidden="true" />
                Copied
              </>
            ) : (
              <>
                <Copy className="size-3" aria-hidden="true" />
                Copy
              </>
            )}
          </Button>
        </footer>
      </article>
    </div>
  );
}
