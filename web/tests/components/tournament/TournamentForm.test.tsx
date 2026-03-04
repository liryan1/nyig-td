import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '../../utils';
import { TournamentForm } from '@/components/tournament/TournamentForm';

describe('TournamentForm', () => {
  it('renders all form fields', () => {
    render(<TournamentForm onSubmit={() => {}} onCancel={() => {}} />);
    expect(screen.getByLabelText(/Tournament Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Date/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Location/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Number of Rounds/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Handicap Type/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Cross-Division Pairing/)).toBeInTheDocument();
  });

  it('has correct default values', () => {
    render(<TournamentForm onSubmit={() => {}} onCancel={() => {}} />);
    const roundsInput = screen.getByLabelText(/Number of Rounds/) as HTMLInputElement;
    expect(roundsInput.value).toBe('4');
  });

  it('shows McMahon Bar when mcmahon algorithm selected', () => {
    render(<TournamentForm onSubmit={() => {}} onCancel={() => {}} />);
    // Default is mcmahon, so McMahon Bar should be visible
    expect(screen.getByLabelText(/McMahon Bar/)).toBeInTheDocument();
  });

  it('calls onCancel when Cancel clicked', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(<TournamentForm onSubmit={() => {}} onCancel={onCancel} />);
    await user.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('validates required name field', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(<TournamentForm onSubmit={onSubmit} onCancel={() => {}} />);

    // Clear the name field and submit
    const nameInput = screen.getByLabelText(/Tournament Name/);
    await user.clear(nameInput);
    await user.click(screen.getByText('Create Tournament'));

    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits form with valid data', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(<TournamentForm onSubmit={onSubmit} onCancel={() => {}} />);

    await user.type(screen.getByLabelText(/Tournament Name/), 'My Tournament');
    await user.click(screen.getByText('Create Tournament'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });

    const data = onSubmit.mock.calls[0][0];
    expect(data.name).toBe('My Tournament');
    expect(data.settings.numRounds).toBe(4);
    expect(data.settings.handicapType).toBe('rank_difference');
    expect(data.settings.crossDivisionPairing).toBe(true);
  });

  it('shows "Creating..." when isLoading', () => {
    render(<TournamentForm onSubmit={() => {}} onCancel={() => {}} isLoading={true} />);
    expect(screen.getByText('Creating...')).toBeInTheDocument();
  });

  it('disables submit button when isLoading', () => {
    render(<TournamentForm onSubmit={() => {}} onCancel={() => {}} isLoading={true} />);
    expect(screen.getByText('Creating...')).toBeDisabled();
  });
});
