import { describe, it, expect } from 'vitest';
import { render, screen } from '../../utils';
import { StandingsTable } from '@/components/tournament/StandingsTable';
import type { PlayerStanding } from '@/types';

const standings: PlayerStanding[] = [
  {
    rank: 1,
    playerId: 'p1',
    playerName: 'Alice Chen',
    playerRank: '5d',
    wins: 3,
    losses: 0,
    sos: 2.0,
    sds: 1.5,
    sosos: 0.5,
  },
  {
    rank: 2,
    playerId: 'p2',
    playerName: 'Bob Kim',
    playerRank: '3d',
    wins: 2,
    losses: 1,
    sos: 1.5,
    sds: 1.0,
    sosos: 0.3,
  },
];

describe('StandingsTable', () => {
  it('renders column headers', () => {
    render(<StandingsTable standings={standings} />);
    expect(screen.getByText('Rank')).toBeInTheDocument();
    expect(screen.getByText('Player')).toBeInTheDocument();
    expect(screen.getByText('W-L')).toBeInTheDocument();
    expect(screen.getByText('SOS')).toBeInTheDocument();
    expect(screen.getByText('SDS')).toBeInTheDocument();
    expect(screen.getByText('SOSOS')).toBeInTheDocument();
  });

  it('renders player standings data', () => {
    render(<StandingsTable standings={standings} />);
    expect(screen.getByText('Alice Chen')).toBeInTheDocument();
    expect(screen.getByText('Bob Kim')).toBeInTheDocument();
    expect(screen.getByText('5d')).toBeInTheDocument();
    expect(screen.getByText('3d')).toBeInTheDocument();
    expect(screen.getByText('3-0')).toBeInTheDocument();
    expect(screen.getByText('2-1')).toBeInTheDocument();
  });

  it('formats scores with correct decimal places', () => {
    render(<StandingsTable standings={standings} />);
    // SOS uses 2 decimal places — 2.00 for Alice, 1.50 for Bob
    expect(screen.getByText('2.00')).toBeInTheDocument();
    // 1.50 appears twice (SOS for Bob and SDS for Alice)
    expect(screen.getAllByText('1.50')).toHaveLength(2);
    // SOSOS values
    expect(screen.getByText('0.50')).toBeInTheDocument();
    expect(screen.getByText('0.30')).toBeInTheDocument();
  });

  it('renders empty table with no standings', () => {
    render(<StandingsTable standings={[]} />);
    expect(screen.getByText('Rank')).toBeInTheDocument();
    expect(screen.queryByText('Alice Chen')).not.toBeInTheDocument();
  });
});
