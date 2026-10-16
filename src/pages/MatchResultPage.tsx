import { buildLiveMatchView } from "../lib/liveBoard";
import { matchPlayerStats } from "../lib/scoring";
import { useStore } from "../lib/store";
import { MatchResultView } from "./MatchResultView";

export function MatchResultPage({
  matchId,
  onBack,
  canEdit,
  onEdit,
}: {
  matchId: string;
  onBack: () => void;
  canEdit?: boolean;
  onEdit?: () => void;
}) {
  const { state } = useStore();
  const match = state.matches.find((m) => m.id === matchId);
  if (!match) return <p>Tekma ne obstaja.</p>;

  const view = buildLiveMatchView(state, match);
  const playerStats = matchPlayerStats(match, state.players);

  return (
    <MatchResultView
      view={view}
      matchId={matchId}
      onBack={onBack}
      onEdit={canEdit ? onEdit : undefined}
      playerStats={playerStats}
    />
  );
}
