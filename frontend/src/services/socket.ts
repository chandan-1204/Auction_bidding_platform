/**
 * Socket.IO client singleton for the FlyHigh auction platform.
 *
 * Architecture:
 * - Single socket per browser session
 * - Auth token sent in handshake
 * - Server provides authoritative timer end timestamp
 * - Clients calculate remaining time from server timestamp
 */
import { io, Socket } from "socket.io-client";

const WS_URL = import.meta.env.VITE_WS_URL || "";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = localStorage.getItem("flyhigh_token");
    socket = io(WS_URL, {
      path: "/socket.io",
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    socket.on("connect", () => {
      console.log("[Socket] Connected:", socket?.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
      console.error("[Socket] Connection error:", err.message);
    });
  }
  return socket;
}

export function joinAuction(auctionId: string) {
  const s = getSocket();
  s.emit("join_auction", { auction_id: auctionId });
}

export function leaveAuction(auctionId: string) {
  const s = getSocket();
  s.emit("leave_auction", { auction_id: auctionId });
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function reconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  return getSocket();
}

/**
 * Calculate remaining seconds from a server-provided end timestamp.
 * This is the canonical way to compute the timer — never trust client-side timers.
 */
export function getRemainingSeconds(timerEndAt: string | null): number {
  if (!timerEndAt) return 0;
  const end = new Date(timerEndAt).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((end - now) / 1000));
}
