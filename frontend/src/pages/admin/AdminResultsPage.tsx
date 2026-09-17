/**
 * Admin Results page — final auction results with export.
 */
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Trophy, Users, Wallet } from "lucide-react";
import toast from "react-hot-toast";
import { auctionApi, getApiError, downloadBlob } from "@/services/api";
import { useActiveTournament } from "@/hooks/useActiveTournament";
import type { AuctionResults } from "@/types";
import { LoadingSpinner } from "@/components/AuctionComponents";

export default function AdminResultsPage() {
  const { tournamentId } = useActiveTournament();
  const [auctionId, setAuctionId] = useState(localStorage.getItem("flyhigh_auction_id") ?? "");

  useEffect(() => {
    if (!auctionId && tournamentId) {
      auctionApi.getActive(tournamentId).then((r) => {
        if (r.data?.id) {
          setAuctionId(r.data.id);
          localStorage.setItem("flyhigh_auction_id", r.data.id);
        }
      }).catch(() => {});
    }
  }, [auctionId, tournamentId]);

  const { data: results, isLoading } = useQuery<AuctionResults>({
    queryKey: ["results", auctionId],
    queryFn: () => auctionApi.getResults(auctionId).then((r) => r.data),
    enabled: !!auctionId,
  });

  const handleExport = async () => {
    try {
      const res = await auctionApi.exportResultsCsv(auctionId);
      downloadBlob(res.data, "auction_results.csv");
      toast.success("Results exported");
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  if (!auctionId) {
    return (
      <div className="p-8 text-center">
        <p style={{ color: "var(--color-text-muted)" }}>
          No active auction found. Please open the Live Auction page first.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 fade-in">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-gradient">Auction Results</h1>
          {results && (
            <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
              {results.tournament_name} — {results.total_players_sold} sold, {results.total_players_unsold} unsold
            </p>
          )}
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleExport}>
          <Download size={14} />
          Export CSV
        </button>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : results ? (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="stat-card">
              <div className="flex items-center gap-2 mb-2">
                <Trophy size={18} style={{ color: "#f59e0b" }} />
                <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>Players Sold</span>
              </div>
              <p className="text-3xl font-black">{results.total_players_sold}</p>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-2 mb-2">
                <Users size={18} style={{ color: "#ef4444" }} />
                <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>Unsold</span>
              </div>
              <p className="text-3xl font-black">{results.total_players_unsold}</p>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-2 mb-2">
                <Wallet size={18} style={{ color: "#10b981" }} />
                <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>Total Spent</span>
              </div>
              <p className="text-3xl font-black" style={{ color: "#10b981" }}>
                ₹{results.teams.reduce((s, t) => s + t.total_spent, 0).toLocaleString("en-IN")}
              </p>
            </div>
          </div>

          {/* Teams */}
          {results.teams.map((team) => (
            <div key={team.team_id} className="glass-card-elevated p-5">
              <div className="flex items-center gap-4 mb-4">
                <div
                  className="flex items-center justify-center rounded-xl font-black text-xl"
                  style={{ width: 48, height: 48, background: "linear-gradient(135deg, #3b82f6, #6366f1)", color: "white" }}
                >
                  {team.team_name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-black text-lg">{team.team_name}</h3>
                  <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                    {team.players_purchased} players · ₹{team.total_spent.toLocaleString("en-IN")} spent · ₹{team.remaining_purse.toLocaleString("en-IN")} remaining
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {team.players.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3 rounded-xl"
                    style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}
                  >
                    <p className="font-semibold text-sm">
                      {entry.player?.name ?? entry.player_id.slice(0, 8)}
                    </p>
                    <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                      {entry.player?.category ?? ""}
                    </p>
                    <p className="text-sm font-bold mt-1" style={{ color: "#fbbf24" }}>
                      ₹{entry.sold_price.toLocaleString("en-IN")}
                    </p>
                  </div>
                ))}
                {team.players.length === 0 && (
                  <p className="text-sm col-span-full" style={{ color: "var(--color-text-muted)" }}>
                    No players acquired
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12" style={{ color: "var(--color-text-muted)" }}>
          No results available
        </div>
      )}
    </div>
  );
}
