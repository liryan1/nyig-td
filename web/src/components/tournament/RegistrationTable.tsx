import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PlayerRegistration, Player, Division } from '@/types';

interface RegistrationTableProps {
  registrations: PlayerRegistration[];
  divisions?: Division[];
  onWithdraw: (playerId: string) => void;
  onChangeDivision?: (playerId: string, divisionId: string | null) => void;
}

export function RegistrationTable({ registrations, divisions, onWithdraw, onChangeDivision }: RegistrationTableProps) {
  const activeRegistrations = registrations.filter((r) => !r.withdrawn);
  const hasDivisions = divisions && divisions.length > 0;

  if (activeRegistrations.length === 0) {
    return <p className="text-muted-foreground">No players registered yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Rank</TableHead>
          <TableHead>Club</TableHead>
          {hasDivisions && <TableHead>Division</TableHead>}
          <TableHead>Rounds</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {activeRegistrations.map((reg) => {
          const player = reg.playerId as Player;
          const playerId = typeof reg.playerId === 'string' ? reg.playerId : player.id;

          return (
            <TableRow key={playerId}>
              <TableCell className="font-medium">
                {typeof player === 'string' ? playerId : player.name}
              </TableCell>
              <TableCell>{typeof player === 'string' ? '-' : player.rank}</TableCell>
              <TableCell className="text-muted-foreground">
                {typeof player === 'string' ? '-' : player.club || '-'}
              </TableCell>
              {hasDivisions && (
                <TableCell>
                  {onChangeDivision ? (
                    <Select
                      value={reg.divisionId ?? 'none'}
                      onValueChange={(value) =>
                        onChangeDivision(playerId, value === 'none' ? null : value)
                      }
                    >
                      <SelectTrigger className="w-32" aria-label="Division">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {divisions!.map((div) => (
                          <SelectItem key={div.id} value={div.id}>
                            {div.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-muted-foreground">
                      {reg.divisionId
                        ? divisions!.find((d) => d.id === reg.divisionId)?.name ?? '—'
                        : '—'}
                    </span>
                  )}
                </TableCell>
              )}
              <TableCell className="text-muted-foreground">
                {reg.roundsParticipating.length > 0
                  ? reg.roundsParticipating.join(', ')
                  : 'All'}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => onWithdraw(playerId)}
                >
                  Withdraw
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
