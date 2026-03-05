import { Spinner } from '@/components/Spinner';
import { StandingsTable } from '@/components/tournament/StandingsTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getPublicTournament } from '@/services';
import type { Player, Round } from '@/types';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router-dom';

const RESULT_LABELS: Record<string, string> = {
  no_result: 'No Result',
  black_wins: 'Black Wins',
  white_wins: 'White Wins',
  black_forfeit: 'Black (Forfeit)',
  white_forfeit: 'White (Forfeit)',
  draw: 'Draw',
  double_forfeit: 'Both Lose',
  NR: 'No Result',
  'B+': 'Black Wins',
  'W+': 'White Wins',
  'B+F': 'Black (Forfeit)',
  'W+F': 'White (Forfeit)',
  Draw: 'Draw',
  BL: 'Both Lose',
};

export function PublicTournamentPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<'rounds' | 'standings'>('rounds');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-tournament', id],
    queryFn: () => getPublicTournament(id!),
    enabled: !!id,
    refetchInterval: 30000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Tournament Not Found</h1>
          <p className="text-muted-foreground">
            This tournament doesn't exist or isn't available.
          </p>
        </div>
      </div>
    );
  }

  const { tournament, standings } = data;

  // Build player lookup
  const playerMap = new Map<string, Player>();
  for (const reg of tournament.registrations) {
    if (typeof reg.playerId !== 'string') {
      playerMap.set(reg.playerId.id, reg.playerId);
    }
  }

  const getPlayerName = (playerId: string) => playerMap.get(playerId)?.name || playerId;
  const getPlayerRank = (playerId: string) => playerMap.get(playerId)?.rank || '';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{tournament.name}</h1>
        <p className="text-muted-foreground">
          {new Date(tournament.date).toLocaleDateString()}
          {tournament.location && ` - ${tournament.location}`}
        </p>
        <div className="mt-2 flex gap-2 items-center">
          <Badge variant="outline">
            {tournament.settings.numRounds} rounds
          </Badge>
          <Badge variant="secondary">
            {tournament.settings.pairingAlgorithm.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Tab buttons */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={activeTab === 'rounds' ? 'default' : 'outline'}
          onClick={() => setActiveTab('rounds')}
        >
          Rounds
        </Button>
        <Button
          variant={activeTab === 'standings' ? 'default' : 'outline'}
          onClick={() => setActiveTab('standings')}
        >
          Standings
        </Button>
      </div>

      {/* Rounds tab */}
      {activeTab === 'rounds' && (
        <div>
          {tournament.rounds.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">
                  No rounds have been published yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {tournament.rounds.map((round) => (
                <PublicRoundCard
                  key={round.number}
                  round={round}
                  getPlayerName={getPlayerName}
                  getPlayerRank={getPlayerRank}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Standings tab */}
      {activeTab === 'standings' && (
        <Card>
          <CardHeader>
            <CardTitle>Standings</CardTitle>
          </CardHeader>
          <CardContent>
            {standings && standings.length > 0 ? (
              <StandingsTable standings={standings} tiebreakerOrder={tournament.settings.tiebreakerOrder} />
            ) : (
              <p className="text-muted-foreground">No standings available yet.</p>
            )}
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground text-center mt-8">
        Auto-refreshes every 30 seconds
      </p>
    </div>
  );
}

function PublicRoundCard({
  round,
  getPlayerName,
  getPlayerRank,
}: {
  round: Round;
  getPlayerName: (id: string) => string;
  getPlayerRank: (id: string) => string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Round {round.number}</CardTitle>
        <Badge variant={round.status === 'completed' ? 'secondary' : 'outline'}>
          {round.status.replace('_', ' ')}
        </Badge>
      </CardHeader>
      <CardContent>
        {round.pairings.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Board</TableHead>
                <TableHead>Black</TableHead>
                <TableHead>White</TableHead>
                <TableHead>Handicap</TableHead>
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {round.pairings.map((pairing) => (
                <TableRow key={pairing.boardNumber}>
                  <TableCell className="font-medium">{pairing.boardNumber}</TableCell>
                  <TableCell>
                    <span className={
                      pairing.result === 'black_wins' || pairing.result === 'white_forfeit'
                        ? 'font-semibold' : ''
                    }>
                      {getPlayerName(pairing.blackPlayerId)}
                    </span>
                    <span className="text-muted-foreground ml-2">{getPlayerRank(pairing.blackPlayerId)}</span>
                  </TableCell>
                  <TableCell>
                    <span className={
                      pairing.result === 'white_wins' || pairing.result === 'black_forfeit'
                        ? 'font-semibold' : ''
                    }>
                      {getPlayerName(pairing.whitePlayerId)}
                    </span>
                    <span className="text-muted-foreground ml-2">{getPlayerRank(pairing.whitePlayerId)}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      {pairing.handicapStones > 0
                        ? `H${pairing.handicapStones}, K${pairing.komi}`
                        : `Even, K${pairing.komi}`}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {RESULT_LABELS[pairing.result] || pairing.result}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {round.byes.length > 0 && (
          <div className={round.pairings.length > 0 ? 'border-t pt-4 mt-4' : ''}>
            <h4 className="font-medium mb-2">Byes</h4>
            {round.byes.map((bye) => (
              <p key={bye.playerId} className="text-muted-foreground">
                {getPlayerName(bye.playerId)} ({bye.points} point)
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
