import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { tournamentApi } from "@/services/api";
import type { Tournament } from "@/types";

export const TOURNAMENT_STORAGE_KEY = "flyhigh_tournament_id";

export function useActiveTournament() {
  const queryClient = useQueryClient();
  const [tournamentId, setStoredTournamentId] = useState<string>(
    () => localStorage.getItem(TOURNAMENT_STORAGE_KEY) || ""
  );

  const { data: tournaments = [], isLoading } = useQuery<Tournament[]>({
    queryKey: ["tournaments_list"],
    queryFn: () => tournamentApi.list().then((r) => r.data),
    staleTime: 30_000,
  });

  // If no tournamentId in localStorage, auto-select the first tournament
  useEffect(() => {
    if (tournaments.length > 0) {
      const currentStored = localStorage.getItem(TOURNAMENT_STORAGE_KEY) || "";
      const exists = tournaments.some((t) => t.id === currentStored);
      if (!currentStored || !exists) {
        const defaultId = tournaments[0].id;
        localStorage.setItem(TOURNAMENT_STORAGE_KEY, defaultId);
        setStoredTournamentId(defaultId);
      }
    }
  }, [tournaments]);

  // Listen for storage or custom events
  useEffect(() => {
    const handleStorage = () => {
      const current = localStorage.getItem(TOURNAMENT_STORAGE_KEY) || "";
      setStoredTournamentId(current);
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("flyhigh_tournament_changed", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("flyhigh_tournament_changed", handleStorage);
    };
  }, []);

  const setTournamentId = useCallback(
    (id: string) => {
      setStoredTournamentId(id);
      localStorage.setItem(TOURNAMENT_STORAGE_KEY, id);
      window.dispatchEvent(new Event("flyhigh_tournament_changed"));
      queryClient.invalidateQueries({ queryKey: ["tournaments_list"] });
    },
    [queryClient]
  );

  const activeTournament = tournaments.find((t) => t.id === tournamentId) ?? tournaments[0] ?? null;

  return {
    tournamentId: activeTournament?.id || tournamentId,
    tournament: activeTournament,
    tournaments,
    isLoading,
    setTournamentId,
  };
}
