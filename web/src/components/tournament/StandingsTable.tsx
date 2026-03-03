import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { PlayerStanding } from '@/types';

interface StandingsTableProps {
  standings: PlayerStanding[];
}

export function StandingsTable({ standings }: StandingsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Rank</TableHead>
          <TableHead>Player</TableHead>
          <TableHead>Grade</TableHead>
          <TableHead className="text-right">W-L</TableHead>
          <TableHead className="text-right">SOS</TableHead>
          <TableHead className="text-right">SODOS</TableHead>
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {standings.map((standing) => (
          <TableRow key={standing.playerId}>
            <TableCell className="font-medium">{standing.rank}</TableCell>
            <TableCell>{standing.playerName}</TableCell>
            <TableCell className="text-muted-foreground">{standing.playerRank}</TableCell>
            <TableCell className="text-right">
              {standing.wins}-{standing.losses}
            </TableCell>
            <TableCell className="text-right text-muted-foreground">{standing.sos.toFixed(2)}</TableCell>
            <TableCell className="text-right text-muted-foreground">{standing.sodos.toFixed(2)}</TableCell>
            <TableCell className="text-right font-medium">{standing.totalScore.toFixed(3)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
