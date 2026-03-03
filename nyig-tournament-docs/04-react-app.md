# Guide 4: React Web App

React web application for tournament directors using Vite, TypeScript, and shadcn/ui.

## Prerequisites

- Node.js 22+
- npm or pnpm
- TypeScript API running (from Guide 3)

## Project Setup

### Create Project

```bash
npm create vite@latest nyig-tournament-app -- --template react-ts
cd nyig-tournament-app
```

### Install Dependencies

```bash
# UI and routing
npm install react-router-dom @tanstack/react-query axios

# Form handling
npm install react-hook-form zod @hookform/resolvers

# Icons
npm install lucide-react
```

### Initialize shadcn/ui

```bash
npx shadcn@latest init
```

When prompted, select:
- Style: Default
- Base color: Slate
- CSS variables: Yes

This will set up Tailwind CSS and the required configuration automatically.

### Add shadcn Components

```bash
npx shadcn@latest add button
npx shadcn@latest add input
npx shadcn@latest add label
npx shadcn@latest add select
npx shadcn@latest add dialog
npx shadcn@latest add tabs
npx shadcn@latest add table
npx shadcn@latest add card
npx shadcn@latest add badge
npx shadcn@latest add checkbox
npx shadcn@latest add textarea
npx shadcn@latest add form
```

### Update `src/index.css`

After shadcn init, add these customizations:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-background text-foreground;
  }
}
```

### Directory Structure

```bash
mkdir -p src/{components,pages,services,hooks,types,utils}
mkdir -p src/components/{tournament,player}
```

---

## Types (`src/types/index.ts`)

```typescript
export type PairingAlgorithm = 'swiss' | 'mcmahon';
export type GameResult = 'B+' | 'W+' | 'B+F' | 'W+F' | 'Draw' | 'NR' | 'BL';
export type TournamentStatus = 'setup' | 'registration' | 'in_progress' | 'completed';
export type RoundStatus = 'pending' | 'paired' | 'in_progress' | 'completed';

export interface StandingsWeights {
  wins: number;
  sos: number;
  sodos: number;
  extendedSos: number;
}

export interface TournamentSettings {
  numRounds: number;
  pairingAlgorithm: PairingAlgorithm;
  standingsWeights: StandingsWeights;
  handicapEnabled: boolean;
  handicapReduction: number;
  mcmahonBar?: string;
}

export interface Player {
  _id: string;
  name: string;
  rank: string;
  club?: string;
  agaId?: string;
  rating?: number;
  email?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerRegistration {
  playerId: string | Player;
  roundsParticipating: number[];
  registeredAt: string;
  withdrawn: boolean;
}

export interface Pairing {
  blackPlayerId: string;
  whitePlayerId: string;
  boardNumber: number;
  handicapStones: number;
  komi: number;
  result: GameResult;
}

export interface Bye {
  playerId: string;
  points: number;
}

export interface Round {
  number: number;
  status: RoundStatus;
  pairings: Pairing[];
  byes: Bye[];
  pairedAt?: string;
  completedAt?: string;
}

export interface Tournament {
  _id: string;
  name: string;
  description?: string;
  date: string;
  location?: string;
  status: TournamentStatus;
  settings: TournamentSettings;
  registrations: PlayerRegistration[];
  rounds: Round[];
  createdAt: string;
  updatedAt: string;
}

export interface PlayerStanding {
  rank: number;
  playerId: string;
  playerName: string;
  playerRank: string;
  wins: number;
  losses: number;
  sos: number;
  sodos: number;
  extendedSos: number;
  totalScore: number;
}

// Form types
export interface CreatePlayerForm {
  name: string;
  rank: string;
  club?: string;
  agaId?: string;
  email?: string;
}

export interface CreateTournamentForm {
  name: string;
  description?: string;
  date: string;
  location?: string;
  settings: {
    numRounds: number;
    pairingAlgorithm: PairingAlgorithm;
    handicapEnabled: boolean;
    handicapReduction: number;
    mcmahonBar?: string;
    standingsWeights?: Partial<StandingsWeights>;
  };
}
```

---

## API Client (`src/services/api.ts`)

```typescript
import axios from 'axios';
import type {
  Player,
  Tournament,
  PlayerStanding,
  CreatePlayerForm,
  CreateTournamentForm,
  GameResult,
  Round,
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// ========== Players ==========

export async function listPlayers(params?: { search?: string; limit?: number }): Promise<Player[]> {
  const response = await api.get<{ players: Player[] }>('/players', { params });
  return response.data.players;
}

export async function getPlayer(id: string): Promise<Player> {
  const response = await api.get<{ player: Player }>(`/players/${id}`);
  return response.data.player;
}

export async function createPlayer(data: CreatePlayerForm): Promise<Player> {
  const response = await api.post<{ player: Player }>('/players', data);
  return response.data.player;
}

export async function updatePlayer(id: string, data: Partial<CreatePlayerForm>): Promise<Player> {
  const response = await api.patch<{ player: Player }>(`/players/${id}`, data);
  return response.data.player;
}

export async function deletePlayer(id: string): Promise<void> {
  await api.delete(`/players/${id}`);
}

// ========== Tournaments ==========

export async function listTournaments(params?: { status?: string }): Promise<Tournament[]> {
  const response = await api.get<{ tournaments: Tournament[] }>('/tournaments', { params });
  return response.data.tournaments;
}

export async function getTournament(id: string): Promise<Tournament> {
  const response = await api.get<{ tournament: Tournament }>(`/tournaments/${id}`);
  return response.data.tournament;
}

export async function createTournament(data: CreateTournamentForm): Promise<Tournament> {
  const response = await api.post<{ tournament: Tournament }>('/tournaments', data);
  return response.data.tournament;
}

export async function updateTournament(
  id: string,
  data: Partial<CreateTournamentForm & { status?: string }>
): Promise<Tournament> {
  const response = await api.patch<{ tournament: Tournament }>(`/tournaments/${id}`, data);
  return response.data.tournament;
}

export async function deleteTournament(id: string): Promise<void> {
  await api.delete(`/tournaments/${id}`);
}

// ========== Registration ==========

export async function registerPlayer(
  tournamentId: string,
  playerId: string,
  roundsParticipating?: number[]
): Promise<Tournament> {
  const response = await api.post<{ tournament: Tournament }>(
    `/tournaments/${tournamentId}/registrations`,
    { playerId, roundsParticipating }
  );
  return response.data.tournament;
}

export async function withdrawPlayer(tournamentId: string, playerId: string): Promise<Tournament> {
  const response = await api.delete<{ tournament: Tournament }>(
    `/tournaments/${tournamentId}/registrations/${playerId}`
  );
  return response.data.tournament;
}

// ========== Rounds ==========

export async function generatePairings(tournamentId: string, roundNumber: number): Promise<Round> {
  const response = await api.post<{ round: Round }>(
    `/tournaments/${tournamentId}/rounds/${roundNumber}/pair`
  );
  return response.data.round;
}

export async function recordResult(
  tournamentId: string,
  roundNumber: number,
  boardNumber: number,
  result: GameResult
): Promise<Tournament> {
  const response = await api.patch<{ tournament: Tournament }>(
    `/tournaments/${tournamentId}/rounds/${roundNumber}/boards/${boardNumber}`,
    { result }
  );
  return response.data.tournament;
}

// ========== Standings ==========

export async function getStandings(
  tournamentId: string,
  throughRound?: number
): Promise<PlayerStanding[]> {
  const params = throughRound ? { throughRound } : undefined;
  const response = await api.get<{ standings: PlayerStanding[] }>(
    `/tournaments/${tournamentId}/standings`,
    { params }
  );
  return response.data.standings;
}
```

---

## Common Components

### Layout (`src/components/Layout.tsx`)

```tsx
import { Link, Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Tournaments', href: '/' },
  { name: 'Players', href: '/players' },
];

export function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen">
      <nav className="bg-primary">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Link to="/" className="text-primary-foreground font-bold text-xl">
                NYIG Tournament
              </Link>
              <div className="ml-10 flex items-baseline space-x-4">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      'px-3 py-2 rounded-md text-sm font-medium',
                      location.pathname === item.href
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground'
                    )}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
```

### Loading Spinner (`src/components/Spinner.tsx`)

```tsx
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div className="flex justify-center">
      <Loader2 className={cn(sizeClasses[size], 'animate-spin text-primary')} />
    </div>
  );
}
```

---

## Tournament Components

### Tournament List Page (`src/pages/TournamentListPage.tsx`)

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { listTournaments, createTournament, deleteTournament } from '@/services/api';
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
    setup: 'secondary',
    registration: 'outline',
    in_progress: 'default',
    completed: 'secondary',
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
          <Badge variant={statusVariants[tournament.status]}>
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
```

### Tournament Form (`src/components/tournament/TournamentForm.tsx`)

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import type { CreateTournamentForm } from '@/types';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(2000).optional(),
  date: z.string().min(1, 'Date is required'),
  location: z.string().max(200).optional(),
  settings: z.object({
    numRounds: z.number().int().min(1).max(10),
    pairingAlgorithm: z.enum(['swiss', 'mcmahon']),
    handicapEnabled: z.boolean(),
    handicapReduction: z.number().int().min(0).max(5),
    mcmahonBar: z.string().regex(/^\d+[kdKD]$/).optional().or(z.literal('')),
  }),
});

interface TournamentFormProps {
  onSubmit: (data: CreateTournamentForm) => void;
  onCancel: () => void;
  isLoading?: boolean;
  defaultValues?: Partial<CreateTournamentForm>;
}

export function TournamentForm({ onSubmit, onCancel, isLoading, defaultValues }: TournamentFormProps) {
  const form = useForm<CreateTournamentForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      date: new Date().toISOString().split('T')[0],
      settings: {
        numRounds: 4,
        pairingAlgorithm: 'mcmahon',
        handicapEnabled: true,
        handicapReduction: 0,
        mcmahonBar: '3d',
      },
      ...defaultValues,
    },
  });

  const algorithm = form.watch('settings.pairingAlgorithm');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tournament Name *</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date *</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Location</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea {...field} rows={3} />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="settings.numRounds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Number of Rounds *</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="settings.pairingAlgorithm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pairing Algorithm *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="mcmahon">McMahon</SelectItem>
                    <SelectItem value="swiss">Swiss</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        </div>

        {algorithm === 'mcmahon' && (
          <FormField
            control={form.control}
            name="settings.mcmahonBar"
            render={({ field }) => (
              <FormItem>
                <FormLabel>McMahon Bar</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g., 3d" />
                </FormControl>
                <FormDescription>
                  Players at or above this rank start with score 0
                </FormDescription>
              </FormItem>
            )}
          />
        )}

        <div className="flex items-center gap-4">
          <FormField
            control={form.control}
            name="settings.handicapEnabled"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel className="!mt-0">Enable Handicaps</FormLabel>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="settings.handicapReduction"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2">
                <FormLabel className="!mt-0">Reduction:</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={5}
                    className="w-16"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Tournament'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
```

### Tournament Detail Page (`src/pages/TournamentDetailPage.tsx`)

```tsx
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTournament,
  updateTournament,
  listPlayers,
  registerPlayer,
  withdrawPlayer,
  generatePairings,
  recordResult,
  getStandings,
} from '@/services/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
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
import { Spinner } from '@/components/Spinner';
import { RegistrationTable } from '@/components/tournament/RegistrationTable';
import { RoundManager } from '@/components/tournament/RoundManager';
import { StandingsTable } from '@/components/tournament/StandingsTable';
import type { Tournament, Player, GameResult } from '@/types';

export function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showRegister, setShowRegister] = useState(false);

  const { data: tournament, isLoading } = useQuery({
    queryKey: ['tournament', id],
    queryFn: () => getTournament(id!),
    enabled: !!id,
  });

  const { data: allPlayers } = useQuery({
    queryKey: ['players'],
    queryFn: () => listPlayers({ limit: 500 }),
  });

  const { data: standings } = useQuery({
    queryKey: ['standings', id],
    queryFn: () => getStandings(id!),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Tournament>) => updateTournament(id!, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tournament', id] }),
  });

  const registerMutation = useMutation({
    mutationFn: ({ playerId }: { playerId: string }) => registerPlayer(id!, playerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament', id] });
      setShowRegister(false);
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: (playerId: string) => withdrawPlayer(id!, playerId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tournament', id] }),
  });

  const pairMutation = useMutation({
    mutationFn: (roundNumber: number) => generatePairings(id!, roundNumber),
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

  if (isLoading || !tournament) {
    return <Spinner />;
  }

  const registeredPlayerIds = new Set(
    tournament.registrations.filter(r => !r.withdrawn).map(r =>
      typeof r.playerId === 'string' ? r.playerId : r.playerId._id
    )
  );

  const availablePlayers = allPlayers?.filter(p => !registeredPlayerIds.has(p._id)) || [];

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
              <Button onClick={() => setShowRegister(true)}>
                Register Player
              </Button>
            </CardHeader>
            <CardContent>
              <RegistrationTable
                registrations={tournament.registrations}
                onWithdraw={(playerId) => withdrawMutation.mutate(playerId)}
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
            isPairing={pairMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="standings">
          <Card>
            <CardHeader>
              <CardTitle>Standings</CardTitle>
            </CardHeader>
            <CardContent>
              {standings && standings.length > 0 ? (
                <StandingsTable standings={standings} />
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
        </TabsContent>
      </Tabs>

      <Dialog open={showRegister} onOpenChange={setShowRegister}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register Player</DialogTitle>
          </DialogHeader>
          <PlayerSelector
            players={availablePlayers}
            onSelect={(playerId) => registerMutation.mutate({ playerId })}
            isLoading={registerMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'secondary' | 'default' | 'outline' | 'destructive'> = {
    setup: 'secondary',
    registration: 'outline',
    in_progress: 'default',
    completed: 'secondary',
  };

  return (
    <Badge variant={variants[status] || 'secondary'}>
      {status.replace('_', ' ')}
    </Badge>
  );
}

function PlayerSelector({
  players,
  onSelect,
  isLoading,
}: {
  players: Player[];
  onSelect: (id: string) => void;
  isLoading: boolean;
}) {
  const [search, setSearch] = useState('');

  const filtered = players.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.rank.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <Input
        type="text"
        placeholder="Search players..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4"
      />
      <div className="max-h-64 overflow-y-auto">
        {filtered.map((player) => (
          <button
            key={player._id}
            onClick={() => onSelect(player._id)}
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

function TournamentSettings({
  tournament,
  onUpdate,
}: {
  tournament: Tournament;
  onUpdate: (data: Partial<Tournament>) => void;
}) {
  const statusOptions = ['setup', 'registration', 'in_progress', 'completed'];

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Status</label>
        <Select
          value={tournament.status}
          onValueChange={(value) => onUpdate({ status: value as any })}
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
          <label className="text-sm font-medium">Handicap Enabled</label>
          <p className="text-muted-foreground">{tournament.settings.handicapEnabled ? 'Yes' : 'No'}</p>
        </div>
        {tournament.settings.mcmahonBar && (
          <div>
            <label className="text-sm font-medium">McMahon Bar</label>
            <p className="text-muted-foreground">{tournament.settings.mcmahonBar}</p>
          </div>
        )}
      </div>

      <div>
        <label className="text-sm font-medium">Standings Weights</label>
        <div className="grid grid-cols-4 gap-2 text-sm mt-1">
          <div>
            <span className="text-muted-foreground">Wins:</span>{' '}
            {tournament.settings.standingsWeights.wins}
          </div>
          <div>
            <span className="text-muted-foreground">SOS:</span>{' '}
            {tournament.settings.standingsWeights.sos}
          </div>
          <div>
            <span className="text-muted-foreground">SODOS:</span>{' '}
            {tournament.settings.standingsWeights.sodos}
          </div>
          <div>
            <span className="text-muted-foreground">Ext SOS:</span>{' '}
            {tournament.settings.standingsWeights.extendedSos}
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Registration Table (`src/components/tournament/RegistrationTable.tsx`)

```tsx
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { PlayerRegistration, Player } from '@/types';

interface RegistrationTableProps {
  registrations: PlayerRegistration[];
  onWithdraw: (playerId: string) => void;
}

export function RegistrationTable({ registrations, onWithdraw }: RegistrationTableProps) {
  const activeRegistrations = registrations.filter((r) => !r.withdrawn);

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
          <TableHead>Rounds</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {activeRegistrations.map((reg) => {
          const player = reg.playerId as Player;
          const playerId = typeof reg.playerId === 'string' ? reg.playerId : player._id;

          return (
            <TableRow key={playerId}>
              <TableCell className="font-medium">
                {typeof player === 'string' ? playerId : player.name}
              </TableCell>
              <TableCell>{typeof player === 'string' ? '-' : player.rank}</TableCell>
              <TableCell className="text-muted-foreground">
                {typeof player === 'string' ? '-' : player.club || '-'}
              </TableCell>
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
```

### Round Manager (`src/components/tournament/RoundManager.tsx`)

```tsx
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
import { cn } from '@/lib/utils';
import type { Tournament, Pairing, GameResult, Player } from '@/types';

interface RoundManagerProps {
  tournament: Tournament;
  onGeneratePairings: (roundNumber: number) => void;
  onRecordResult: (roundNumber: number, boardNumber: number, result: GameResult) => void;
  isPairing: boolean;
}

export function RoundManager({
  tournament,
  onGeneratePairings,
  onRecordResult,
  isPairing,
}: RoundManagerProps) {
  const [activeRound, setActiveRound] = useState(1);

  const round = tournament.rounds.find((r) => r.number === activeRound);

  // Build player lookup
  const playerMap = new Map<string, Player>();
  for (const reg of tournament.registrations) {
    if (typeof reg.playerId !== 'string') {
      playerMap.set(reg.playerId._id, reg.playerId);
    }
  }

  const getPlayerName = (id: string) => playerMap.get(id)?.name || id;
  const getPlayerRank = (id: string) => playerMap.get(id)?.rank || '';

  return (
    <div>
      {/* Round tabs */}
      <div className="flex gap-2 mb-4">
        {tournament.rounds.map((r) => (
          <Button
            key={r.number}
            variant={activeRound === r.number ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveRound(r.number)}
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
            {round.status === 'pending' && (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">Round not yet paired</p>
                <Button
                  onClick={() => onGeneratePairings(round.number)}
                  disabled={isPairing}
                >
                  {isPairing ? 'Generating...' : 'Generate Pairings'}
                </Button>
              </div>
            )}

            {round.status !== 'pending' && (
              <div>
                {/* Pairings table */}
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
                      <PairingRow
                        key={pairing.boardNumber}
                        pairing={pairing}
                        getPlayerName={getPlayerName}
                        getPlayerRank={getPlayerRank}
                        onRecordResult={(result) =>
                          onRecordResult(round.number, pairing.boardNumber, result)
                        }
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
}: {
  pairing: Pairing;
  getPlayerName: (id: string) => string;
  getPlayerRank: (id: string) => string;
  onRecordResult: (result: GameResult) => void;
}) {
  const resultOptions: GameResult[] = ['NR', 'B+', 'W+', 'B+F', 'W+F', 'Draw'];

  const resultLabels: Record<GameResult, string> = {
    'NR': 'No Result',
    'B+': 'Black Wins',
    'W+': 'White Wins',
    'B+F': 'Black (Forfeit)',
    'W+F': 'White (Forfeit)',
    'Draw': 'Draw',
    'BL': 'Both Lose',
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{pairing.boardNumber}</TableCell>
      <TableCell>
        <span className={pairing.result.startsWith('B') ? 'font-semibold' : ''}>
          {getPlayerName(pairing.blackPlayerId)}
        </span>
        <span className="text-muted-foreground ml-2">{getPlayerRank(pairing.blackPlayerId)}</span>
      </TableCell>
      <TableCell>
        <span className={pairing.result.startsWith('W') ? 'font-semibold' : ''}>
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
    </TableRow>
  );
}
```

### Standings Table (`src/components/tournament/StandingsTable.tsx`)

```tsx
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
```

---

## Player Pages

### Player List Page (`src/pages/PlayerListPage.tsx`)

```tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { listPlayers, createPlayer, updatePlayer, deletePlayer } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
                <TableRow key={player._id}>
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
                          deleteMutation.mutate(player._id);
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
              onSubmit={(data) => updateMutation.mutate({ id: editPlayer._id, data })}
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
```

### Player Form (`src/components/player/PlayerForm.tsx`)

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import type { CreatePlayerForm } from '@/types';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  rank: z.string().regex(/^\d+[kdKD]$/, 'Invalid rank format (e.g., 5k, 3d)'),
  club: z.string().max(100).optional(),
  agaId: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal('')),
});

interface PlayerFormProps {
  onSubmit: (data: CreatePlayerForm) => void;
  onCancel: () => void;
  isLoading?: boolean;
  defaultValues?: Partial<CreatePlayerForm>;
}

export function PlayerForm({ onSubmit, onCancel, isLoading, defaultValues }: PlayerFormProps) {
  const form = useForm<CreatePlayerForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      rank: '',
      club: '',
      agaId: '',
      email: '',
      ...defaultValues,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name *</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="rank"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rank *</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g., 5k, 3d" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="club"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Club</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="agaId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>AGA ID</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
```

---

## App Entry Point

### Router Setup (`src/App.tsx`)

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { TournamentListPage } from '@/pages/TournamentListPage';
import { TournamentDetailPage } from '@/pages/TournamentDetailPage';
import { PlayerListPage } from '@/pages/PlayerListPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<TournamentListPage />} />
            <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
            <Route path="/players" element={<PlayerListPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
```

### Main Entry (`src/main.tsx`)

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

---

## Path Aliases

The shadcn/ui setup configures path aliases automatically. Ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

And `vite.config.ts`:

```typescript
import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

---

## Environment Variables

Create `.env` file:

```env
VITE_API_URL=http://localhost:3000/api
```

For production:

```env
VITE_API_URL=https://your-api.run.app/api
```

---

## Firebase Hosting Setup

### Install Firebase CLI

```bash
npm install -g firebase-tools
```

### Initialize Firebase

```bash
firebase login
firebase init hosting
```

Select:
- Use existing project or create new
- Public directory: `dist`
- Single-page app: Yes
- Automatic builds: No

### firebase.json

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

### Deploy

```bash
npm run build
firebase deploy --only hosting
```

---

## Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Access at http://localhost:5173

---

## Success Criteria

1. Tournament list displays with create/delete functionality
2. Tournament detail page with tabs working
3. Player registration and withdrawal works
4. Pairing generation calls API correctly
5. Results can be recorded, standings update
6. Player CRUD operations work
7. Responsive design on mobile
8. Deploys successfully to Firebase Hosting
