import { useCallback, useEffect, useRef, useState } from "react";
import { CornerDownLeft, Loader2, Send, ClipboardPaste } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { MESSAGE_MAX_LENGTH } from "@/lib/beam";
import { useIsDesktopInput } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

interface MessageComposerProps {
  onSend: (text: string) => void;
  sending: boolean;
  disabled: boolean;
}

const MAX_TEXTAREA_PX = 168;

export default function MessageComposer({ onSend, sending, disabled }: MessageComposerProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isDesktopInput = useIsDesktopInput();
  const overLimit = value.length > MESSAGE_MAX_LENGTH;

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, MAX_TEXTAREA_PX)}px`;
  }, [value]);

  const submit = useCallback(
    (text: string) => {
      const next = text.replace(/^$/, "");
      if (!next.trim() || next.length > MESSAGE_MAX_LENGTH) return;
      onSend(next);
      setValue("");
    },
    [onSend],
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit(value);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Desktop: Enter sends, Shift+Enter is a newline. Touch keyboards keep Enter as newline.
    if (event.key === "Enter" && !event.shiftKey && isDesktopInput) {
      event.preventDefault();
      submit(value);
    }
  };

  const handlePasteAndSend = async () => {
    const clipboard = navigator.clipboard;
    if (!clipboard?.readText) {
      textareaRef.current?.focus();
      toast("Clipboard is blocked here — paste into the box manually");
      return;
    }
    try {
      const text = await clipboard.readText();
      if (!text || !text.trim()) {
        textareaRef.current?.focus();
        toast("Clipboard is empty — type or paste something");
        return;
      }
      if (text.length > MESSAGE_MAX_LENGTH) {
        textareaRef.current?.focus();
        toast(`Clipboard text is over ${MESSAGE_MAX_LENGTH.toLocaleString()} characters`);
        return;
      }
      submit(text);
      toast.success("Pasted and sent");
    } catch {
      textareaRef.current?.focus();
      toast("Clipboard is blocked here — paste into the box manually");
    }
  };

  return (
    <form
      data-testid="message-composer-form"
      onSubmit={handleSubmit}
      className="shrink-0 border-t border-border bg-[#0f1118]/95 px-3 pt-3 backdrop-blur-xl sm:px-5"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div
        className={cn(
          "flex items-end gap-2 rounded-lg border bg-[#12141c] px-2.5 py-2 transition-colors duration-150",
          overLimit ? "border-red-500/60" : "border-border focus-within:border-emerald-500/60",
        )}
      >
        <textarea
          data-testid="message-composer-input"
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "Waiting for the room…" : "Type or paste anything…"}
          className="beam-scroll max-h-[168px] min-h-9 flex-1 resize-none bg-transparent py-1.5 font-mono text-[13.5px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/70 disabled:opacity-60 sm:text-sm"
        />
        <Button
          type="submit"
          size="sm"
          data-testid="message-send-button"
          disabled={disabled || sending || overLimit || !value.trim()}
          className="h-9 gap-1.5 px-3 font-medium"
        >
          {sending ? (
            <Loader2 className="size-3.5 animate-beam-spin" aria-hidden="true" />
          ) : (
            <Send className="size-3.5" aria-hidden="true" />
          )}
          Send
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="xs"
            data-testid="message-paste-send-button"
            onClick={handlePasteAndSend}
            disabled={disabled}
            className="h-7 gap-1.5 border-[#2b3145] bg-[#161923] px-2 text-[11px] tracking-wide text-slate-200 hover:border-emerald-500/50 hover:text-emerald-200"
          >
            <ClipboardPaste className="size-3" aria-hidden="true" />
            Paste &amp; Send
          </Button>
          {isDesktopInput && (
            <span className="hidden items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:inline-flex">
              <CornerDownLeft className="size-3" aria-hidden="true" />
              enter sends · shift+enter newline
            </span>
          )}
        </div>

        <span
          data-testid="composer-char-count"
          className={cn(
            "font-mono text-[10px] tabular-nums tracking-[0.12em]",
            overLimit ? "text-red-400" : "text-muted-foreground",
          )}
        >
          {value.length.toLocaleString()} / {MESSAGE_MAX_LENGTH.toLocaleString()}
        </span>
      </div>
    </form>
  );
}
