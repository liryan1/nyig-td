import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { PlayerStanding, TiebreakerCriteria, Division } from '@/types';
import { Badge } from '../ui/badge';

interface DivisionGroup {
  division: Division;
  playerIds: Set<string>;
}

interface StandingsTableProps {
  standings: PlayerStanding[];
  tiebreakerOrder?: TiebreakerCriteria[];
  divisionGroups?: DivisionGroup[];
}

// Columns that can be displayed, in the order they appear in tiebreakerOrder
// HTH is pairwise and doesn't get a column
const DISPLAYABLE_COLUMNS: Record<string, { label: string; render: (s: PlayerStanding) => string }> = {
  wins: { label: 'W-L', render: (s) => `${s.wins}-${s.losses}` },
  sos: { label: 'SOS', render: (s) => s.sos.toFixed(2) },
  sds: { label: 'SDS', render: (s) => s.sds.toFixed(2) },
  sosos: { label: 'SOSOS', render: (s) => s.sosos.toFixed(2) },
};

export function StandingsTable({ standings, tiebreakerOrder, divisionGroups }: StandingsTableProps) {
  // Columns follow tiebreaker order, skipping non-displayable criteria (e.g. HTH)
  const columnsToShow = tiebreakerOrder
    ? tiebreakerOrder.filter((c) => c in DISPLAYABLE_COLUMNS)
    : (['wins', 'sos', 'sds', 'sosos'] as const);

  if (divisionGroups && divisionGroups.length > 0) {
    return (
      <div className="space-y-6">
        {divisionGroups.map((group) => {
          const divStandings = standings.filter((s) => group.playerIds.has(s.playerId));
          if (divStandings.length === 0) return null;
          return (
            <div key={group.division.id}>
              <h3 className="text-lg font-semibold mb-2">{group.division.name}</h3>
              <StandingsRows standings={divStandings} columnsToShow={columnsToShow} />
            </div>
          );
        })}
      </div>
    );
  }

  return <StandingsRows standings={standings} columnsToShow={columnsToShow} />;
}

function StandingsRows({
  standings,
  columnsToShow,
}: {
  standings: PlayerStanding[];
  columnsToShow: readonly string[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Rank</TableHead>
          <TableHead>Player</TableHead>
          {columnsToShow.map((col) => (
            <TableHead key={col} className="text-right">
              {DISPLAYABLE_COLUMNS[col].label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {standings.map((standing) => (
          <TableRow key={standing.playerId}>
            <TableCell className="font-medium">{standing.rank}</TableCell>
            <TableCell>{standing.playerName}<Badge variant="secondary" className='ml-2'>{standing.playerRank}</Badge></TableCell>
            {columnsToShow.map((col) => (
              <TableCell key={col} className="text-right text-muted-foreground">
                {DISPLAYABLE_COLUMNS[col].render(standing)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
