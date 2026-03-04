import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '../../utils';
import {
  BulkRegisterDialog,
  validateRows,
  categorizeRows,
  type CategorizedRow,
} from '@/components/tournament/BulkRegisterDialog';
import type { Player } from '@/types';

const player1: Player = {
  id: 'p1',
  name: 'Alice Chen',
  rank: '5d',
  club: 'NYC Go Club',
  agaId: '12345',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const player2: Player = {
  id: 'p2',
  name: 'Bob Kim',
  rank: '3d',
  club: 'Brooklyn Go',
  agaId: '67890',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('validateRows', () => {
  it('returns players for valid rows', () => {
    const data = [
      { name: 'John Doe', aga_id: '11111', rank: '5k' },
      { name: 'Jane Smith', aga_id: '22222', rank: '3d' },
    ];
    const { players, errors } = validateRows(data, ['name', 'aga_id', 'rank']);

    expect(errors).toHaveLength(0);
    expect(players).toHaveLength(2);
    expect(players[0]).toEqual({
      name: 'John Doe',
      agaId: '11111',
      rank: '5k',
      club: undefined,
      email: undefined,
    });
  });

  it('reports missing required columns', () => {
    const data = [{ name: 'John Doe', rank: '5k' }];
    const { players, errors } = validateRows(data, ['name', 'rank']);

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('Missing required columns: aga_id');
    expect(players).toHaveLength(0);
  });

  it('reports missing name in a row', () => {
    const data = [{ name: '', aga_id: '11111', rank: '5k' }];
    const { players, errors } = validateRows(data, ['name', 'aga_id', 'rank']);

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('missing name');
    expect(players).toHaveLength(0);
  });

  it('reports missing aga_id in a row', () => {
    const data = [{ name: 'John', aga_id: '', rank: '5k' }];
    const { players, errors } = validateRows(data, ['name', 'aga_id', 'rank']);

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('missing aga_id');
  });

  it('reports invalid rank format', () => {
    const data = [{ name: 'John', aga_id: '11111', rank: 'invalid' }];
    const { players, errors } = validateRows(data, ['name', 'aga_id', 'rank']);

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('invalid rank');
    expect(players).toHaveLength(0);
  });

  it('normalizes rank to lowercase', () => {
    const data = [{ name: 'John', aga_id: '11111', rank: '5K' }];
    const { players } = validateRows(data, ['name', 'aga_id', 'rank']);

    expect(players[0].rank).toBe('5k');
  });

  it('includes optional fields', () => {
    const data = [{ name: 'John', aga_id: '11111', rank: '5k', club: 'NYC', email: 'j@x.com' }];
    const { players } = validateRows(data, ['name', 'aga_id', 'rank', 'club', 'email']);

    expect(players[0].club).toBe('NYC');
    expect(players[0].email).toBe('j@x.com');
  });
});

describe('categorizeRows', () => {
  const allPlayers: Player[] = [player1, player2];
  const registeredIds = new Set(['p1']);

  it('categorizes new players', () => {
    const players = [{ name: 'New Person', agaId: '99999', rank: '5k' }];
    const result = categorizeRows(players, allPlayers, registeredIds);

    expect(result[0].status).toBe('new');
  });

  it('categorizes existing players', () => {
    const players = [{ name: 'Bob Kim', agaId: '67890', rank: '3d' }];
    const result = categorizeRows(players, allPlayers, registeredIds);

    expect(result[0].status).toBe('existing');
  });

  it('categorizes already registered players', () => {
    const players = [{ name: 'Alice Chen', agaId: '12345', rank: '5d' }];
    const result = categorizeRows(players, allPlayers, registeredIds);

    expect(result[0].status).toBe('already_registered');
  });

  it('categorizes name mismatches', () => {
    const players = [{ name: 'Robert Kim', agaId: '67890', rank: '3d' }];
    const result = categorizeRows(players, allPlayers, registeredIds);

    expect(result[0].status).toBe('mismatch');
    expect(result[0].dbName).toBe('Bob Kim');
  });

  it('handles case-insensitive name matching', () => {
    const players = [{ name: 'bob kim', agaId: '67890', rank: '3d' }];
    const result = categorizeRows(players, allPlayers, registeredIds);

    expect(result[0].status).toBe('existing');
  });
});

describe('BulkRegisterDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    allPlayers: [player1, player2],
    registeredPlayerIds: new Set(['p1']),
    onConfirm: vi.fn(),
    isLoading: false,
  };

  it('renders upload step initially', () => {
    render(<BulkRegisterDialog {...defaultProps} />);

    expect(screen.getByText('Import Players from CSV')).toBeInTheDocument();
    expect(screen.getByTestId('csv-file-input')).toBeInTheDocument();
  });

  it('shows validation errors for invalid CSV', async () => {
    render(<BulkRegisterDialog {...defaultProps} />);

    const file = new File(['name,rank\nJohn,5k'], 'test.csv', { type: 'text/csv' });
    const input = screen.getByTestId('csv-file-input');

    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText(/Missing required columns: aga_id/)).toBeInTheDocument();
    });
  });

  it('shows validation errors for invalid rank', async () => {
    render(<BulkRegisterDialog {...defaultProps} />);

    const file = new File(
      ['name,aga_id,rank\nJohn,11111,invalid'],
      'test.csv',
      { type: 'text/csv' }
    );
    const input = screen.getByTestId('csv-file-input');

    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText(/invalid rank/)).toBeInTheDocument();
    });
  });

  it('transitions to confirm step with valid CSV', async () => {
    render(<BulkRegisterDialog {...defaultProps} />);

    const csv = 'name,aga_id,rank\nNew Player,99999,5k\nBob Kim,67890,3d\nAlice Chen,12345,5d';
    const file = new File([csv], 'test.csv', { type: 'text/csv' });
    const input = screen.getByTestId('csv-file-input');

    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText('New Player')).toBeInTheDocument();
    });

    // Check status badges
    expect(screen.getByText('1 new')).toBeInTheDocument();
    expect(screen.getByText('1 existing')).toBeInTheDocument();
    expect(screen.getByText('1 already registered')).toBeInTheDocument();
  });

  it('shows name mismatch in confirm step', async () => {
    render(<BulkRegisterDialog {...defaultProps} />);

    const csv = 'name,aga_id,rank\nRobert Kim,67890,3d';
    const file = new File([csv], 'test.csv', { type: 'text/csv' });
    const input = screen.getByTestId('csv-file-input');

    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText('Robert Kim')).toBeInTheDocument();
    });

    expect(screen.getByText('DB: Bob Kim')).toBeInTheDocument();
    expect(screen.getByText('1 name mismatch')).toBeInTheDocument();
  });

  it('calls onConfirm with players to register (excluding already registered)', async () => {
    const onConfirm = vi.fn();
    render(<BulkRegisterDialog {...defaultProps} onConfirm={onConfirm} />);

    const csv = 'name,aga_id,rank\nNew Player,99999,5k\nAlice Chen,12345,5d';
    const file = new File([csv], 'test.csv', { type: 'text/csv' });
    const input = screen.getByTestId('csv-file-input');

    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText('New Player')).toBeInTheDocument();
    });

    const confirmButton = screen.getByText('Register 1 Player(s)');
    await userEvent.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledWith([
      { name: 'New Player', agaId: '99999', rank: '5k', club: undefined, email: undefined },
    ]);
  });

  it('goes back to upload step when Back is clicked', async () => {
    render(<BulkRegisterDialog {...defaultProps} />);

    const csv = 'name,aga_id,rank\nNew Player,99999,5k';
    const file = new File([csv], 'test.csv', { type: 'text/csv' });
    const input = screen.getByTestId('csv-file-input');

    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText('New Player')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Back'));

    expect(screen.getByTestId('csv-file-input')).toBeInTheDocument();
  });

  it('shows loading state during registration', async () => {
    render(<BulkRegisterDialog {...defaultProps} isLoading={true} />);

    const csv = 'name,aga_id,rank\nNew Player,99999,5k';
    const file = new File([csv], 'test.csv', { type: 'text/csv' });
    const input = screen.getByTestId('csv-file-input');

    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText('Registering...')).toBeInTheDocument();
    });
  });
});
