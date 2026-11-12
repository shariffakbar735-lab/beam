import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, KeyRound, Loader2, LockKeyhole, RefreshCw, Timer, Zap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiPost } from "@/lib/api";
import {
  beginFreshSession,
  detectDeviceLabel,
  loadSession,
  newDeviceId,
  parsePairingInput,
  roomPath,
  saveSession,
  type BeamRoom,
} from "@/lib/beam";

async function createRoom(): Promise<BeamRoom> {
  return apiPost<BeamRoom>("/rooms");
}

export default function Home() {
  const navigate = useNavigate();
  const stored = useMemo(() => loadSession(), []);
  const [joinValue, setJoinValue] = useState("");

  const createMutation = useMutation({
    mutationFn: createRoom,
    onSuccess: (room) => {
      const { session } = beginFreshSession(room.id, stored?.deviceLabel ?? null);
      navigate(roomPath(session.roomId));
    },
    onError: () => toast.error("The relay is unreachable — try again in a moment."),
  });

  const handleJoin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = parsePairingInput(joinValue);
    if (!parsed) {
      toast.error("That does not look like a Beam pairing link.");
      return;
    }
    if (!parsed.key) {
      toast.error("That link is missing its #key — paste the whole link from the other device.");
      return;
    }
    saveSession({
      roomId: parsed.roomId,
      key: parsed.key,
      deviceId: stored?.deviceId ?? newDeviceId(),
      deviceLabel: stored?.deviceLabel ?? detectDeviceLabel(),
    });
    navigate(roomPath(parsed.roomId));
  };

  // A remembered room wins: reopening the app reconnects on its own.
  if (stored) return <Navigate to={roomPath(stored.roomId)} replace />;

  return (
    <div className="beam-grid flex min-h-[100dvh] flex-col bg-background">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3.5 sm:px-8">
        <span aria-hidden="true" className="text-base leading-none text-emerald-400">
          ⇄
        </span>
        <span className="font-heading text-[15px] font-semibold tracking-tight text-foreground">
          beam
        </span>
        <span
          aria-hidden="true"
          className="h-3.5 w-1.5 animate-beam-caret bg-emerald-400"
        />
        <span className="ml-auto font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
          no account · e2e · 24h
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-4 py-12 sm:px-8 lg:flex-row lg:items-start lg:gap-20 lg:py-20">
        <section className="flex-1 lg:max-w-xl">
          <p className="text-[10px] font-medium tracking-[0.22em] text-emerald-400 uppercase">
            device-to-device relay
          </p>
          <h1 className="mt-4 font-heading text-4xl leading-[1.05] font-semibold tracking-tight text-foreground sm:text-5xl">
            Text from your phone
            <br />
            to your laptop.
            <span className="ml-2 inline-block h-6 w-2.5 animate-beam-caret bg-emerald-400 align-baseline sm:h-8" />
          </h1>
          <p className="mt-5 max-w-md font-geist text-[15px] leading-relaxed text-muted-foreground">
            One room, two devices, no sign-up. Messages are encrypted in this browser before they
            leave it, appear on the other device in under a second, and are deleted from the server
            24 hours later.
          </p>

          <div className="mt-9">
            <Button
              type="button"
              size="lg"
              data-testid="create-room-button"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="h-11 w-full gap-2 px-5 text-sm font-medium sm:w-auto"
            >
              {createMutation.isPending ? (
                <Loader2 className="size-4 animate-beam-spin" aria-hidden="true" />
              ) : (
                <Zap className="size-4" aria-hidden="true" />
              )}
              Create a private room
            </Button>
          </div>

          <form onSubmit={handleJoin} className="mt-7 flex flex-col gap-2.5" data-testid="join-room-form">
            <label
              htmlFor="join-room-input"
              className="flex items-center gap-1.5 text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase"
            >
              <KeyRound className="size-3" aria-hidden="true" />
              already have a link?
            </label>
            <div className="flex gap-2">
              <Input
                id="join-room-input"
                data-testid="join-room-input"
                value={joinValue}
                onChange={(event) => setJoinValue(event.target.value)}
                placeholder="Paste the pairing link"
                autoComplete="off"
                className="border-[#2b3145] bg-[#0e1017] font-mono text-xs"
              />
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                data-testid="join-room-button"
                className="h-9 shrink-0 gap-1.5"
              >
                Join
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          </form>
        </section>

        <aside className="w-full lg:w-[360px] lg:shrink-0">
          <div className="overflow-hidden rounded-xl border border-border bg-[#0e1017]">
            <div className="flex items-center gap-1.5 border-b border-border bg-[#12141c] px-3.5 py-2.5">
              <span className="size-2 rounded-full bg-red-500/60" aria-hidden="true" />
              <span className="size-2 rounded-full bg-amber-500/60" aria-hidden="true" />
              <span className="size-2 rounded-full bg-emerald-500/60" aria-hidden="true" />
              <span className="ml-2 font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                how it works
              </span>
            </div>
            <ul className="flex flex-col divide-y divide-border">
              {[
                {
                  icon: Zap,
                  title: "Laptop creates the room",
                  body: "A random 20-character room id plus a QR code and a shareable link.",
                },
                {
                  icon: KeyRound,
                  title: "Phone scans, key stays local",
                  body: "The AES-GCM key rides the link fragment, so the server only ever holds ciphertext.",
                },
                {
                  icon: RefreshCw,
                  title: "Live over WebSocket",
                  body: "Sub-second delivery, automatic reconnect, and a 2-second polling fallback.",
                },
                {
                  icon: Timer,
                  title: "Nothing outlives 24 hours",
                  body: "Messages self-destruct on the server, and Clear all wipes the room instantly.",
                },
              ].map((item) => (
                <li key={item.title} className="flex gap-3 px-3.5 py-3.5">
                  <item.icon className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden="true" />
                  <div>
                    <p className="font-heading text-[13px] text-foreground">{item.title}</p>
                    <p className="mt-1 font-geist text-[12px] leading-relaxed text-muted-foreground">
                      {item.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-4 flex items-start gap-2 font-geist text-[11px] leading-relaxed text-muted-foreground">
            <LockKeyhole className="mt-0.5 size-3 shrink-0 text-emerald-400" aria-hidden="true" />
            Anyone holding the link can read the room. Share it only with your own devices.
          </p>
        </aside>
      </main>
    </div>
  );
}
