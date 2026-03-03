import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { listTournaments, createTournament, deleteTournament } from '@/services';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/Spinner';
import { TournamentForm } from '@/components/tournament/TournamentForm';
import type { CreateTournamentForm, Tournament } from '@/types';

export function TournamentListPage() {
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();

  const { data: tournaments, isLoading } = useQuery({
    queryKey: ['tournaments'],
    queryFn: () => listTournaments(),
  });

  const createMutation = useMutation({
    mutationFn: createTournament,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      setShowCreate(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTournament,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
    },
  });

  const handleCreate = (data: CreateTournamentForm) => {
    createMutation.mutate(data);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this tournament?')) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return <Spinner />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Tournaments</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-5 w-5 mr-2" />
          New Tournament
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tournaments?.map((tournament) => (
          <TournamentCard
            key={tournament._id}
            tournament={tournament}
            onDelete={() => handleDelete(tournament._id)}
          />
        ))}
        {tournaments?.length === 0 && (
          <p className="text-muted-foreground col-span-full text-center py-8">
            No tournaments yet. Create one to get started.
          </p>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Tournament</DialogTitle>
          </DialogHeader>
          <TournamentForm
            onSubmit={handleCreate}
            onCancel={() => setShowCreate(false)}
            isLoading={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TournamentCard({
  tournament,
  onDelete,
}: {
  tournament: Tournament;
  onDelete: () => void;
}) {
  const statusVariants: Record<string, 'secondary' | 'default' | 'outline' | 'destructive'> = {
    upcoming: 'secondary',
    in_progress: 'default',
    completed: 'outline',
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">
            <Link to={`/tournaments/${tournament._id}`} className="hover:text-primary">
              {tournament.name}
            </Link>
          </CardTitle>
          <Badge variant={statusVariants[tournament.status] || 'secondary'}>
            {tournament.status.replace('_', ' ')}
          </Badge>
        </div>
        <CardDescription>
          {new Date(tournament.date).toLocaleDateString()}
          {tournament.location && ` - ${tournament.location}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-2">
        <p className="text-sm text-muted-foreground">
          {tournament.settings.numRounds} rounds | {tournament.settings.pairingAlgorithm.toUpperCase()}
          {' | '}{tournament.registrations.filter(r => !r.withdrawn).length} players
        </p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link to={`/tournaments/${tournament._id}`}>Manage</Link>
        </Button>
        <Button variant="destructive" size="sm" onClick={onDelete}>
          Delete
        </Button>
      </CardFooter>
    </Card>
  );
}
