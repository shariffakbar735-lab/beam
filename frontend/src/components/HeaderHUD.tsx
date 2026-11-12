import {
  Check,
  Copy,
  Laptop,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  QrCode,
  Trash2,
  Unlink,
  Wifi,
  WifiOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ConnectionState } from "@/hooks/useBeamRoom";

interface HeaderHUDProps {
  roomId: string;
  connection: ConnectionState;
  peerOnline: boolean;
  peerLabel: string | null;
  deviceLabel: string;
  autoCopy: boolean;
  clearing: boolean;
  linkCopied: boolean;
  layout: "wide" | "narrow";
  onEditLabel: () => void;
  onToggleAutoCopy: (next: boolean) => void;
  onCopyLink: () => void;
  onShowPairing: () => void;
  onClearAll: () => void;
  onUnpair: () => void;
}

const CONNECTION_STYLE: Record<ConnectionState, { label: string; pill: string; dot: string }> = {
  live: {
    label: "Connected",
    pill: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    dot: "bg-emerald-400",
  },
  connecting: {
    label: "Connecting…",
    pill: "border-amber-500/40 bg-amber-500/10 text-amber-200",
    dot: "bg-amber-400",
  },
  polling: {
    label: "Reconnecting…",
    pill: "border-amber-500/40 bg-amber-500/10 text-amber-200",
    dot: "bg-amber-400",
  },
};

export default function HeaderHUD({
  roomId,
  connection,
  peerOnline,
  peerLabel,
  deviceLabel,
  autoCopy,
  clearing,
  linkCopied,
  layout,
  onEditLabel,
  onToggleAutoCopy,
  onCopyLink,
  onShowPairing,
  onClearAll,
  onUnpair,
}: HeaderHUDProps) {
  const status = CONNECTION_STYLE[connection];

  return (
    <header
      data-testid="app-header"
      className="relative z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-[#0c0e14]/90 px-3 backdrop-blur-xl sm:px-5"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span aria-hidden="true" className="text-base leading-none text-emerald-400">
          ⇄
        </span>
        <span className="font-heading text-[15px] font-semibold tracking-tight text-foreground">
          beam
        </span>
        <span
          aria-hidden="true"
          className="hidden h-3.5 w-1.5 animate-beam-caret bg-emerald-400 sm:inline-block"
        />
        <span className="ml-1 hidden truncate font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase md:inline">
          {roomId}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <span
          data-testid="connection-status-badge"
          data-connection={connection}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium tracking-[0.14em] uppercase",
            status.pill,
          )}
        >
          <span className="relative flex size-1.5 items-center justify-center">
            <span className={cn("size-1.5 rounded-full", status.dot)} />
            {connection === "live" && (
              <span className={cn("absolute size-1.5 animate-beam-ping rounded-full", status.dot)} />
            )}
          </span>
          <span>{status.label}</span>
          {connection !== "live" && (
            <Loader2 className="size-3 animate-beam-spin" aria-hidden="true" />
          )}
        </span>

        <span
          data-testid="peer-status-indicator"
          data-peer-online={peerOnline ? "true" : "false"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium tracking-[0.14em] uppercase",
            peerOnline
              ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300/90"
              : "border-border bg-[#12141c] text-muted-foreground",
          )}
        >
          {peerOnline ? (
            <Wifi className="size-3" aria-hidden="true" />
          ) : (
            <WifiOff className="size-3" aria-hidden="true" />
          )}
          <span className="max-[380px]:hidden">
            {peerOnline ? `${peerLabel ?? "Other device"} online` : "Peer offline"}
          </span>
        </span>

        {layout === "wide" ? (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="xs"
              data-testid="auto-copy-toggle"
              aria-pressed={autoCopy}
              onClick={() => onToggleAutoCopy(!autoCopy)}
              className={cn(
                "h-7 gap-1.5 border-[#2b3145] bg-[#161923] px-2 text-[11px] tracking-wide",
                autoCopy ? "border-emerald-500/50 text-emerald-200" : "text-slate-300",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-2 rounded-full",
                  autoCopy ? "bg-emerald-400" : "bg-slate-600",
                )}
              />
              Auto-copy
            </Button>

            <Button
              type="button"
              variant="outline"
              size="xs"
              data-testid="device-label-button"
              onClick={onEditLabel}
              className="h-7 gap-1.5 border-[#2b3145] bg-[#161923] px-2 text-[11px] tracking-wide text-slate-300"
            >
              <Laptop className="size-3" aria-hidden="true" />
              {deviceLabel}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="xs"
              data-testid="copy-shareable-link-desktop"
              onClick={onCopyLink}
              className="h-7 gap-1.5 border-[#2b3145] bg-[#161923] px-2 text-[11px] tracking-wide text-slate-300"
            >
              {linkCopied ? (
                <Check className="size-3 text-emerald-400" aria-hidden="true" />
              ) : (
                <Copy className="size-3" aria-hidden="true" />
              )}
              {linkCopied ? "Copied" : "Link"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              data-testid="clear-all-messages-button"
              onClick={onClearAll}
              disabled={clearing}
              title="Clear all messages"
              className="text-slate-400 hover:text-red-300"
            >
              {clearing ? (
                <Loader2 className="size-3.5 animate-beam-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="size-3.5" aria-hidden="true" />
              )}
              <span className="sr-only">Clear all messages</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              data-testid="unpair-new-room-button"
              onClick={onUnpair}
              title="Unpair this device and start a new room"
              className="text-slate-400 hover:text-emerald-300"
            >
              <Unlink className="size-3.5" aria-hidden="true" />
              <span className="sr-only">Unpair and start a new room</span>
            </Button>
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger
              data-testid="session-menu-button"
              render={
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="border-[#2b3145] bg-[#161923] text-slate-200"
                />
              }
            >
              <MoreVertical className="size-4" aria-hidden="true" />
              <span className="sr-only">Session actions</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 border border-border bg-[#12141c]">
              <DropdownMenuItem
                data-testid="auto-copy-toggle-menu-item"
                onClick={() => onToggleAutoCopy(!autoCopy)}
              >
                <span
                  aria-hidden="true"
                  className={cn("size-2 rounded-full", autoCopy ? "bg-emerald-400" : "bg-slate-600")}
                />
                Auto-copy incoming
                <span className="ml-auto text-[10px] tracking-widest text-muted-foreground uppercase">
                  {autoCopy ? "on" : "off"}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem data-testid="device-label-menu-item" onClick={onEditLabel}>
                <Pencil className="size-3.5" />
                {deviceLabel} · rename
              </DropdownMenuItem>
              <DropdownMenuItem data-testid="open-qr-modal-button" onClick={onShowPairing}>
                <QrCode className="size-3.5" />
                Pairing QR &amp; link
              </DropdownMenuItem>
              <DropdownMenuItem data-testid="copy-shareable-link-button-menu" onClick={onCopyLink}>
                {linkCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {linkCopied ? "Link copied" : "Copy shareable link"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                data-testid="clear-all-messages-button-menu"
                onClick={onClearAll}
              >
                <Trash2 className="size-3.5" />
                Clear all messages
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                data-testid="unpair-new-room-button-menu"
                onClick={onUnpair}
              >
                <Plus className="size-3.5" />
                Unpair / new room
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
