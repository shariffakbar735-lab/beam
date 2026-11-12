import { Lock } from "lucide-react";

import { isCryptoAvailable } from "@/lib/crypto";

/** Static trust strip — always renders, backend or not. */
export default function SecurityNoticeBar() {
  const cryptoReady = isCryptoAvailable();

  return (
    <div
      data-testid="security-e2e-badge"
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-[#0b0d13] px-3.5 py-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground sm:px-5"
    >
      <span className="inline-flex items-center gap-1.5 text-emerald-400">
        <Lock className="size-3" aria-hidden="true" />
        {cryptoReady ? "AES-GCM · client-side" : "Crypto unavailable"}
      </span>
      <span className="hidden sm:inline">·</span>
      <span>24H ephemeral memory</span>
      <span className="hidden sm:inline">·</span>
      <span>No account</span>
      <span className="hidden md:inline">·</span>
      <span className="hidden md:inline">Server never sees your text</span>
    </div>
  );
}
