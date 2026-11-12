import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, Download, KeyRound, ScanLine, Timer } from "lucide-react";

import { Button } from "@/components/ui/button";

interface PairingPanelProps {
  roomId: string;
  link: string;
  linkCopied: boolean;
  canInstall: boolean;
  onCopyLink: () => void;
  onInstall: () => void;
}

export default function PairingPanel({
  roomId,
  link,
  linkCopied,
  canInstall,
  onCopyLink,
  onInstall,
}: PairingPanelProps) {
  return (
    <div className="beam-scanlines beam-scroll flex h-full flex-col gap-5 overflow-y-auto p-5">
      <div className="relative">
        <p className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
          pair this device
        </p>
        <h2 className="mt-1.5 font-heading text-lg leading-snug text-foreground">
          Scan with your phone camera
        </h2>
        <p className="mt-1.5 font-geist text-xs leading-relaxed text-muted-foreground">
          No sign-up. The link carries the room and its encryption key after the <code>#</code> —
          the server never receives that part.
        </p>
      </div>

      <div
        data-testid="qr-code-canvas"
        className="relative mx-auto w-fit rounded-xl bg-white p-3.5 shadow-[0_0_0_1px_rgba(16,185,129,0.3),0_22px_50px_-24px_rgba(16,185,129,0.45)] active:scale-[0.985] transition-transform duration-100 ease-out"
      >
        <QRCodeSVG value={link} size={188} level="M" bgColor="#FFFFFF" fgColor="#090A0F" />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-1 -left-1 size-4 border-t-2 border-l-2 border-emerald-500"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-1 -bottom-1 size-4 border-r-2 border-b-2 border-emerald-500"
        />
      </div>

      <div className="rounded-lg border border-border bg-[#0e1017] p-3">
        <p className="text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
          shareable link
        </p>
        <p className="mt-1.5 font-mono text-[11px] leading-relaxed break-all text-slate-300">
          {link}
        </p>
        <Button
          type="button"
          variant="outline"
          size="xs"
          data-testid="copy-shareable-link-button"
          onClick={onCopyLink}
          className="mt-2.5 h-7 gap-1.5 border-[#2b3145] bg-[#161923] px-2 text-[11px] tracking-wide text-slate-200 hover:border-emerald-500/50 hover:text-emerald-200"
        >
          {linkCopied ? (
            <Check className="size-3 text-emerald-400" aria-hidden="true" />
          ) : (
            <Copy className="size-3" aria-hidden="true" />
          )}
          {linkCopied ? "Copied" : "Copy link"}
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-[#0e1017]/70 p-3">
        <p className="flex items-center gap-1.5 text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
          <ScanLine className="size-3" aria-hidden="true" />
          room id
        </p>
        <p
          data-testid="pairing-room-id-display"
          className="mt-1.5 font-mono text-sm tracking-[0.14em] text-emerald-300 tabular-nums"
        >
          {roomId}
        </p>
        <p className="mt-1.5 font-geist text-[11px] leading-relaxed text-muted-foreground">
          Read it aloud to the other device if the QR scan fails, then append the key from the link.
        </p>
      </div>

      <ul className="flex flex-col gap-2 text-[11px] leading-relaxed text-muted-foreground">
        <li className="flex items-start gap-2">
          <KeyRound className="mt-0.5 size-3 shrink-0 text-emerald-400" aria-hidden="true" />
          AES-GCM keys are generated here, in this browser.
        </li>
        <li className="flex items-start gap-2">
          <Timer className="mt-0.5 size-3 shrink-0 text-emerald-400" aria-hidden="true" />
          Every message is deleted 24 hours after it was sent.
        </li>
      </ul>

      {canInstall && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="pwa-install-button"
          onClick={onInstall}
          className="gap-2 border-emerald-500/40 bg-emerald-500/5 text-emerald-200 hover:border-emerald-400 hover:text-emerald-100"
        >
          <Download className="size-3.5" aria-hidden="true" />
          Add Beam to home screen
        </Button>
      )}
    </div>
  );
}
