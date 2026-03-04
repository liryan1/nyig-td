import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { listPlayers, createPlayer, updatePlayer, deletePlayer } from '@/services';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/Spinner';
import { PlayerForm } from '@/components/player/PlayerForm';
import type { CreatePlayerForm, Player } from '@/types';

export function PlayerListPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [editPlayer, setEditPlayer] = useState<Player | null>(null);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: players, isLoading } = useQuery({
    queryKey: ['players', search],
    queryFn: () => listPlayers({ search: search || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: createPlayer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      setShowCreate(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreatePlayerForm> }) =>
      updatePlayer(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      setEditPlayer(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deletePlayer,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['players'] }),
  });

  if (isLoading) {
    return <Spinner />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Players</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-5 w-5 mr-2" />
          Add Player
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <Input
            type="text"
            placeholder="Search players..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Rank</TableHead>
                <TableHead>Club</TableHead>
                <TableHead>AGA ID</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players?.map((player) => (
                <TableRow key={player.id}>
                  <TableCell className="font-medium">{player.name}</TableCell>
                  <TableCell>{player.rank}</TableCell>
                  <TableCell className="text-muted-foreground">{player.club || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{player.agaId || '-'}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditPlayer(player)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm('Delete this player?')) {
                          deleteMutation.mutate(player.id);
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {players?.length === 0 && (
            <p className="text-muted-foreground text-center py-8">No players found.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Player</DialogTitle>
          </DialogHeader>
          <PlayerForm
            onSubmit={(data) => createMutation.mutate(data)}
            onCancel={() => setShowCreate(false)}
            isLoading={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editPlayer} onOpenChange={() => setEditPlayer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Player</DialogTitle>
          </DialogHeader>
          {editPlayer && (
            <PlayerForm
              onSubmit={(data) => updateMutation.mutate({ id: editPlayer.id, data })}
              onCancel={() => setEditPlayer(null)}
              isLoading={updateMutation.isPending}
              defaultValues={editPlayer}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
