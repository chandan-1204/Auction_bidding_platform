/**
 * Admin Bid History page — full audit trail of all bids.
 */
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Filter } from "lucide-react";
import { auctionApi } from "@/services/api";
import { useActiveTournament } from "@/hooks/useActiveTournament";
import type { Bid } from "@/types";
import { LoadingSpinner } from "@/components/AuctionComponents";

const AUCTION_KEY = "flyhigh_auction_id";

export default function AdminHistoryPage() {
  const { tournamentId } = useActiveTournament();
  const [auctionId, setAuctionId] = useState(localStorage.getItem(AUCTION_KEY) ?? "");

  useEffect(() => {
    if (!auctionId && tournamentId) {
      auctionApi.getActive(tournamentId).then((r) => {
        if (r.data?.id) {
          setAuctionId(r.data.id);
          localStorage.setItem(AUCTION_KEY, r.data.id);
        }
      }).catch(() => {});
    }
  }, [auctionId, tournamentId]);

  const { data: bids = [], isLoading } = useQuery<Bid[]>({
    queryKey: ["bids", auctionId],
    queryFn: () => auctionApi.getBids(auctionId, 200).then((r) => r.data),
    enabled: !!auctionId,
    refetchInterval: 5000,
  });

  if (!auctionId) {
    return (
      <div className="p-8 text-center">
        <p style={{ color: "var(--color-text-muted)" }}>
          No active auction found. Go to the Auction page first.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gradient">Bid History</h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
          Complete audit trail — {bids.length} bids recorded
        </p>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                {["#", "Player", "Team", "Amount", "Time", "Status"].map((h) => (
                  <th
                    key={h}
                    className="text-left p-4 text-xs font-semibold"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bids.map((bid) => (
                <tr
                  key={bid.id}
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                >
                  <td className="p-4 text-sm" style={{ color: "var(--color-text-muted)" }}>
                    {bid.sequence_number}
                  </td>
                  <td className="p-4 text-sm font-semibold">
                    {bid.player_name ?? bid.player_id.slice(0, 8)}
                  </td>
                  <td className="p-4 text-sm">
                    {bid.team_name ?? bid.team_id.slice(0, 8)}
                  </td>
                  <td className="p-4 text-sm font-bold" style={{ color: "#fbbf24" }}>
                    ₹{bid.amount.toLocaleString("en-IN")}
                  </td>
                  <td className="p-4 text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {new Date(bid.placed_at).toLocaleTimeString()}
                  </td>
                  <td className="p-4">
                    <span className={`badge ${bid.is_accepted ? "badge-green" : "badge-red"}`}>
                      {bid.is_accepted ? "Accepted" : bid.rejection_reason ?? "Rejected"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {bids.length === 0 && (
            <div className="text-center py-12" style={{ color: "var(--color-text-muted)" }}>
              No bids recorded yet
            </div>
          )}
        </div>
      )}
    </div>
  );
}
