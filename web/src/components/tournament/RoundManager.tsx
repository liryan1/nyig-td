import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { Tournament, Pairing, GameResult, Player } from '@/types';

interface RoundManagerProps {
  tournament: Tournament;
  onGeneratePairings: (roundNumber: number) => void;
  onRecordResult: (roundNumber: number, boardNumber: number, result: GameResult) => void;
  onUnpairMatch: (roundNumber: number, boardNumber: number) => void;
  onManualPair: (roundNumber: number, player1Id: string, player2Id: string) => void;
  isPairing: boolean;
}

export function RoundManager({
  tournament,
  onGeneratePairings,
  onRecordResult,
  onUnpairMatch,
  onManualPair,
  isPairing,
}: RoundManagerProps) {
  const [activeRound, setActiveRound] = useState(1);
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());

  const round = tournament.rounds.find((r) => r.number === activeRound);

  // Build player lookup
  const playerMap = new Map<string, Player>();
  for (const reg of tournament.registrations) {
    if (typeof reg.playerId !== 'string') {
      playerMap.set(reg.playerId.id, reg.playerId);
    }
  }

  const getPlayerName = (id: string) => playerMap.get(id)?.name || id;
  const getPlayerRank = (id: string) => playerMap.get(id)?.rank || '';

  // Compute unpaired players for the active round
  const getUnpairedPlayers = (): Player[] => {
    if (!round) return [];

    const pairedIds = new Set<string>();
    for (const p of round.pairings) {
      pairedIds.add(p.blackPlayerId);
      pairedIds.add(p.whitePlayerId);
    }
    for (const b of round.byes) {
      pairedIds.add(b.playerId);
    }

    return tournament.registrations
      .filter((r) => !r.withdrawn)
      .map((r) => (typeof r.playerId === 'string' ? null : r.playerId))
      .filter((p): p is Player => p !== null && !pairedIds.has(p.id));
  };

  const unpairedPlayers = getUnpairedPlayers();
  const canUnpair = round && round.status !== 'completed';

  const prevRound = tournament.rounds.find((r) => r.number === activeRound - 1);
  const previousRoundCompleted = activeRound === 1 || !prevRound || prevRound.status === 'completed';

  const togglePlayer = (playerId: string) => {
    setSelectedPlayers((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  };

  const handlePairSelected = () => {
    if (!round || selectedPlayers.size !== 2) return;
    const [p1, p2] = Array.from(selectedPlayers);
    onManualPair(round.number, p1, p2);
    setSelectedPlayers(new Set());
  };

  return (
    <div>
      {/* Round tabs */}
      <div className="flex gap-2 mb-4">
        {tournament.rounds.map((r) => (
          <Button
            key={r.number}
            variant={activeRound === r.number ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setActiveRound(r.number);
              setSelectedPlayers(new Set());
            }}
          >
            Round {r.number}
            <RoundStatusDot status={r.status} />
          </Button>
        ))}
      </div>

      {/* Round content */}
      {round && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Round {round.number}</CardTitle>
            <RoundStatusBadge status={round.status} />
          </CardHeader>
          <CardContent>
            {/* Pairings table — shown when there are pairings */}
            {round.pairings.length > 0 && (
              <div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Board</TableHead>
                      <TableHead>Black</TableHead>
                      <TableHead>White</TableHead>
                      <TableHead>Handicap</TableHead>
                      <TableHead>Result</TableHead>
                      {canUnpair && <TableHead className="w-12" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {round.pairings.map((pairing) => (
                      <PairingRow
                        key={pairing.boardNumber}
                        pairing={pairing}
                        getPlayerName={getPlayerName}
                        getPlayerRank={getPlayerRank}
                        onRecordResult={(result) =>
                          onRecordResult(round.number, pairing.boardNumber, result)
                        }
                        canUnpair={canUnpair && pairing.result === 'no_result'}
                        onUnpair={() => onUnpairMatch(round.number, pairing.boardNumber)}
                      />
                    ))}
                  </TableBody>
                </Table>

                {/* Byes */}
                {round.byes.length > 0 && (
                  <div className="border-t pt-4 mt-4">
                    <h4 className="font-medium mb-2">Byes</h4>
                    {round.byes.map((bye) => (
                      <p key={bye.playerId} className="text-muted-foreground">
                        {getPlayerName(bye.playerId)} ({bye.points} point)
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* No pairings yet message */}
            {round.pairings.length === 0 && round.status === 'pending' && unpairedPlayers.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No registered players to pair</p>
              </div>
            )}

            {/* Unpaired players section */}
            {unpairedPlayers.length > 0 && round.status !== 'completed' && (
              <div className={round.pairings.length > 0 ? 'border-t pt-4 mt-4' : ''}>
                <h4 className="font-medium mb-3">
                  Unpaired Players ({unpairedPlayers.length})
                </h4>
                <div className="grid gap-1 mb-4">
                  {unpairedPlayers.map((player) => (
                    <label
                      key={player.id}
                      className="flex items-center gap-3 px-3 py-2 rounded hover:bg-accent cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedPlayers.has(player.id)}
                        onCheckedChange={() => togglePlayer(player.id)}
                      />
                      <span>{player.name}</span>
                      <span className="text-muted-foreground text-sm">{player.rank}</span>
                    </label>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={selectedPlayers.size !== 2 || !previousRoundCompleted}
                    onClick={handlePairSelected}
                  >
                    Pair Selected
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onGeneratePairings(round.number)}
                    disabled={isPairing || !previousRoundCompleted}
                  >
                    {isPairing
                      ? 'Pairing...'
                      : round.pairings.length > 0
                        ? 'Pair Remaining'
                        : 'Generate Pairings'}
                  </Button>
                </div>
                {!previousRoundCompleted && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Complete round {activeRound - 1} before pairing round {activeRound}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RoundStatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-gray-400',
    paired: 'bg-blue-400',
    in_progress: 'bg-yellow-400',
    completed: 'bg-green-400',
  };

  return <span className={cn('inline-block w-2 h-2 rounded-full ml-2', colors[status])} />;
}

function RoundStatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'secondary' | 'default' | 'outline' | 'destructive'> = {
    pending: 'secondary',
    paired: 'outline',
    in_progress: 'default',
    completed: 'secondary',
  };

  return (
    <Badge variant={variants[status] || 'secondary'}>
      {status.replace('_', ' ')}
    </Badge>
  );
}

function PairingRow({
  pairing,
  getPlayerName,
  getPlayerRank,
  onRecordResult,
  canUnpair,
  onUnpair,
}: {
  pairing: Pairing;
  getPlayerName: (id: string) => string;
  getPlayerRank: (id: string) => string;
  onRecordResult: (result: GameResult) => void;
  canUnpair?: boolean;
  onUnpair?: () => void;
}) {
  const resultOptions: GameResult[] = ['no_result', 'black_wins', 'white_wins', 'black_forfeit', 'white_forfeit', 'draw'];

  const resultLabels: Record<GameResult, string> = {
    'no_result': 'No Result',
    'black_wins': 'Black Wins',
    'white_wins': 'White Wins',
    'black_forfeit': 'Black (Forfeit)',
    'white_forfeit': 'White (Forfeit)',
    'draw': 'Draw',
    'double_forfeit': 'Both Lose',
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{pairing.boardNumber}</TableCell>
      <TableCell>
        <span className={pairing.result === 'black_wins' || pairing.result === 'white_forfeit' ? 'font-semibold' : ''}>
          {getPlayerName(pairing.blackPlayerId)}
        </span>
        <span className="text-muted-foreground ml-2">{getPlayerRank(pairing.blackPlayerId)}</span>
      </TableCell>
      <TableCell>
        <span className={pairing.result === 'white_wins' || pairing.result === 'black_forfeit' ? 'font-semibold' : ''}>
          {getPlayerName(pairing.whitePlayerId)}
        </span>
        <span className="text-muted-foreground ml-2">{getPlayerRank(pairing.whitePlayerId)}</span>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {pairing.handicapStones > 0
          ? `H${pairing.handicapStones}, K${pairing.komi}`
          : `Even, K${pairing.komi}`}
      </TableCell>
      <TableCell>
        <Select value={pairing.result} onValueChange={(value) => onRecordResult(value as GameResult)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {resultOptions.map((r) => (
              <SelectItem key={r} value={r}>
                {resultLabels[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      {canUnpair !== undefined && (
        <TableCell>
          {canUnpair && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              onClick={onUnpair}
              title="Remove pairing"
            >
              X
            </Button>
          )}
        </TableCell>
      )}
    </TableRow>
  );
}
