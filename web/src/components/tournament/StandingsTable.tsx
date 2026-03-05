import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { PlayerStanding, TiebreakerCriteria } from '@/types';
import { Badge } from '../ui/badge';

interface StandingsTableProps {
  standings: PlayerStanding[];
  tiebreakerOrder?: TiebreakerCriteria[];
}

const STAT_COLUMNS: Record<string, { label: string; key: keyof PlayerStanding }> = {
  sos: { label: 'SOS', key: 'sos' },
  sds: { label: 'SDS', key: 'sds' },
  sosos: { label: 'SOSOS', key: 'sosos' },
};

export function StandingsTable({ standings, tiebreakerOrder }: StandingsTableProps) {
  // Determine which stat columns to show based on tiebreakerOrder
  // HTH is pairwise and doesn't get a column
  const statColumnsToShow = tiebreakerOrder
    ? tiebreakerOrder.filter((c): c is 'sos' | 'sds' | 'sosos' => c in STAT_COLUMNS)
    : (['sos', 'sds', 'sosos'] as const);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Rank</TableHead>
          <TableHead>Player</TableHead>
          <TableHead className="text-right">W-L</TableHead>
          {statColumnsToShow.map((col) => (
            <TableHead key={col} className="text-right">
              {STAT_COLUMNS[col].label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {standings.map((standing) => (
          <TableRow key={standing.playerId}>
            <TableCell className="font-medium">{standing.rank}</TableCell>
            <TableCell>{standing.playerName}<Badge variant="secondary" className='ml-2'>{standing.playerRank}</Badge></TableCell>
            <TableCell className="text-right">
              {standing.wins}-{standing.losses}
            </TableCell>
            {statColumnsToShow.map((col) => (
              <TableCell key={col} className="text-right text-muted-foreground">
                {(standing[STAT_COLUMNS[col].key] as number).toFixed(2)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
