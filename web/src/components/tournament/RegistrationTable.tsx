import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import type { PlayerRegistration, Player, Division, Round, TournamentStatus } from '@/types';

export type BulkUpdate = {
  playerId: string;
  roundsParticipating?: number[];
  checkedIn?: boolean;
  withdrawn?: boolean;
};

interface RegistrationTableProps {
  registrations: PlayerRegistration[];
  divisions?: Division[];
  numRounds?: number;
  rounds?: Round[];
  tournamentStatus?: TournamentStatus;
  onChangeDivision?: (playerId: string, divisionId: string | null) => void;
  onSave?: (changes: BulkUpdate[]) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  isSaving?: boolean;
}

function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function RegistrationTable({
  registrations,
  divisions,
  numRounds,
  rounds,
  tournamentStatus,
  onChangeDivision,
  onSave,
  onDirtyChange,
  isSaving,
}: RegistrationTableProps) {
  const activeRegistrations = registrations.filter((r) => !r.withdrawn);
  const hasDivisions = divisions && divisions.length > 0;
  const hasRoundEditing = numRounds != null && numRounds > 0 && onSave;

  const pairedPlayerIds = new Set(
    (rounds ?? []).flatMap((round) => [
      ...round.pairings.flatMap((p) => [p.blackPlayerId, p.whitePlayerId]),
      ...round.byes.map((b) => b.playerId),
    ])
  );

  const checkInDisabled = tournamentStatus != null && tournamentStatus !== 'registration';

  const [roundOverrides, setRoundOverrides] = useState<Map<string, number[]>>(new Map());
  const [checkInOverrides, setCheckInOverrides] = useState<Map<string, boolean>>(new Map());
  const [withdrawOverrides, setWithdrawOverrides] = useState<Set<string>>(new Set());

  const isDirty = roundOverrides.size > 0 || checkInOverrides.size > 0 || withdrawOverrides.size > 0;

  // Notify parent of dirty state changes
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Clear overrides when server data changes (after successful save)
  const serverFingerprint = registrations
    .map((r) => {
      const pid = typeof r.playerId === 'string' ? r.playerId : r.playerId.id;
      return `${pid}:${r.roundsParticipating.join(',')}:${r.checkedIn ? '1' : '0'}:${r.withdrawn ? '1' : '0'}`;
    })
    .join('|');

  const [prevFingerprint, setPrevFingerprint] = useState(serverFingerprint);
  if (serverFingerprint !== prevFingerprint) {
    setPrevFingerprint(serverFingerprint);
    setRoundOverrides(new Map());
    setCheckInOverrides(new Map());
    setWithdrawOverrides(new Set());
  }

  // beforeunload warning when dirty
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const toggleRound = useCallback(
    (playerId: string, round: number, serverRounds: number[], allRounds: number[]) => {
      setRoundOverrides((prev) => {
        const next = new Map(prev);
        const current = next.get(playerId) ?? (serverRounds.length === 0 ? [...allRounds] : [...serverRounds]);
        const idx = current.indexOf(round);
        let updated: number[];
        if (idx >= 0) {
          updated = current.filter((r) => r !== round);
        } else {
          updated = [...current, round].sort((a, b) => a - b);
        }

        // Normalize: if all rounds checked, use [] (API convention)
        const normalized = arraysEqual(updated, allRounds) ? [] : updated;
        const serverNormalized = serverRounds.length === 0 ? [] : serverRounds;

        // If result matches server state, remove override
        if (arraysEqual(normalized, serverNormalized)) {
          next.delete(playerId);
        } else {
          next.set(playerId, normalized);
        }
        return next;
      });
    },
    []
  );

  const toggleCheckIn = useCallback(
    (playerId: string, serverCheckedIn: boolean) => {
      setCheckInOverrides((prev) => {
        const next = new Map(prev);
        const current = next.has(playerId) ? next.get(playerId)! : serverCheckedIn;
        const newValue = !current;
        // If toggling back to server state, remove override
        if (newValue === serverCheckedIn) {
          next.delete(playerId);
        } else {
          next.set(playerId, newValue);
        }
        return next;
      });
    },
    []
  );

  const toggleWithdraw = useCallback(
    (playerId: string) => {
      setWithdrawOverrides((prev) => {
        const next = new Set(prev);
        if (next.has(playerId)) {
          next.delete(playerId);
        } else {
          next.add(playerId);
        }
        return next;
      });
    },
    []
  );

  const handleSave = () => {
    if (!onSave) return;
    const changes: BulkUpdate[] = [];

    // Collect round overrides
    for (const [playerId, roundsParticipating] of roundOverrides) {
      changes.push({ playerId, roundsParticipating });
    }

    // Collect check-in overrides
    for (const [playerId, checkedIn] of checkInOverrides) {
      const existing = changes.find((c) => c.playerId === playerId);
      if (existing) {
        existing.checkedIn = checkedIn;
      } else {
        changes.push({ playerId, checkedIn });
      }
    }

    // Collect withdraw overrides
    for (const playerId of withdrawOverrides) {
      const existing = changes.find((c) => c.playerId === playerId);
      if (existing) {
        existing.withdrawn = true;
      } else {
        changes.push({ playerId, withdrawn: true });
      }
    }

    onSave(changes);
  };

  const handleDiscard = () => {
    setRoundOverrides(new Map());
    setCheckInOverrides(new Map());
    setWithdrawOverrides(new Set());
  };

  // Filter out players pending withdrawal for display
  const visibleRegistrations = activeRegistrations.filter((r) => {
    const playerId = typeof r.playerId === 'string' ? r.playerId : (r.playerId as Player).id;
    return !withdrawOverrides.has(playerId);
  });

  if (visibleRegistrations.length === 0 && withdrawOverrides.size === 0) {
    return <p className="text-muted-foreground">No players registered yet.</p>;
  }

  const allRounds = hasRoundEditing
    ? Array.from({ length: numRounds }, (_, i) => i + 1)
    : [];

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            {onSave && <TableHead className="w-20">Check-In</TableHead>}
            <TableHead>Name</TableHead>
            <TableHead>Rank</TableHead>
            <TableHead>Club</TableHead>
            {hasDivisions && <TableHead>Division</TableHead>}
            <TableHead>Rounds</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleRegistrations.map((reg) => {
            const player = reg.playerId as Player;
            const playerId = typeof reg.playerId === 'string' ? reg.playerId : player.id;
            const serverRounds = reg.roundsParticipating;
            const effectiveRounds = roundOverrides.has(playerId)
              ? roundOverrides.get(playerId)!
              : serverRounds;
            const effectiveCheckedIn = checkInOverrides.has(playerId)
              ? checkInOverrides.get(playerId)!
              : reg.checkedIn;

            return (
              <TableRow key={playerId}>
                {onSave && (
                  <TableCell>
                    <Checkbox
                      checked={effectiveCheckedIn}
                      onCheckedChange={() =>
                        toggleCheckIn(playerId, reg.checkedIn)
                      }
                      disabled={reg.checkedIn && (isSaving || checkInDisabled)}
                      aria-label={`Check in ${typeof player === 'string' ? playerId : player.name}`}
                    />
                  </TableCell>
                )}
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
                        <SelectTrigger className="w-32 h-7" aria-label="Division">
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
                <TableCell>
                  {hasRoundEditing ? (
                    <div className="flex gap-2">
                      {allRounds.map((round) => {
                        const isChecked =
                          effectiveRounds.length === 0
                            ? true
                            : effectiveRounds.includes(round);
                        return (
                          <label key={round} className="flex items-center gap-1 text-sm">
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() =>
                                toggleRound(playerId, round, serverRounds, allRounds)
                              }
                              disabled={isSaving}
                              aria-label={`R${round} for ${typeof player === 'string' ? playerId : player.name}`}
                            />
                            R{round}
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">
                      {reg.roundsParticipating.length > 0
                        ? reg.roundsParticipating.join(', ')
                        : 'All'}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => toggleWithdraw(playerId)}
                    disabled={isSaving || pairedPlayerIds.has(playerId)}
                    title={pairedPlayerIds.has(playerId) ? 'Cannot withdraw a player who has already been paired' : undefined}
                  >
                    Withdraw
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {withdrawOverrides.size > 0 && (
        <p className="text-sm text-muted-foreground mt-2">
          {withdrawOverrides.size} player{withdrawOverrides.size > 1 ? 's' : ''} pending withdrawal
        </p>
      )}

      {isDirty && (
        <div className="sticky bottom-0 bg-background border-t p-4 flex items-center justify-end gap-2 mt-2">
          <Button variant="outline" onClick={handleDiscard} disabled={isSaving}>
            Discard
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      )}
    </div>
  );
}
