import { Link } from "react-router-dom";
import { Compass } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="beam-grid flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-background px-6 text-center">
      <Compass className="size-6 text-emerald-400" aria-hidden="true" />
      <h1 className="font-heading text-2xl tracking-tight text-foreground">404 — no such route</h1>
      <p className="max-w-sm font-geist text-sm leading-relaxed text-muted-foreground">
        Beam only has two screens: the pairing desk and a room. This address is neither.
      </p>
      <Link to="/" data-testid="not-found-home-link" className={buttonVariants({ size: "sm" })}>
        Back to the pairing desk
      </Link>
    </div>
  );
}
