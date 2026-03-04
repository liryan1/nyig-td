import { useState, useMemo, useDeferredValue } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getPublicTournament, selfCheckIn } from '@/services';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/Spinner';
import type { Player } from '@/types';

export function CheckInPage() {
  const { id } = useParams<{ id: string }>();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [checkedInPlayer, setCheckedInPlayer] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-tournament', id],
    queryFn: () => getPublicTournament(id!),
    enabled: !!id,
    retry: false,
  });

  const checkInMutation = useMutation({
    mutationFn: (playerId: string) => selfCheckIn(id!, playerId),
    onSuccess: (result) => {
      setCheckedInPlayer(result.playerName);
    },
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

  const { tournament } = data;

  // Build player list from registrations
  const players = tournament.registrations
    .filter((r) => !r.withdrawn && typeof r.playerId !== 'string')
    .map((r) => ({
      player: r.playerId as Player,
      checkedIn: r.checkedIn,
    }));

  // If successfully checked in, show confirmation
  if (checkedInPlayer) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="text-4xl mb-4">&#10003;</div>
            <h2 className="text-xl font-bold mb-2">You're checked in!</h2>
            <p className="text-muted-foreground mb-4">
              {checkedInPlayer} is checked in for {tournament.name}.
            </p>
            <div className="flex flex-col gap-2">
              <Button variant="outline" onClick={() => setCheckedInPlayer(null)}>
                Check in another player
              </Button>
              <Link to={`/tournaments/${id}/public`}>
                <Button variant="link" className="w-full">
                  View tournament
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <PlayerSearch
    tournamentName={tournament.name}
    tournamentDate={tournament.date}
    tournamentId={id!}
    players={players}
    search={deferredSearch}
    onSearchChange={setSearch}
    searchValue={search}
    onCheckIn={(playerId) => checkInMutation.mutate(playerId)}
    isLoading={checkInMutation.isPending}
    error={checkInMutation.error?.message}
  />;
}

function PlayerSearch({
  tournamentName,
  tournamentDate,
  tournamentId,
  players,
  search,
  onSearchChange,
  searchValue,
  onCheckIn,
  isLoading,
  error,
}: {
  tournamentName: string;
  tournamentDate: string;
  tournamentId: string;
  players: Array<{ player: Player; checkedIn: boolean }>;
  search: string;
  onSearchChange: (value: string) => void;
  searchValue: string;
  onCheckIn: (playerId: string) => void;
  isLoading: boolean;
  error?: string;
}) {
  const filtered = useMemo(() => {
    if (!search) return [];
    const q = search.toLowerCase();
    return players.filter(
      ({ player }) =>
        player.name.toLowerCase().includes(q) ||
        player.agaId?.toLowerCase().includes(q)
    );
  }, [players, search]);

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-lg mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-center">{tournamentName}</CardTitle>
            <p className="text-center text-muted-foreground text-sm">
              {new Date(tournamentDate).toLocaleDateString()}
            </p>
            <p className="text-center text-sm font-medium mt-2">Player Check-In</p>
          </CardHeader>
          <CardContent>
            <Input
              type="text"
              placeholder="Search by name or AGA ID..."
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className="mb-4"
              autoFocus
            />

            {error && (
              <p className="text-destructive text-sm mb-4">{error}</p>
            )}

            {search && filtered.length === 0 && (
              <p className="text-muted-foreground text-center py-4">
                No players found matching "{search}"
              </p>
            )}

            <div className="max-h-80 overflow-y-auto space-y-1">
              {filtered.map(({ player, checkedIn }) => (
                <button
                  key={player.id}
                  onClick={() => !checkedIn && onCheckIn(player.id)}
                  disabled={isLoading || checkedIn}
                  className="w-full text-left px-3 py-3 hover:bg-accent rounded flex justify-between items-center disabled:opacity-60"
                >
                  <div>
                    <span className="font-medium">{player.name}</span>
                    <span className="text-muted-foreground text-sm ml-2">{player.rank}</span>
                  </div>
                  {checkedIn ? (
                    <Badge variant="secondary">Checked In</Badge>
                  ) : (
                    <span className="text-sm text-primary">Tap to check in</span>
                  )}
                </button>
              ))}
            </div>

            {!search && (
              <p className="text-muted-foreground text-center py-4 text-sm">
                Type your name or AGA ID to find yourself
              </p>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center mt-4">
          <Link to={`/tournaments/${tournamentId}/public`} className="hover:underline">
            View tournament details
          </Link>
        </p>
      </div>
    </div>
  );
}
