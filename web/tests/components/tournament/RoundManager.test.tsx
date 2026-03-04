import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '../../utils';
import { RoundManager } from '@/components/tournament/RoundManager';
import type { Tournament, Player } from '@/types';

const players: Player[] = [
  { id: 'p1', name: 'Alice Chen', rank: '5d', agaId: '12345', createdAt: '', updatedAt: '' },
  { id: 'p2', name: 'Bob Kim', rank: '3d', agaId: '12346', createdAt: '', updatedAt: '' },
  { id: 'p3', name: 'Carol Wang', rank: '1d', agaId: '12347', createdAt: '', updatedAt: '' },
  { id: 'p4', name: 'David Lee', rank: '2k', agaId: '12348', createdAt: '', updatedAt: '' },
];

function makeTournament(overrides?: Partial<Tournament>): Tournament {
  return {
    id: 't1',
    name: 'Test Tournament',
    date: '2024-01-01',
    status: 'in_progress',
    settings: {
      numRounds: 3,
      pairingAlgorithm: 'swiss',
      standingsWeights: { wins: 1, sos: 0.5, sodos: 0.25, extendedSos: 0.1 },
      handicapEnabled: false,
      handicapReduction: 0,
      crossDivisionPairing: true,
    },
    divisions: [],
    registrations: players.map((p) => ({
      playerId: p,
      roundsParticipating: [],
      registeredAt: '2024-01-01T00:00:00Z',
      withdrawn: false,
    })),
    rounds: [
      { number: 1, status: 'pending', pairings: [], byes: [] },
      { number: 2, status: 'pending', pairings: [], byes: [] },
      { number: 3, status: 'pending', pairings: [], byes: [] },
    ],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

const noop = () => {};

describe('RoundManager', () => {
  it('renders round tab buttons', () => {
    const tournament = makeTournament();
    render(
      <RoundManager
        tournament={tournament}
        onGeneratePairings={noop}
        onRecordResult={noop}
        onUnpairMatch={noop}
        onManualPair={noop}
        isPairing={false}
      />
    );
    // "Round 1" appears both in tab button and card title
    expect(screen.getAllByText('Round 1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Round 2')).toBeInTheDocument();
    expect(screen.getByText('Round 3')).toBeInTheDocument();
  });

  it('shows unpaired players for a pending round', () => {
    const tournament = makeTournament();
    render(
      <RoundManager
        tournament={tournament}
        onGeneratePairings={noop}
        onRecordResult={noop}
        onUnpairMatch={noop}
        onManualPair={noop}
        isPairing={false}
      />
    );
    expect(screen.getByText('Unpaired Players (4)')).toBeInTheDocument();
    expect(screen.getByText('Alice Chen')).toBeInTheDocument();
    expect(screen.getByText('Bob Kim')).toBeInTheDocument();
  });

  it('shows Generate Pairings button for pending round', () => {
    const tournament = makeTournament();
    render(
      <RoundManager
        tournament={tournament}
        onGeneratePairings={noop}
        onRecordResult={noop}
        onUnpairMatch={noop}
        onManualPair={noop}
        isPairing={false}
      />
    );
    expect(screen.getByText('Generate Pairings')).toBeInTheDocument();
  });

  it('calls onGeneratePairings when button clicked', async () => {
    const onGenerate = vi.fn();
    const user = userEvent.setup();
    const tournament = makeTournament();

    render(
      <RoundManager
        tournament={tournament}
        onGeneratePairings={onGenerate}
        onRecordResult={noop}
        onUnpairMatch={noop}
        onManualPair={noop}
        isPairing={false}
      />
    );

    await user.click(screen.getByText('Generate Pairings'));
    expect(onGenerate).toHaveBeenCalledWith(1);
  });

  it('shows "Pairing..." when isPairing is true', () => {
    const tournament = makeTournament();
    render(
      <RoundManager
        tournament={tournament}
        onGeneratePairings={noop}
        onRecordResult={noop}
        onUnpairMatch={noop}
        onManualPair={noop}
        isPairing={true}
      />
    );
    expect(screen.getByText('Pairing...')).toBeInTheDocument();
  });

  it('shows pairings table when round has pairings', () => {
    const tournament = makeTournament({
      rounds: [
        {
          number: 1,
          status: 'paired',
          pairings: [
            { blackPlayerId: 'p1', whitePlayerId: 'p2', boardNumber: 1, handicapStones: 0, komi: 6.5, result: 'no_result' },
            { blackPlayerId: 'p3', whitePlayerId: 'p4', boardNumber: 2, handicapStones: 2, komi: 0.5, result: 'no_result' },
          ],
          byes: [],
          pairedAt: '2024-01-01T09:00:00Z',
        },
        { number: 2, status: 'pending', pairings: [], byes: [] },
        { number: 3, status: 'pending', pairings: [], byes: [] },
      ],
    });

    render(
      <RoundManager
        tournament={tournament}
        onGeneratePairings={noop}
        onRecordResult={noop}
        onUnpairMatch={noop}
        onManualPair={noop}
        isPairing={false}
      />
    );

    expect(screen.getByText('Board')).toBeInTheDocument();
    expect(screen.getByText('Black')).toBeInTheDocument();
    expect(screen.getByText('White')).toBeInTheDocument();
    expect(screen.getByText('Alice Chen')).toBeInTheDocument();
    expect(screen.getByText('Bob Kim')).toBeInTheDocument();
  });

  it('displays handicap info correctly', () => {
    const tournament = makeTournament({
      rounds: [
        {
          number: 1,
          status: 'paired',
          pairings: [
            { blackPlayerId: 'p1', whitePlayerId: 'p2', boardNumber: 1, handicapStones: 0, komi: 6.5, result: 'no_result' },
            { blackPlayerId: 'p3', whitePlayerId: 'p4', boardNumber: 2, handicapStones: 2, komi: 0.5, result: 'no_result' },
          ],
          byes: [],
        },
        { number: 2, status: 'pending', pairings: [], byes: [] },
        { number: 3, status: 'pending', pairings: [], byes: [] },
      ],
    });

    render(
      <RoundManager
        tournament={tournament}
        onGeneratePairings={noop}
        onRecordResult={noop}
        onUnpairMatch={noop}
        onManualPair={noop}
        isPairing={false}
      />
    );

    expect(screen.getByText('Even, K6.5')).toBeInTheDocument();
    expect(screen.getByText('H2, K0.5')).toBeInTheDocument();
  });

  it('shows byes when present', () => {
    const tournament = makeTournament({
      registrations: players.slice(0, 3).map((p) => ({
        playerId: p,
        roundsParticipating: [],
        registeredAt: '2024-01-01T00:00:00Z',
        withdrawn: false,
      })),
      rounds: [
        {
          number: 1,
          status: 'paired',
          pairings: [
            { blackPlayerId: 'p1', whitePlayerId: 'p2', boardNumber: 1, handicapStones: 0, komi: 6.5, result: 'no_result' },
          ],
          byes: [{ playerId: 'p3', points: 1 }],
        },
        { number: 2, status: 'pending', pairings: [], byes: [] },
        { number: 3, status: 'pending', pairings: [], byes: [] },
      ],
    });

    render(
      <RoundManager
        tournament={tournament}
        onGeneratePairings={noop}
        onRecordResult={noop}
        onUnpairMatch={noop}
        onManualPair={noop}
        isPairing={false}
      />
    );

    expect(screen.getByText('Byes')).toBeInTheDocument();
    expect(screen.getByText('Carol Wang (1 point)')).toBeInTheDocument();
  });

  it('switches rounds when tab clicked', async () => {
    const user = userEvent.setup();
    const tournament = makeTournament({
      rounds: [
        {
          number: 1,
          status: 'completed',
          pairings: [
            { blackPlayerId: 'p1', whitePlayerId: 'p2', boardNumber: 1, handicapStones: 0, komi: 6.5, result: 'black_wins' },
            { blackPlayerId: 'p3', whitePlayerId: 'p4', boardNumber: 2, handicapStones: 0, komi: 6.5, result: 'white_wins' },
          ],
          byes: [],
        },
        { number: 2, status: 'pending', pairings: [], byes: [] },
        { number: 3, status: 'pending', pairings: [], byes: [] },
      ],
    });

    render(
      <RoundManager
        tournament={tournament}
        onGeneratePairings={noop}
        onRecordResult={noop}
        onUnpairMatch={noop}
        onManualPair={noop}
        isPairing={false}
      />
    );

    // Round 1 is active by default — shows completed status
    expect(screen.getByText('completed')).toBeInTheDocument();

    // Click Round 2
    await user.click(screen.getByText('Round 2'));
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('Pair Selected button disabled until exactly 2 players selected', async () => {
    const user = userEvent.setup();
    const tournament = makeTournament();

    render(
      <RoundManager
        tournament={tournament}
        onGeneratePairings={noop}
        onRecordResult={noop}
        onUnpairMatch={noop}
        onManualPair={noop}
        isPairing={false}
      />
    );

    const pairButton = screen.getByText('Pair Selected');
    expect(pairButton).toBeDisabled();

    // Select two players via checkboxes
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    expect(pairButton).toBeDisabled();

    await user.click(checkboxes[1]);
    expect(pairButton).not.toBeDisabled();
  });

  it('calls onManualPair when Pair Selected clicked with 2 players', async () => {
    const onManualPair = vi.fn();
    const user = userEvent.setup();
    const tournament = makeTournament();

    render(
      <RoundManager
        tournament={tournament}
        onGeneratePairings={noop}
        onRecordResult={noop}
        onUnpairMatch={noop}
        onManualPair={onManualPair}
        isPairing={false}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(screen.getByText('Pair Selected'));

    expect(onManualPair).toHaveBeenCalledWith(1, 'p1', 'p2');
  });

  it('shows "Pair Remaining" when some pairings exist', () => {
    const tournament = makeTournament({
      rounds: [
        {
          number: 1,
          status: 'paired',
          pairings: [
            { blackPlayerId: 'p1', whitePlayerId: 'p2', boardNumber: 1, handicapStones: 0, komi: 6.5, result: 'no_result' },
          ],
          byes: [],
        },
        { number: 2, status: 'pending', pairings: [], byes: [] },
        { number: 3, status: 'pending', pairings: [], byes: [] },
      ],
    });

    render(
      <RoundManager
        tournament={tournament}
        onGeneratePairings={noop}
        onRecordResult={noop}
        onUnpairMatch={noop}
        onManualPair={noop}
        isPairing={false}
      />
    );

    expect(screen.getByText('Pair Remaining')).toBeInTheDocument();
  });
});
