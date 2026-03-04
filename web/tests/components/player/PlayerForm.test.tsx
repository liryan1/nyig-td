import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '../../utils';
import { PlayerForm } from '@/components/player/PlayerForm';

describe('PlayerForm', () => {
  it('renders all form fields', () => {
    render(<PlayerForm onSubmit={() => {}} onCancel={() => {}} />);
    expect(screen.getByLabelText(/Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Rank/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Club/)).toBeInTheDocument();
    expect(screen.getByLabelText(/AGA ID/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
  });

  it('calls onCancel when Cancel clicked', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(<PlayerForm onSubmit={() => {}} onCancel={onCancel} />);
    await user.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('validates required name', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(<PlayerForm onSubmit={onSubmit} onCancel={() => {}} />);

    // Fill rank but not name
    await user.type(screen.getByLabelText(/Rank/), '3d');
    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('validates rank format', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(<PlayerForm onSubmit={onSubmit} onCancel={() => {}} />);

    await user.type(screen.getByLabelText(/Name/), 'Test');
    await user.type(screen.getByLabelText(/Rank/), 'invalid');
    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText(/Invalid rank format/)).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits with valid data', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(<PlayerForm onSubmit={onSubmit} onCancel={() => {}} />);

    await user.type(screen.getByLabelText(/Name/), 'Jane Doe');
    await user.type(screen.getByLabelText(/Rank/), '2d');
    await user.type(screen.getByLabelText(/Club/), 'NYC Go');
    await user.type(screen.getByLabelText(/AGA ID/), '10001');
    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });

    const data = onSubmit.mock.calls[0][0];
    expect(data.name).toBe('Jane Doe');
    expect(data.rank).toBe('2d');
    expect(data.club).toBe('NYC Go');
  });

  it('accepts valid rank formats', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(<PlayerForm onSubmit={onSubmit} onCancel={() => {}} />);

    await user.type(screen.getByLabelText(/Name/), 'Test');
    await user.type(screen.getByLabelText(/Rank/), '15k');
    await user.type(screen.getByLabelText(/AGA ID/), '10002');
    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
    expect(onSubmit.mock.calls[0][0].rank).toBe('15k');
  });

  it('populates default values', () => {
    render(
      <PlayerForm
        onSubmit={() => {}}
        onCancel={() => {}}
        defaultValues={{ name: 'Alice', rank: '5d', club: 'Go Club', agaId: '12345' }}
      />
    );

    expect((screen.getByLabelText(/Name/) as HTMLInputElement).value).toBe('Alice');
    expect((screen.getByLabelText(/Rank/) as HTMLInputElement).value).toBe('5d');
    expect((screen.getByLabelText(/Club/) as HTMLInputElement).value).toBe('Go Club');
  });

  it('shows "Saving..." when isLoading', () => {
    render(<PlayerForm onSubmit={() => {}} onCancel={() => {}} isLoading={true} />);
    expect(screen.getByText('Saving...')).toBeInTheDocument();
    expect(screen.getByText('Saving...')).toBeDisabled();
  });
});
