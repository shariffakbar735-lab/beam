import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";

import { ApiError, apiDelete, apiGet, apiPost } from "@/lib/api";
import {
  MESSAGE_MAX_LENGTH,
  copySilently,
  mergeMessages,
  type BeamClearResult,
  type BeamMessage,
  type BeamPresence,
  type BeamRoom,
  type BeamSession,
} from "@/lib/beam";
import { decryptText, encryptText } from "@/lib/crypto";
import { openRoomSocket, type SocketStatus } from "@/lib/socket";

export type ConnectionState = "connecting" | "live" | "polling";

export interface BeamThreadMessage {
  id: string;
  senderId: string;
  deviceLabel: string;
  createdAt: string;
  mine: boolean;
  /** null when the payload could not be opened (different key / not ours). */
  text: string | null;
  decrypted: boolean;
}

export interface BeamRoomController {
  room: BeamRoom | undefined;
  roomMissing: boolean;
  messages: BeamThreadMessage[];
  messagesLoading: boolean;
  historyUnreachable: boolean;
  connection: ConnectionState;
  peerOnline: boolean;
  send: (text: string) => void;
  sending: boolean;
  sendError: string | null;
  clearAll: () => void;
  clearing: boolean;
  clearError: string | null;
}

function describeError(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError) {
    if (error.status === 404) return "This room no longer exists on the server.";
    if (error.status === 422) return "That message was rejected — it may be too long.";
    return `The relay refused the request (${error.status}).`;
  }
  if (error instanceof Error) {
    if (error.message.includes("no encryption key")) return "This device has no key for the room.";
    return error.message;
  }
  return "Something went wrong.";
}

/**
 * Owns one room: history query, realtime socket (with a 2 s polling fallback),
 * presence, decryption, and the send/clear mutations.
 */
export function useBeamRoom(
  roomId: string,
  session: BeamSession | null,
  autoCopy: boolean,
): BeamRoomController {
  const queryClient = useQueryClient();
  const deviceId = session?.deviceId ?? "";
  const key = session?.key ?? null;

  const roomKey = useMemo<QueryKey>(() => ["beam", "room", roomId], [roomId]);
  const messagesKey = useMemo<QueryKey>(() => ["beam", "messages", roomId], [roomId]);
  const presenceKey = useMemo<QueryKey>(() => ["beam", "presence", roomId, deviceId], [roomId, deviceId]);

  const [socketStatus, setSocketStatus] = useState<SocketStatus>("connecting");
  const [liveMessages, setLiveMessages] = useState<BeamMessage[]>([]);
  const [plaintext, setPlaintext] = useState<Record<string, string | null>>({});

  useEffect(() => {
    setLiveMessages([]);
    setPlaintext({});
    setSocketStatus("connecting");
  }, [roomId]);

  const connection: ConnectionState =
    socketStatus === "open" ? "live" : socketStatus === "failed" ? "polling" : "connecting";

  const roomQuery = useQuery({
    queryKey: roomKey,
    queryFn: () => apiGet<BeamRoom>(`/rooms/${roomId}`),
    enabled: Boolean(roomId),
    retry: 1,
  });

  const messagesQuery = useQuery({
    queryKey: messagesKey,
    queryFn: () => apiGet<BeamMessage[]>(`/rooms/${roomId}/messages`),
    enabled: Boolean(roomId),
    // Socket-first: polling runs only while the socket is missing or down.
    refetchInterval: connection === "live" ? false : 2000,
    refetchIntervalInBackground: true,
    retry: 1,
  });

  const presenceQuery = useQuery({
    queryKey: presenceKey,
    queryFn: () =>
      apiGet<BeamPresence>(`/rooms/${roomId}/presence?device_id=${encodeURIComponent(deviceId)}`),
    enabled: Boolean(roomId) && Boolean(deviceId),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    retry: 1,
  });

  useEffect(() => {
    if (!roomId || !deviceId) return;
    const socket = openRoomSocket({
      roomId,
      deviceId,
      onStatus: setSocketStatus,
      onEvent: (event) => {
        if (typeof event !== "object" || event === null) return;
        const payload = event as Record<string, unknown>;

        if (payload.type === "message") {
          const message = payload.message as BeamMessage | undefined;
          if (!message || typeof message.id !== "string") return;
          setLiveMessages((prev) =>
            prev.some((existing) => existing.id === message.id) ? prev : [...prev, message],
          );
          return;
        }

        if (payload.type === "cleared") {
          setLiveMessages([]);
          queryClient.setQueryData<BeamMessage[]>(messagesKey, []);
          return;
        }

        if (payload.type === "presence") {
          const ids = Array.isArray(payload.device_ids)
            ? payload.device_ids.filter((value): value is string => typeof value === "string")
            : [];
          queryClient.setQueryData<BeamPresence>(presenceKey, {
            room_id: roomId,
            online_device_ids: ids,
            peer_online: ids.some((id) => id !== deviceId),
          });
        }
      },
    });
    return () => socket.close();
  }, [roomId, deviceId, messagesKey, presenceKey, queryClient]);

  const messages = useMemo(
    () => mergeMessages(messagesQuery.data ?? [], liveMessages),
    [messagesQuery.data, liveMessages],
  );

  // Decrypt only what we have not opened yet — the key never leaves this function's scope.
  useEffect(() => {
    if (!key) return;
    const pending = messages.filter((message) => !(message.id in plaintext));
    if (pending.length === 0) return;

    let cancelled = false;
    void (async () => {
      const opened: Record<string, string | null> = {};
      for (const message of pending) {
        try {
          opened[message.id] = await decryptText({ iv: message.iv, ciphertext: message.ciphertext }, key);
        } catch {
          opened[message.id] = null;
        }
      }
      if (!cancelled && Object.keys(opened).length > 0) {
        setPlaintext((prev) => ({ ...prev, ...opened }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [messages, key, plaintext]);

  const thread = useMemo<BeamThreadMessage[]>(
    () =>
      messages.map((message) => {
        const text = plaintext[message.id];
        return {
          id: message.id,
          senderId: message.sender_id,
          deviceLabel: message.device_label,
          createdAt: message.created_at,
          mine: Boolean(deviceId) && message.sender_id === deviceId,
          text: typeof text === "string" ? text : null,
          decrypted: message.id in plaintext && typeof text === "string",
        };
      }),
    [messages, plaintext, deviceId],
  );

  // Auto-copy incoming text: only messages that land while we are watching, never the backlog.
  const seenIds = useRef<Set<string>>(new Set());
  const mountedAt = useRef<number>(Date.now());

  useEffect(() => {
    const fresh = messages.filter((message) => !seenIds.current.has(message.id));
    if (fresh.length === 0) return;
    for (const message of fresh) seenIds.current.add(message.id);
    if (!autoCopy) return;
    for (const message of fresh) {
      if (message.sender_id === deviceId) continue;
      if (new Date(message.created_at).getTime() < mountedAt.current) continue;
      const text = plaintext[message.id];
      if (typeof text === "string" && text.length > 0) copySilently(text);
    }
  }, [messages, plaintext, autoCopy, deviceId]);

  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!key || !deviceId || !session) throw new Error("This device has no encryption key for the room.");
      const sealed = await encryptText(text, key);
      return apiPost<BeamMessage>(`/rooms/${roomId}/messages`, {
        sender_id: deviceId,
        device_label: session.deviceLabel,
        iv: sealed.iv,
        ciphertext: sealed.ciphertext,
      });
    },
    onSuccess: (message) => {
      setLiveMessages((prev) =>
        prev.some((existing) => existing.id === message.id) ? prev : [...prev, message],
      );
      void queryClient.invalidateQueries({ queryKey: messagesKey });
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => apiDelete<BeamClearResult>(`/rooms/${roomId}/messages`),
    onSuccess: () => {
      setLiveMessages([]);
      queryClient.setQueryData<BeamMessage[]>(messagesKey, []);
      void queryClient.invalidateQueries({ queryKey: messagesKey });
    },
  });

  const { mutate: sendMessage } = sendMutation;
  const { mutate: clearMessages } = clearMutation;

  const send = useCallback(
    (text: string) => {
      if (!text.trim() || text.length > MESSAGE_MAX_LENGTH) return;
      sendMessage(text);
    },
    [sendMessage],
  );

  const clearAll = useCallback(() => clearMessages(), [clearMessages]);

  return {
    room: roomQuery.data,
    roomMissing: roomQuery.error instanceof ApiError && roomQuery.error.status === 404,
    messages: thread,
    messagesLoading: messagesQuery.isLoading,
    historyUnreachable: messagesQuery.isError,
    connection,
    peerOnline: presenceQuery.data?.peer_online ?? false,
    send,
    sending: sendMutation.isPending,
    sendError: sendMutation.isError ? describeError(sendMutation.error) : null,
    clearAll,
    clearing: clearMutation.isPending,
    clearError: clearMutation.isError ? describeError(clearMutation.error) : null,
  };
}
