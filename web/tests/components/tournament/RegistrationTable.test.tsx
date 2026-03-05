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
  { playerId: player1, roundsParticipating: [], registeredAt: '2024-01-01T00:00:00Z', withdrawn: false, checkedIn: false },
  { playerId: player2, roundsParticipating: [1, 3], registeredAt: '2024-01-01T00:00:00Z', withdrawn: false, checkedIn: false },
];

describe('RegistrationTable', () => {
  it('renders player names and ranks', () => {
    render(<RegistrationTable registrations={registrations} />);
    expect(screen.getByText('Alice Chen')).toBeInTheDocument();
    expect(screen.getByText('Bob Kim')).toBeInTheDocument();
    expect(screen.getByText('5d')).toBeInTheDocument();
    expect(screen.getByText('3d')).toBeInTheDocument();
  });

  it('renders clubs', () => {
    render(<RegistrationTable registrations={registrations} />);
    expect(screen.getByText('NYC Go Club')).toBeInTheDocument();
    expect(screen.getByText('Brooklyn Go')).toBeInTheDocument();
  });

  it('shows "All" for empty roundsParticipating when no numRounds', () => {
    render(<RegistrationTable registrations={registrations} />);
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('shows specific rounds as text when no numRounds', () => {
    render(<RegistrationTable registrations={registrations} />);
    expect(screen.getByText('1, 3')).toBeInTheDocument();
  });

  it('hides withdrawn players', () => {
    const regs: PlayerRegistration[] = [
      { playerId: player1, roundsParticipating: [], registeredAt: '2024-01-01T00:00:00Z', withdrawn: true, checkedIn: false },
      { playerId: player2, roundsParticipating: [], registeredAt: '2024-01-01T00:00:00Z', withdrawn: false, checkedIn: false },
    ];
    render(<RegistrationTable registrations={regs} />);
    expect(screen.queryByText('Alice Chen')).not.toBeInTheDocument();
    expect(screen.getByText('Bob Kim')).toBeInTheDocument();
  });

  it('shows empty message when no active registrations', () => {
    render(<RegistrationTable registrations={[]} />);
    expect(screen.getByText('No players registered yet.')).toBeInTheDocument();
  });

  it('withdraw button hides player and shows pending withdrawal message', async () => {
    const user = userEvent.setup();
    render(
      <RegistrationTable
        registrations={registrations}
        numRounds={4}
        onSave={() => {}}
      />
    );

    const buttons = screen.getAllByText('Withdraw');
    await user.click(buttons[0]);

    // Alice should be hidden
    expect(screen.queryByText('Alice Chen')).not.toBeInTheDocument();
    expect(screen.getByText('Bob Kim')).toBeInTheDocument();
    // Pending withdrawal message
    expect(screen.getByText('1 player pending withdrawal')).toBeInTheDocument();
    // Save bar should appear
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });

  it('does not show division column when no divisions', () => {
    render(<RegistrationTable registrations={registrations} />);
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
        checkedIn: false,
      },
      {
        playerId: player2,
        roundsParticipating: [],
        registeredAt: '2024-01-01T00:00:00Z',
        withdrawn: false,
        checkedIn: false,
      },
    ];
    render(
      <RegistrationTable registrations={regsWithDiv} divisions={divisions} />
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
        checkedIn: false,
      },
      {
        playerId: player2,
        roundsParticipating: [],
        registeredAt: '2024-01-01T00:00:00Z',
        withdrawn: false,
        checkedIn: false,
      },
    ];
    render(
      <RegistrationTable
        registrations={regsWithDiv}
        divisions={divisions}
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
        checkedIn: false,
      },
    ];
    render(
      <RegistrationTable
        registrations={regsWithDiv}
        divisions={divisions}
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
        checkedIn: false,
      },
    ];
    render(
      <RegistrationTable
        registrations={regsWithDiv}
        divisions={divisions}
        onChangeDivision={onChangeDivision}
      />
    );

    const trigger = screen.getByRole('combobox', { name: 'Division' });
    await user.click(trigger);

    const noneOption = await screen.findByRole('option', { name: 'None' });
    await user.click(noneOption);

    expect(onChangeDivision).toHaveBeenCalledWith('p1', null);
  });

  describe('check-in', () => {
    const checkInRegs: PlayerRegistration[] = [
      { playerId: player1, roundsParticipating: [], registeredAt: '2024-01-01T00:00:00Z', withdrawn: false, checkedIn: false },
      { playerId: player2, roundsParticipating: [], registeredAt: '2024-01-01T00:00:00Z', withdrawn: false, checkedIn: true },
    ];

    it('renders check-in checkboxes when onSave is provided', () => {
      render(
        <RegistrationTable
          registrations={checkInRegs}
          numRounds={4}
          onSave={() => {}}
        />
      );
      const aliceCheckIn = screen.getByRole('checkbox', { name: 'Check in Alice Chen' });
      const bobCheckIn = screen.getByRole('checkbox', { name: 'Check in Bob Kim' });
      expect(aliceCheckIn).not.toBeChecked();
      expect(bobCheckIn).toBeChecked();
    });

    it('toggling check-in updates locally and shows save bar', async () => {
      const user = userEvent.setup();
      render(
        <RegistrationTable
          registrations={checkInRegs}
          numRounds={4}
          onSave={() => {}}
        />
      );

      expect(screen.queryByText('Save Changes')).not.toBeInTheDocument();

      const aliceCheckIn = screen.getByRole('checkbox', { name: 'Check in Alice Chen' });
      await user.click(aliceCheckIn);

      // Should be checked now (local override)
      expect(aliceCheckIn).toBeChecked();
      // Save bar should appear
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });

    it('toggling check-in back to server state removes override', async () => {
      const user = userEvent.setup();
      render(
        <RegistrationTable
          registrations={checkInRegs}
          numRounds={4}
          onSave={() => {}}
        />
      );

      const aliceCheckIn = screen.getByRole('checkbox', { name: 'Check in Alice Chen' });
      await user.click(aliceCheckIn); // check
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
      await user.click(aliceCheckIn); // uncheck back to server state

      expect(screen.queryByText('Save Changes')).not.toBeInTheDocument();
    });

    it('includes check-in changes in onSave payload', async () => {
      const onSave = vi.fn();
      const user = userEvent.setup();
      render(
        <RegistrationTable
          registrations={checkInRegs}
          numRounds={4}
          onSave={onSave}
        />
      );

      const aliceCheckIn = screen.getByRole('checkbox', { name: 'Check in Alice Chen' });
      await user.click(aliceCheckIn);

      await user.click(screen.getByText('Save Changes'));

      expect(onSave).toHaveBeenCalledWith([
        { playerId: 'p1', checkedIn: true },
      ]);
    });
  });

  describe('withdraw', () => {
    it('discard restores withdrawn player', async () => {
      const user = userEvent.setup();
      render(
        <RegistrationTable
          registrations={registrations}
          numRounds={4}
          onSave={() => {}}
        />
      );

      // Withdraw Alice
      const buttons = screen.getAllByText('Withdraw');
      await user.click(buttons[0]);
      expect(screen.queryByText('Alice Chen')).not.toBeInTheDocument();

      // Discard
      await user.click(screen.getByText('Discard'));
      expect(screen.getByText('Alice Chen')).toBeInTheDocument();
      expect(screen.queryByText('Save Changes')).not.toBeInTheDocument();
    });

    it('includes withdraw in onSave payload', async () => {
      const onSave = vi.fn();
      const user = userEvent.setup();
      render(
        <RegistrationTable
          registrations={registrations}
          numRounds={4}
          onSave={onSave}
        />
      );

      const buttons = screen.getAllByText('Withdraw');
      await user.click(buttons[0]);

      await user.click(screen.getByText('Save Changes'));

      expect(onSave).toHaveBeenCalledWith([
        { playerId: 'p1', withdrawn: true },
      ]);
    });
  });

  describe('round checkboxes', () => {
    const allRoundsRegs: PlayerRegistration[] = [
      { playerId: player1, roundsParticipating: [], registeredAt: '2024-01-01T00:00:00Z', withdrawn: false, checkedIn: false },
      { playerId: player2, roundsParticipating: [1, 3], registeredAt: '2024-01-01T00:00:00Z', withdrawn: false, checkedIn: false },
    ];

    it('renders round checkboxes when numRounds and onSave are provided', () => {
      render(
        <RegistrationTable
          registrations={allRoundsRegs}
          numRounds={4}
          onSave={() => {}}
        />
      );
      // Alice has all rounds (roundsParticipating=[]), all 4 checkboxes should be checked
      const aliceR1 = screen.getByRole('checkbox', { name: 'R1 for Alice Chen' });
      const aliceR4 = screen.getByRole('checkbox', { name: 'R4 for Alice Chen' });
      expect(aliceR1).toBeChecked();
      expect(aliceR4).toBeChecked();

      // Bob has rounds [1, 3], so R2 and R4 should be unchecked
      const bobR1 = screen.getByRole('checkbox', { name: 'R1 for Bob Kim' });
      const bobR2 = screen.getByRole('checkbox', { name: 'R2 for Bob Kim' });
      const bobR3 = screen.getByRole('checkbox', { name: 'R3 for Bob Kim' });
      const bobR4 = screen.getByRole('checkbox', { name: 'R4 for Bob Kim' });
      expect(bobR1).toBeChecked();
      expect(bobR2).not.toBeChecked();
      expect(bobR3).toBeChecked();
      expect(bobR4).not.toBeChecked();
    });

    it('shows Save Changes button after toggling a checkbox', async () => {
      const user = userEvent.setup();
      render(
        <RegistrationTable
          registrations={allRoundsRegs}
          numRounds={4}
          onSave={() => {}}
        />
      );

      // Initially no save button
      expect(screen.queryByText('Save Changes')).not.toBeInTheDocument();

      // Uncheck R4 for Alice
      const aliceR4 = screen.getByRole('checkbox', { name: 'R4 for Alice Chen' });
      await user.click(aliceR4);

      // Save button should now appear
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
      expect(screen.getByText('Discard')).toBeInTheDocument();
    });

    it('clears changes when Discard is clicked', async () => {
      const user = userEvent.setup();
      render(
        <RegistrationTable
          registrations={allRoundsRegs}
          numRounds={4}
          onSave={() => {}}
        />
      );

      // Uncheck R4 for Alice
      const aliceR4 = screen.getByRole('checkbox', { name: 'R4 for Alice Chen' });
      await user.click(aliceR4);
      expect(aliceR4).not.toBeChecked();
      expect(screen.getByText('Save Changes')).toBeInTheDocument();

      // Click discard
      await user.click(screen.getByText('Discard'));

      // Save button should be gone, checkbox should be checked again
      expect(screen.queryByText('Save Changes')).not.toBeInTheDocument();
      expect(aliceR4).toBeChecked();
    });

    it('calls onSave with correct data when Save Changes is clicked', async () => {
      const onSave = vi.fn();
      const user = userEvent.setup();
      render(
        <RegistrationTable
          registrations={allRoundsRegs}
          numRounds={4}
          onSave={onSave}
        />
      );

      // Uncheck R4 for Alice (she had all rounds = [])
      const aliceR4 = screen.getByRole('checkbox', { name: 'R4 for Alice Chen' });
      await user.click(aliceR4);

      // Click save
      await user.click(screen.getByText('Save Changes'));

      expect(onSave).toHaveBeenCalledWith([
        { playerId: 'p1', roundsParticipating: [1, 2, 3] },
      ]);
    });

    it('removes override when toggling back to server state', async () => {
      const user = userEvent.setup();
      render(
        <RegistrationTable
          registrations={allRoundsRegs}
          numRounds={4}
          onSave={() => {}}
        />
      );

      // Uncheck then re-check R4 for Alice
      const aliceR4 = screen.getByRole('checkbox', { name: 'R4 for Alice Chen' });
      await user.click(aliceR4); // uncheck
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
      await user.click(aliceR4); // re-check

      // Should no longer be dirty
      expect(screen.queryByText('Save Changes')).not.toBeInTheDocument();
    });

    it('calls onDirtyChange when dirty state changes', async () => {
      const onDirtyChange = vi.fn();
      const user = userEvent.setup();
      render(
        <RegistrationTable
          registrations={allRoundsRegs}
          numRounds={4}
          onSave={() => {}}
          onDirtyChange={onDirtyChange}
        />
      );

      // Initially called with false
      expect(onDirtyChange).toHaveBeenCalledWith(false);

      // Toggle a checkbox
      const aliceR4 = screen.getByRole('checkbox', { name: 'R4 for Alice Chen' });
      await user.click(aliceR4);
      expect(onDirtyChange).toHaveBeenCalledWith(true);
    });

    it('disables checkboxes when isSaving is true', () => {
      render(
        <RegistrationTable
          registrations={allRoundsRegs}
          numRounds={4}
          onSave={() => {}}
          isSaving={true}
        />
      );

      const aliceR1 = screen.getByRole('checkbox', { name: 'R1 for Alice Chen' });
      expect(aliceR1).toBeDisabled();
    });
  });

  describe('combined changes', () => {
    it('saves round, check-in, and withdraw changes together', async () => {
      const onSave = vi.fn();
      const user = userEvent.setup();
      const regs: PlayerRegistration[] = [
        { playerId: player1, roundsParticipating: [], registeredAt: '2024-01-01T00:00:00Z', withdrawn: false, checkedIn: false },
        { playerId: player2, roundsParticipating: [1, 3], registeredAt: '2024-01-01T00:00:00Z', withdrawn: false, checkedIn: false },
      ];
      render(
        <RegistrationTable
          registrations={regs}
          numRounds={4}
          onSave={onSave}
        />
      );

      // Check in Alice
      const aliceCheckIn = screen.getByRole('checkbox', { name: 'Check in Alice Chen' });
      await user.click(aliceCheckIn);

      // Uncheck R4 for Alice
      const aliceR4 = screen.getByRole('checkbox', { name: 'R4 for Alice Chen' });
      await user.click(aliceR4);

      // Withdraw Bob
      const withdrawButtons = screen.getAllByText('Withdraw');
      await user.click(withdrawButtons[1]); // Bob is second

      // Save
      await user.click(screen.getByText('Save Changes'));

      const calls = onSave.mock.calls[0][0];
      expect(calls).toHaveLength(2);

      const aliceUpdate = calls.find((c: { playerId: string }) => c.playerId === 'p1');
      expect(aliceUpdate).toEqual({ playerId: 'p1', roundsParticipating: [1, 2, 3], checkedIn: true });

      const bobUpdate = calls.find((c: { playerId: string }) => c.playerId === 'p2');
      expect(bobUpdate).toEqual({ playerId: 'p2', withdrawn: true });
    });
  });
});
