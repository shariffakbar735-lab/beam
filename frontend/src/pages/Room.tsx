import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import DeviceLabelDialog from "@/components/DeviceLabelDialog";
import HeaderHUD from "@/components/HeaderHUD";
import MessageComposer from "@/components/MessageComposer";
import MessageStream from "@/components/MessageStream";
import PairingPanel from "@/components/PairingPanel";
import SecurityNoticeBar from "@/components/SecurityNoticeBar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBeamRoom, type BeamThreadMessage } from "@/hooks/useBeamRoom";
import { useClipboardCopied, useIsWideLayout } from "@/hooks/useMediaQuery";
import {
  bootstrapRoomSession,
  clearSession,
  copyOrThrow,
  loadAutoCopy,
  normaliseLabel,
  roomLink,
  roomPath,
  saveAutoCopy,
  saveSession,
  type BeamSession,
} from "@/lib/beam";
import { usePwaInstall } from "@/lib/pwa";

export default function Room() {
  const { roomId: roomIdParam = "" } = useParams();
  const roomId = roomIdParam.toUpperCase();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const wide = useIsWideLayout();
  const { canInstall, promptInstall } = usePwaInstall();
  const { copiedKey, flag } = useClipboardCopied();

  // Idempotent under StrictMode: a scanned link wins, otherwise the remembered room.
  const [boot] = useState(() => bootstrapRoomSession(roomId));
  const [session, setSession] = useState<BeamSession | null>(boot.session);
  const [autoCopy, setAutoCopy] = useState(() => loadAutoCopy());
  const [labelOpen, setLabelOpen] = useState(false);
  const [pairingOpen, setPairingOpen] = useState(false);

  const controller = useBeamRoom(roomId, session, autoCopy);
  const {
    messages,
    send,
    sending,
    clearAll,
    clearing,
    connection,
    peerOnline,
    roomMissing,
    historyUnreachable,
    messagesLoading,
    sendError,
  } = controller;

  const deviceLabel = session?.deviceLabel ?? "This device";
  const link = session ? roomLink(session.roomId, session.key) : "";

  const peerLabel = useMemo(() => {
    let label: string | null = null;
    for (const message of messages) {
      if (!message.mine) label = message.deviceLabel;
    }
    return label;
  }, [messages]);

  const handleCopyMessage = useCallback(
    async (message: BeamThreadMessage) => {
      if (!message.text) return;
      try {
        await copyOrThrow(message.text);
        flag(message.id);
      } catch {
        toast.error("Clipboard is blocked here");
      }
    },
    [flag],
  );

  const handleCopyLink = useCallback(async () => {
    if (!link) return;
    try {
      await copyOrThrow(link);
      flag("link");
      toast.success("Pairing link copied");
    } catch {
      toast.error("Clipboard is blocked here");
    }
  }, [link, flag]);

  const handleToggleAutoCopy = useCallback((next: boolean) => {
    setAutoCopy(next);
    saveAutoCopy(next);
    toast(next ? "Auto-copy incoming text is on" : "Auto-copy incoming text is off");
  }, []);

  const handleSaveLabel = useCallback(
    (next: string) => {
      if (!session) return;
      const updated: BeamSession = { ...session, deviceLabel: normaliseLabel(next) };
      setSession(updated);
      saveSession(updated);
      setLabelOpen(false);
      toast.success(`This device now signs as "${updated.deviceLabel}"`);
    },
    [session],
  );

  const handleUnpair = useCallback(() => {
    clearSession();
    // Drop this room's cached messages too, so nothing leaks into the next session.
    queryClient.clear();
    navigate("/", { replace: true });
  }, [navigate, queryClient]);

  const handleClearAll = useCallback(() => {
    clearAll();
  }, [clearAll]);

  if (!session) {
    return (
      <div className="beam-grid flex min-h-[100dvh] flex-col bg-background">
        <HeaderHUD
          roomId={roomId}
          connection="connecting"
          peerOnline={false}
          peerLabel={null}
          deviceLabel="This device"
          autoCopy={autoCopy}
          clearing={false}
          linkCopied={false}
          layout={wide ? "wide" : "narrow"}
          onEditLabel={() => undefined}
          onToggleAutoCopy={handleToggleAutoCopy}
          onCopyLink={() => undefined}
          onShowPairing={() => undefined}
          onClearAll={() => undefined}
          onUnpair={handleUnpair}
        />
        <div className="flex flex-1 items-center justify-center px-5 py-10">
          <div className="w-full max-w-md rounded-xl border border-border bg-[#0e1017] p-6">
            <ShieldAlert className="size-5 text-amber-400" aria-hidden="true" />
            <h1 className="mt-3 font-heading text-lg text-foreground">
              This device has no key for the room
            </h1>
            <p className="mt-2 font-geist text-[13px] leading-relaxed text-muted-foreground">
              Beam keeps the decryption key in the link fragment after the <code>#</code>, so the
              server cannot hand it back. Open the full pairing link from your other device, or
              scan its QR code.
            </p>
            <p className="mt-3 font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
              room {roomId}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {boot.otherRoomId ? (
                <Button
                  type="button"
                  size="sm"
                  data-testid="back-to-my-room-button"
                  className="gap-1.5"
                  onClick={() => navigate(roomPath(boot.otherRoomId ?? ""))}
                >
                  <KeyRound className="size-3.5" aria-hidden="true" />
                  Go to my room
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  data-testid="missing-key-start-room-button"
                  className="gap-1.5"
                  onClick={() => navigate("/")}
                >
                  <KeyRound className="size-3.5" aria-hidden="true" />
                  Create a room
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const pairingPanel = (
    <PairingPanel
      roomId={roomId}
      link={link}
      linkCopied={copiedKey === "link"}
      canInstall={canInstall}
      onCopyLink={handleCopyLink}
      onInstall={promptInstall}
    />
  );

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      <HeaderHUD
        roomId={roomId}
        connection={connection}
        peerOnline={peerOnline}
        peerLabel={peerLabel}
        deviceLabel={deviceLabel}
        autoCopy={autoCopy}
        clearing={clearing}
        linkCopied={copiedKey === "link"}
        layout={wide ? "wide" : "narrow"}
        onEditLabel={() => setLabelOpen(true)}
        onToggleAutoCopy={handleToggleAutoCopy}
        onCopyLink={handleCopyLink}
        onShowPairing={() => setPairingOpen(true)}
        onClearAll={handleClearAll}
        onUnpair={handleUnpair}
      />

      <main className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-12">
        {wide && (
          <aside className="beam-grid hidden border-r border-border bg-[#0e1017] md:col-span-4 md:flex md:min-h-0 xl:col-span-3">
            {pairingPanel}
          </aside>
        )}

        <section className="flex min-h-0 flex-1 flex-col md:col-span-8 xl:col-span-9">
          <SecurityNoticeBar />
          <MessageStream
            messages={messages}
            loading={messagesLoading}
            unreachable={historyUnreachable}
            copiedId={copiedKey}
            onCopy={handleCopyMessage}
          />
          {sendError && (
            <p className="shrink-0 border-t border-red-500/30 bg-red-500/5 px-3.5 py-2 text-[11px] text-red-300 sm:px-5">
              {sendError}
            </p>
          )}
          {roomMissing && (
            <p
              data-testid="room-missing-notice"
              className="shrink-0 border-t border-amber-500/30 bg-amber-500/5 px-3.5 py-2 text-[11px] text-amber-200 sm:px-5"
            >
              The relay has no record of room {roomId} — it may have expired. Unpair to start a new
              one.
            </p>
          )}
          <MessageComposer onSend={send} sending={sending} disabled={roomMissing} />
        </section>
      </main>

      {!wide && (
        <Dialog open={pairingOpen} onOpenChange={setPairingOpen}>
          <DialogContent
            showCloseButton
            className="max-h-[86dvh] gap-0 overflow-hidden border border-border bg-[#0e1017] p-0 sm:max-w-md"
          >
            <DialogHeader className="sr-only">
              <DialogTitle>Pairing QR and link</DialogTitle>
              <DialogDescription>
                Scan this code with your other device, or copy the shareable link.
              </DialogDescription>
            </DialogHeader>
            {pairingPanel}
          </DialogContent>
        </Dialog>
      )}

      <DeviceLabelDialog
        open={labelOpen}
        value={deviceLabel}
        onOpenChange={setLabelOpen}
        onSave={handleSaveLabel}
      />
    </div>
  );
}
