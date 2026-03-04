// API service exports
// Set VITE_USE_MOCK_API=true in .env to use mock data without a backend

import * as realApi from './api';
import * as mockApi from './mockApi';

const useMockApi = import.meta.env.VITE_USE_MOCK_API === 'true';

// Log which API is being used (dev only)
if (import.meta.env.DEV) {
  console.log(`[API] Using ${useMockApi ? 'MOCK' : 'REAL'} API`);
}

// Select the appropriate implementation
const api = useMockApi ? mockApi : realApi;

// Export all API functions
export const listPlayers = api.listPlayers;
export const getPlayer = api.getPlayer;
export const createPlayer = api.createPlayer;
export const updatePlayer = api.updatePlayer;
export const deletePlayer = api.deletePlayer;

export const listTournaments = api.listTournaments;
export const getTournament = api.getTournament;
export const createTournament = api.createTournament;
export const updateTournament = api.updateTournament;
export const deleteTournament = api.deleteTournament;

export const registerPlayer = api.registerPlayer;
export const bulkRegisterPlayers = api.bulkRegisterPlayers;
export const withdrawPlayer = api.withdrawPlayer;
export const updatePlayerRounds = api.updatePlayerRounds;
export const updateRegistration = api.updateRegistration;

export const checkInPlayer = api.checkInPlayer;
export const bulkCheckInPlayers = api.bulkCheckInPlayers;
export const selfCheckIn = api.selfCheckIn;

export const addDivision = api.addDivision;
export const updateDivision = api.updateDivision;
export const removeDivision = api.removeDivision;

export const generatePairings = api.generatePairings;
export const unpairMatch = api.unpairMatch;
export const manualPair = api.manualPair;
export const recordResult = api.recordResult;
export const publishRound = api.publishRound;
export const getPublicTournament = api.getPublicTournament;

export const getStandings = api.getStandings;
export const getDivisionStandings = api.getDivisionStandings;

// Export mock-only utilities (for testing)
export const resetMockData = 'resetMockData' in api ? api.resetMockData : () => {};
