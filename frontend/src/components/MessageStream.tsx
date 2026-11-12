import { useEffect, useRef } from "react";
import { Loader2, RadioTower, SatelliteDish } from "lucide-react";

import MessageBubble from "@/components/MessageBubble";
import type { BeamThreadMessage } from "@/hooks/useBeamRoom";

interface MessageStreamProps {
  messages: BeamThreadMessage[];
  loading: boolean;
  unreachable: boolean;
  copiedId: string | null;
  onCopy: (message: BeamThreadMessage) => void;
}

export default function MessageStream({
  messages,
  loading,
  unreachable,
  copiedId,
  onCopy,
}: MessageStreamProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <div
      data-testid="message-stream-container"
      className="beam-grid beam-scroll relative flex-1 overflow-y-auto px-3.5 py-4 sm:px-5"
    >
      {messages.length === 0 ? (
        <div
          data-testid="empty-messages-banner"
          className="mx-auto mt-6 flex max-w-sm flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-[#0e1017]/70 px-5 py-8 text-center"
        >
          {loading ? (
            <Loader2 className="size-5 animate-beam-spin text-emerald-400" aria-hidden="true" />
          ) : (
            <SatelliteDish className="size-5 text-emerald-400" aria-hidden="true" />
          )}
          <p className="text-[13px] leading-relaxed text-foreground">
            {loading ? "Opening the channel…" : "Channel open. Nothing on the wire yet."}
          </p>
          <p className="font-geist text-xs leading-relaxed text-muted-foreground">
            Paste a link, a code snippet or an address here and it lands on your other device in under
            a second. Everything is encrypted in this browser first.
          </p>
          <span className="mt-1 inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <RadioTower className="size-3" aria-hidden="true" />
            waiting for traffic
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              copied={copiedId === message.id}
              onCopy={onCopy}
            />
          ))}
        </div>
      )}

      {unreachable && (
        <p className="mt-4 text-center text-[11px] uppercase tracking-[0.16em] text-amber-400/80">
          relay unreachable — showing what this device already has
        </p>
      )}

      <div ref={bottomRef} className="h-1" />
    </div>
  );
}
