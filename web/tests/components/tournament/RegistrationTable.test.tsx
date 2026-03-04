import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '../../utils';
import { RegistrationTable } from '@/components/tournament/RegistrationTable';
import type { PlayerRegistration, Player, Division } from '@/types';

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
  agaId: '12346',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const registrations: PlayerRegistration[] = [
  { playerId: player1, roundsParticipating: [], registeredAt: '2024-01-01T00:00:00Z', withdrawn: false },
  { playerId: player2, roundsParticipating: [1, 3], registeredAt: '2024-01-01T00:00:00Z', withdrawn: false },
];

describe('RegistrationTable', () => {
  it('renders player names and ranks', () => {
    render(<RegistrationTable registrations={registrations} onWithdraw={() => {}} />);
    expect(screen.getByText('Alice Chen')).toBeInTheDocument();
    expect(screen.getByText('Bob Kim')).toBeInTheDocument();
    expect(screen.getByText('5d')).toBeInTheDocument();
    expect(screen.getByText('3d')).toBeInTheDocument();
  });

  it('renders clubs', () => {
    render(<RegistrationTable registrations={registrations} onWithdraw={() => {}} />);
    expect(screen.getByText('NYC Go Club')).toBeInTheDocument();
    expect(screen.getByText('Brooklyn Go')).toBeInTheDocument();
  });

  it('shows "All" for empty roundsParticipating', () => {
    render(<RegistrationTable registrations={registrations} onWithdraw={() => {}} />);
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('shows specific rounds when set', () => {
    render(<RegistrationTable registrations={registrations} onWithdraw={() => {}} />);
    expect(screen.getByText('1, 3')).toBeInTheDocument();
  });

  it('hides withdrawn players', () => {
    const regs: PlayerRegistration[] = [
      { playerId: player1, roundsParticipating: [], registeredAt: '2024-01-01T00:00:00Z', withdrawn: true },
      { playerId: player2, roundsParticipating: [], registeredAt: '2024-01-01T00:00:00Z', withdrawn: false },
    ];
    render(<RegistrationTable registrations={regs} onWithdraw={() => {}} />);
    expect(screen.queryByText('Alice Chen')).not.toBeInTheDocument();
    expect(screen.getByText('Bob Kim')).toBeInTheDocument();
  });

  it('shows empty message when no active registrations', () => {
    render(<RegistrationTable registrations={[]} onWithdraw={() => {}} />);
    expect(screen.getByText('No players registered yet.')).toBeInTheDocument();
  });

  it('calls onWithdraw when button clicked', async () => {
    const onWithdraw = vi.fn();
    const user = userEvent.setup();
    render(<RegistrationTable registrations={registrations} onWithdraw={onWithdraw} />);

    const buttons = screen.getAllByText('Withdraw');
    await user.click(buttons[0]);
    expect(onWithdraw).toHaveBeenCalledWith('p1');
  });

  it('does not show division column when no divisions', () => {
    render(<RegistrationTable registrations={registrations} onWithdraw={() => {}} />);
    expect(screen.queryByText('Division')).not.toBeInTheDocument();
  });

  it('shows division column when divisions provided', () => {
    const divisions: Division[] = [{ id: 'div1', name: 'Open' }];
    const regsWithDiv: PlayerRegistration[] = [
      {
        playerId: player1,
        divisionId: 'div1',
        roundsParticipating: [],
        registeredAt: '2024-01-01T00:00:00Z',
        withdrawn: false,
      },
      {
        playerId: player2,
        roundsParticipating: [],
        registeredAt: '2024-01-01T00:00:00Z',
        withdrawn: false,
      },
    ];
    render(
      <RegistrationTable registrations={regsWithDiv} divisions={divisions} onWithdraw={() => {}} />
    );
    expect(screen.getByText('Division')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    // Bob has no division — should show dash
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('renders division dropdowns when onChangeDivision is provided', () => {
    const divisions: Division[] = [
      { id: 'div1', name: 'Open' },
      { id: 'div2', name: 'Kyu' },
    ];
    const regsWithDiv: PlayerRegistration[] = [
      {
        playerId: player1,
        divisionId: 'div1',
        roundsParticipating: [],
        registeredAt: '2024-01-01T00:00:00Z',
        withdrawn: false,
      },
      {
        playerId: player2,
        roundsParticipating: [],
        registeredAt: '2024-01-01T00:00:00Z',
        withdrawn: false,
      },
    ];
    render(
      <RegistrationTable
        registrations={regsWithDiv}
        divisions={divisions}
        onWithdraw={() => {}}
        onChangeDivision={() => {}}
      />
    );
    // Should render Select triggers (dropdowns) instead of static text
    const triggers = screen.getAllByRole('combobox', { name: 'Division' });
    expect(triggers).toHaveLength(2);
  });

  it('calls onChangeDivision when division is changed', async () => {
    const onChangeDivision = vi.fn();
    const user = userEvent.setup();
    const divisions: Division[] = [
      { id: 'div1', name: 'Open' },
      { id: 'div2', name: 'Kyu' },
    ];
    const regsWithDiv: PlayerRegistration[] = [
      {
        playerId: player1,
        roundsParticipating: [],
        registeredAt: '2024-01-01T00:00:00Z',
        withdrawn: false,
      },
    ];
    render(
      <RegistrationTable
        registrations={regsWithDiv}
        divisions={divisions}
        onWithdraw={() => {}}
        onChangeDivision={onChangeDivision}
      />
    );

    // Click the dropdown trigger
    const trigger = screen.getByRole('combobox', { name: 'Division' });
    await user.click(trigger);

    // Select the "Open" option (use findByRole to wait for portal render)
    const option = await screen.findByRole('option', { name: 'Open' });
    await user.click(option);

    expect(onChangeDivision).toHaveBeenCalledWith('p1', 'div1');
  });

  it('calls onChangeDivision with null when "None" is selected', async () => {
    const onChangeDivision = vi.fn();
    const user = userEvent.setup();
    const divisions: Division[] = [{ id: 'div1', name: 'Open' }];
    const regsWithDiv: PlayerRegistration[] = [
      {
        playerId: player1,
        divisionId: 'div1',
        roundsParticipating: [],
        registeredAt: '2024-01-01T00:00:00Z',
        withdrawn: false,
      },
    ];
    render(
      <RegistrationTable
        registrations={regsWithDiv}
        divisions={divisions}
        onWithdraw={() => {}}
        onChangeDivision={onChangeDivision}
      />
    );

    const trigger = screen.getByRole('combobox', { name: 'Division' });
    await user.click(trigger);

    const noneOption = await screen.findByRole('option', { name: 'None' });
    await user.click(noneOption);

    expect(onChangeDivision).toHaveBeenCalledWith('p1', null);
  });
});
