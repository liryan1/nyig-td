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
          <TableHead className="text-right">SDS</TableHead>
          <TableHead className="text-right">SOSOS</TableHead>
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
            <TableCell className="text-right text-muted-foreground">{standing.sds.toFixed(2)}</TableCell>
            <TableCell className="text-right text-muted-foreground">{standing.sosos.toFixed(2)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
