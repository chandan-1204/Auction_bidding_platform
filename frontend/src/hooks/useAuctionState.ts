/**
 * Auction real-time state hook.
 * Combines REST polling with Socket.IO live updates.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { auctionApi } from "@/services/api";
import { getSocket, getRemainingSeconds, joinAuction, leaveAuction } from "@/services/socket";
import type { AuctionStateOut, Bid, Team } from "@/types";

interface UseAuctionStateOptions {
  auctionId: string | null;
}

export function useAuctionState({ auctionId }: UseAuctionStateOptions) {
  const [state, setState] = useState<AuctionStateOut | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial state
  const fetchState = useCallback(async () => {
    if (!auctionId) return;
    try {
      const [stateRes, bidsRes] = await Promise.all([
        auctionApi.getState(auctionId),
        auctionApi.getBids(auctionId, 20),
      ]);
      setState(stateRes.data);
      setBids(bidsRes.data);
    } catch (err) {
      console.error("Failed to fetch auction state:", err);
    } finally {
      setLoading(false);
    }
  }, [auctionId]);

  // Timer tick — recomputes from server end timestamp every second
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (state?.state === "LIVE" && state?.timer_end_at) {
      timerRef.current = setInterval(() => {
        setSecondsLeft(getRemainingSeconds(state.timer_end_at));
      }, 500);
    } else {
      setSecondsLeft(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state?.state, state?.timer_end_at]);

  // Socket.IO live updates
  useEffect(() => {
    if (!auctionId) return;

    fetchState();

    const socket = getSocket();
    joinAuction(auctionId);

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("joined", () => setConnected(true));

    socket.on("auction:state", (data: AuctionStateOut) => {
      setState(data);
    });

    socket.on("auction:bid", (bid: Bid) => {
      setBids((prev) => [bid, ...prev.slice(0, 49)]);
    });

    socket.on("auction:sold", (data: AuctionStateOut) => {
      setState(data);
    });

    socket.on("auction:unsold", (data: AuctionStateOut) => {
      setState(data);
    });

    socket.on("auction:next_player", (data: AuctionStateOut) => {
      setState(data);
    });

    socket.on("auction:paused", (data: AuctionStateOut) => {
      setState(data);
    });

    socket.on("auction:resumed", (data: AuctionStateOut) => {
      setState(data);
    });

    socket.on("auction:completed", (data: AuctionStateOut) => {
      setState(data);
    });

    socket.on("team:purse_updated", (team: Team) => {
      setTeams((prev) =>
        prev.map((t) => (t.id === team.id ? team : t))
      );
    });

    // Check initial connected state
    setConnected(socket.connected);

    return () => {
      leaveAuction(auctionId);
      socket.off("connect");
      socket.off("disconnect");
      socket.off("joined");
      socket.off("auction:state");
      socket.off("auction:bid");
      socket.off("auction:sold");
      socket.off("auction:unsold");
      socket.off("auction:next_player");
      socket.off("auction:paused");
      socket.off("auction:resumed");
      socket.off("auction:completed");
      socket.off("team:purse_updated");
    };
  }, [auctionId, fetchState]);

  return { state, bids, teams, setTeams, connected, loading, secondsLeft, refetch: fetchState };
}
