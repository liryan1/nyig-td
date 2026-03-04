import { useState, useCallback, useDeferredValue, useMemo } from 'react';
import { useParams, Link, useBlocker } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTournament,
  updateTournament,
  listPlayers,
  registerPlayer,
  bulkRegisterPlayers,
  withdrawPlayer,
  updateRegistration,
  generatePairings,
  unpairMatch,
  manualPair,
  recordResult,
  getStandings,
  getDivisionStandings,
  addDivision,
  removeDivision,
} from '@/services';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/Spinner';
import { RegistrationTable } from '@/components/tournament/RegistrationTable';
import { RoundManager } from '@/components/tournament/RoundManager';
import { StandingsTable } from '@/components/tournament/StandingsTable';
import { BulkRegisterDialog } from '@/components/tournament/BulkRegisterDialog';
import { TiebreakerOrderEditor } from '@/components/tournament/TiebreakerOrderEditor';
import type { Tournament, Player, Division, GameResult, TiebreakerCriteria } from '@/types';

export function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showRegister, setShowRegister] = useState(false);
  const [showBulkRegister, setShowBulkRegister] = useState(false);
  const [standingsDivision, setStandingsDivision] = useState<string | null>(null);
  const [hasPendingRoundChanges, setHasPendingRoundChanges] = useState(false);

  const blocker = useBlocker(hasPendingRoundChanges);

  const handleDirtyChange = useCallback((isDirty: boolean) => {
    setHasPendingRoundChanges(isDirty);
  }, []);

  const { data: tournament, isLoading, isError } = useQuery({
    queryKey: ['tournament', id],
    queryFn: () => getTournament(id!),
    enabled: !!id,
    retry: false,
  });

  const { data: allPlayers } = useQuery({
    queryKey: ['players'],
    queryFn: () => listPlayers({ limit: 500 }),
    enabled: !!tournament,
  });

  const { data: standings } = useQuery({
    queryKey: ['standings', id, standingsDivision],
    queryFn: () =>
      standingsDivision
        ? getDivisionStandings(id!, standingsDivision)
        : getStandings(id!),
    enabled: !!tournament,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Tournament>) => updateTournament(id!, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tournament', id] }),
  });

  const registerMutation = useMutation({
    mutationFn: ({ playerId, roundsParticipating, divisionId }: { playerId: string; roundsParticipating?: number[]; divisionId?: string }) =>
      registerPlayer(id!, playerId, roundsParticipating, divisionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament', id] });
    },
  });

  const bulkRegisterMutation = useMutation({
    mutationFn: (players: Array<{ name: string; agaId: string; rank: string; club?: string; email?: string }>) =>
      bulkRegisterPlayers(id!, players),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament', id] });
      queryClient.invalidateQueries({ queryKey: ['players'] });
      setShowBulkRegister(false);
    },
  });

  const addDivisionMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) => addDivision(id!, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tournament', id] }),
  });

  const removeDivisionMutation = useMutation({
    mutationFn: (divisionId: string) => removeDivision(id!, divisionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tournament', id] }),
  });

  const withdrawMutation = useMutation({
    mutationFn: (playerId: string) => withdrawPlayer(id!, playerId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tournament', id] }),
  });

  const changeDivisionMutation = useMutation({
    mutationFn: ({ playerId, divisionId }: { playerId: string; divisionId: string | null }) =>
      updateRegistration(id!, playerId, { divisionId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tournament', id] }),
  });

  const saveRoundsMutation = useMutation({
    mutationFn: (changes: Array<{ playerId: string; roundsParticipating: number[] }>) =>
      Promise.all(
        changes.map((c) =>
          updateRegistration(id!, c.playerId, { roundsParticipating: c.roundsParticipating })
        )
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tournament', id] }),
  });

  const pairMutation = useMutation({
    mutationFn: (roundNumber: number) => generatePairings(id!, roundNumber),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tournament', id] }),
  });

  const unpairMutation = useMutation({
    mutationFn: ({ roundNumber, boardNumber }: { roundNumber: number; boardNumber: number }) =>
      unpairMatch(id!, roundNumber, boardNumber),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tournament', id] }),
  });

  const manualPairMutation = useMutation({
    mutationFn: ({ roundNumber, player1Id, player2Id }: { roundNumber: number; player1Id: string; player2Id: string }) =>
      manualPair(id!, roundNumber, player1Id, player2Id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tournament', id] }),
  });

  const resultMutation = useMutation({
    mutationFn: ({ roundNumber, boardNumber, result }: { roundNumber: number; boardNumber: number; result: GameResult }) =>
      recordResult(id!, roundNumber, boardNumber, result),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament', id] });
      queryClient.invalidateQueries({ queryKey: ['standings', id] });
    },
  });

  if (isLoading) {
    return <Spinner />;
  }

  if (isError || !tournament) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-2">Tournament Not Found</h1>
        <p className="text-muted-foreground mb-4">
          The tournament you're looking for doesn't exist or the ID is invalid.
        </p>
        <Link to="/">
          <Button variant="outline">&larr; Back to Tournaments</Button>
        </Link>
      </div>
    );
  }

  const registeredPlayerIds = new Set(
    tournament.registrations.filter(r => !r.withdrawn).map(r =>
      typeof r.playerId === 'string' ? r.playerId : r.playerId.id
    )
  );

  const availablePlayers = allPlayers?.filter(p => !registeredPlayerIds.has(p.id)) || [];

  return (
    <div>
      <div className="mb-6">
        <Link to="/" className="text-primary hover:underline text-sm">
          &larr; Back to Tournaments
        </Link>
        <h1 className="text-2xl font-bold mt-2">{tournament.name}</h1>
        <p className="text-muted-foreground">
          {new Date(tournament.date).toLocaleDateString()}
          {tournament.location && ` - ${tournament.location}`}
        </p>
        <div className="mt-2 flex gap-2 items-center">
          <StatusBadge status={tournament.status} />
          <span className="text-sm text-muted-foreground">
            {tournament.settings.numRounds} rounds | {tournament.settings.pairingAlgorithm.toUpperCase()}
          </span>
        </div>
      </div>

      <Tabs defaultValue="registration">
        <TabsList className="mb-6">
          <TabsTrigger value="registration">Registration</TabsTrigger>
          <TabsTrigger value="rounds">Rounds</TabsTrigger>
          <TabsTrigger value="standings">Standings</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="registration">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                Registered Players ({tournament.registrations.filter(r => !r.withdrawn).length})
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowBulkRegister(true)}>
                  Import CSV
                </Button>
                <Button onClick={() => setShowRegister(true)}>
                  Register Player
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <RegistrationTable
                registrations={tournament.registrations}
                divisions={tournament.divisions}
                numRounds={tournament.settings.numRounds}
                onWithdraw={(playerId) => withdrawMutation.mutate(playerId)}
                onChangeDivision={(playerId, divisionId) =>
                  changeDivisionMutation.mutate({ playerId, divisionId })
                }
                onSaveRounds={(changes) => saveRoundsMutation.mutate(changes)}
                onDirtyChange={handleDirtyChange}
                isSaving={saveRoundsMutation.isPending}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rounds">
          <RoundManager
            tournament={tournament}
            onGeneratePairings={(roundNumber) => pairMutation.mutate(roundNumber)}
            onRecordResult={(roundNumber, boardNumber, result) =>
              resultMutation.mutate({ roundNumber, boardNumber, result })
            }
            onUnpairMatch={(roundNumber, boardNumber) =>
              unpairMutation.mutate({ roundNumber, boardNumber })
            }
            onManualPair={(roundNumber, player1Id, player2Id) =>
              manualPairMutation.mutate({ roundNumber, player1Id, player2Id })
            }
            isPairing={pairMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="standings">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Standings</CardTitle>
              {tournament.divisions.length > 0 && (
                <Select
                  value={standingsDivision ?? 'all'}
                  onValueChange={(value) => setStandingsDivision(value === 'all' ? null : value)}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Players</SelectItem>
                    {tournament.divisions.map((div) => (
                      <SelectItem key={div.id} value={div.id}>
                        {div.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardHeader>
            <CardContent>
              {standings && standings.length > 0 ? (
                <StandingsTable standings={standings} tiebreakerOrder={tournament.settings.tiebreakerOrder} />
              ) : (
                <p className="text-muted-foreground">No standings yet. Complete at least one round.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Tournament Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <TournamentSettings
                tournament={tournament}
                onUpdate={(data) => updateMutation.mutate(data)}
              />
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Divisions</CardTitle>
            </CardHeader>
            <CardContent>
              <DivisionManager
                divisions={tournament.divisions}
                onAdd={(data) => addDivisionMutation.mutate(data)}
                onRemove={(divisionId) => removeDivisionMutation.mutate(divisionId)}
                isAdding={addDivisionMutation.isPending}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showRegister} onOpenChange={setShowRegister}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register Player</DialogTitle>
          </DialogHeader>
          <PlayerSelector
            players={availablePlayers}
            divisions={tournament.divisions}
            numRounds={tournament.settings.numRounds}
            onSelect={(playerId, divisionId, roundsParticipating) =>
              registerMutation.mutate({ playerId, divisionId, roundsParticipating })
            }
            isLoading={registerMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <BulkRegisterDialog
        open={showBulkRegister}
        onOpenChange={setShowBulkRegister}
        allPlayers={allPlayers || []}
        registeredPlayerIds={registeredPlayerIds}
        onConfirm={(players) => bulkRegisterMutation.mutate(players)}
        isLoading={bulkRegisterMutation.isPending}
      />

      <Dialog open={blocker.state === 'blocked'} onOpenChange={() => blocker.reset?.()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
            <DialogDescription>
              You have unsaved changes to round participation. Discard changes and leave?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => blocker.reset?.()}>
              Stay
            </Button>
            <Button variant="destructive" onClick={() => blocker.proceed?.()}>
              Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'secondary' | 'default' | 'outline' | 'destructive'> = {
    setup: 'secondary',
    registration: 'secondary',
    in_progress: 'default',
    completed: 'outline',
  };

  return (
    <Badge variant={variants[status] || 'secondary'}>
      {status.replace('_', ' ')}
    </Badge>
  );
}

function PlayerSelector({
  players,
  divisions,
  numRounds,
  onSelect,
  isLoading,
}: {
  players: Player[];
  divisions: Division[];
  numRounds: number;
  onSelect: (id: string, divisionId?: string, roundsParticipating?: number[]) => void;
  isLoading: boolean;
}) {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [selectedDivision, setSelectedDivision] = useState<string>('');
  const [selectedRounds, setSelectedRounds] = useState<Set<number>>(
    () => new Set(Array.from({ length: numRounds }, (_, i) => i + 1))
  );

  const filtered = useMemo(() => {
    if (!deferredSearch) return players;
    const q = deferredSearch.toLowerCase();
    return players.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.agaId?.toLowerCase().includes(q)
    );
  }, [players, deferredSearch]);

  const toggleRound = (round: number) => {
    setSelectedRounds((prev) => {
      const next = new Set(prev);
      if (next.has(round)) {
        next.delete(round);
      } else {
        next.add(round);
      }
      return next;
    });
  };

  const handleSelect = (playerId: string) => {
    const divisionId = selectedDivision || undefined;
    const allRoundsSelected = selectedRounds.size === numRounds;
    const roundsParticipating = allRoundsSelected
      ? undefined
      : Array.from(selectedRounds).sort((a, b) => a - b);
    onSelect(playerId, divisionId, roundsParticipating);
  };

  return (
    <div>
      {divisions.length > 0 && (
        <div className="mb-4">
          <label className="text-sm font-medium">Division</label>
          <Select value={selectedDivision || 'none'} onValueChange={(v) => setSelectedDivision(v === 'none' ? '' : v)}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="No division" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No division</SelectItem>
              {divisions.map((div) => (
                <SelectItem key={div.id} value={div.id}>
                  {div.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="mb-4">
        <label className="text-sm font-medium">Rounds Participating</label>
        <div className="flex gap-3 mt-1">
          {Array.from({ length: numRounds }, (_, i) => i + 1).map((round) => (
            <label key={round} className="flex items-center gap-1.5 text-sm">
              <Checkbox
                checked={selectedRounds.has(round)}
                onCheckedChange={() => toggleRound(round)}
              />
              R{round}
            </label>
          ))}
        </div>
      </div>

      <Input
        type="text"
        placeholder="Search by name or AGA ID..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4"
      />
      <div className="max-h-64 overflow-y-auto">
        {filtered.map((player) => (
          <button
            key={player.id}
            onClick={() => handleSelect(player.id)}
            disabled={isLoading}
            className="w-full text-left px-3 py-2 hover:bg-accent rounded flex justify-between items-center"
          >
            <span>{player.name}</span>
            <span className="text-muted-foreground text-sm">{player.rank}</span>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-muted-foreground text-center py-4">No players found</p>
        )}
      </div>
    </div>
  );
}

const TIEBREAKER_LABELS: Record<TiebreakerCriteria, string> = {
  wins: 'Wins',
  sos: 'SOS',
  sds: 'SDS',
  sosos: 'SOSOS',
  hth: 'HTH',
};

function TournamentSettings({
  tournament,
  onUpdate,
}: {
  tournament: Tournament;
  onUpdate: (data: Partial<Tournament>) => void;
}) {
  const [editingTiebreakers, setEditingTiebreakers] = useState(false);
  const [tiebreakerDraft, setTiebreakerDraft] = useState<TiebreakerCriteria[]>(
    tournament.settings.tiebreakerOrder ?? ['wins', 'sos', 'sds', 'hth']
  );

  const statusOptions = ['setup', 'registration', 'in_progress', 'completed'];

  const saveTiebreakers = () => {
    onUpdate({ settings: { ...tournament.settings, tiebreakerOrder: tiebreakerDraft } } as Partial<Tournament>);
    setEditingTiebreakers(false);
  };

  const cancelTiebreakers = () => {
    setTiebreakerDraft(tournament.settings.tiebreakerOrder ?? ['wins', 'sos', 'sds', 'hth']);
    setEditingTiebreakers(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Status</label>
        <Select
          value={tournament.status}
          onValueChange={(value) => onUpdate({ status: value as Tournament['status'] })}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace('_', ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Pairing Algorithm</label>
          <p className="text-muted-foreground">{tournament.settings.pairingAlgorithm.toUpperCase()}</p>
        </div>
        <div>
          <label className="text-sm font-medium">Number of Rounds</label>
          <p className="text-muted-foreground">{tournament.settings.numRounds}</p>
        </div>
        <div>
          <label className="text-sm font-medium">Handicap Type</label>
          <p className="text-muted-foreground">
            {tournament.settings.handicapType === 'rank_difference' ? 'Standard (Rank Difference)' : 'None'}
          </p>
        </div>
        {tournament.settings.handicapType !== 'none' && tournament.settings.handicapModifier !== 'none' && (
          <div>
            <label className="text-sm font-medium">Handicap Modifier</label>
            <p className="text-muted-foreground">
              {tournament.settings.handicapModifier === 'minus_1' ? 'Minus 1' : 'Minus 2'}
            </p>
          </div>
        )}
        <div>
          <label className="text-sm font-medium">Cross-Division Pairing</label>
          <p className="text-muted-foreground">{tournament.settings.crossDivisionPairing ? 'Yes' : 'No'}</p>
        </div>
        {tournament.settings.mcmahonBar && (
          <div>
            <label className="text-sm font-medium">McMahon Bar</label>
            <p className="text-muted-foreground">{tournament.settings.mcmahonBar}</p>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Tiebreaker Order</label>
          {!editingTiebreakers && (
            <Button variant="outline" size="sm" onClick={() => setEditingTiebreakers(true)}>
              Edit
            </Button>
          )}
        </div>
        {editingTiebreakers ? (
          <div className="space-y-2">
            <TiebreakerOrderEditor value={tiebreakerDraft} onChange={setTiebreakerDraft} />
            <div className="flex gap-2">
              <Button size="sm" onClick={saveTiebreakers}>Save</Button>
              <Button variant="outline" size="sm" onClick={cancelTiebreakers}>Cancel</Button>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">
            {(tournament.settings.tiebreakerOrder ?? ['wins', 'sos', 'sds', 'hth'])
              .map((c) => TIEBREAKER_LABELS[c])
              .join(' → ')}
          </p>
        )}
      </div>
    </div>
  );
}

function DivisionManager({
  divisions,
  onAdd,
  onRemove,
  isAdding,
}: {
  divisions: Division[];
  onAdd: (data: { name: string; description?: string }) => void;
  onRemove: (divisionId: string) => void;
  isAdding: boolean;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), description: description.trim() || undefined });
    setName('');
    setDescription('');
  };

  return (
    <div className="space-y-4">
      {divisions.length > 0 ? (
        <div className="space-y-2">
          {divisions.map((div) => (
            <div
              key={div.id}
              className="flex items-center justify-between p-3 border rounded"
            >
              <div>
                <p className="font-medium">{div.name}</p>
                {div.description && (
                  <p className="text-sm text-muted-foreground">{div.description}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => onRemove(div.id)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No divisions configured.</p>
      )}

      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="text-sm font-medium">Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Open, Kyu"
            className="mt-1"
          />
        </div>
        <div className="flex-1">
          <label className="text-sm font-medium">Description</label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
            className="mt-1"
          />
        </div>
        <Button onClick={handleAdd} disabled={isAdding || !name.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}
