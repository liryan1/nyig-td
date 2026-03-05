import Papa from 'papaparse';
import type { Player } from '@/types';

interface ParsedPlayer {
  name: string;
  agaId: string;
  rank: string;
  club?: string;
  email?: string;
}

export type RowStatus = 'new' | 'existing' | 'mismatch' | 'already_registered';

export interface CategorizedRow {
  player: ParsedPlayer;
  status: RowStatus;
  dbName?: string;
}

interface ValidationError {
  row: number;
  message: string;
}

const RANK_PATTERN = /^\d+[kdKD]$/;

const REQUIRED_COLUMNS = ['name', 'aga_id', 'rank'];

const POSITIONAL_COLUMNS = ['name', 'aga_id', 'rank', 'club', 'email'];

function detectHasHeaders(text: string): boolean {
  const firstLine = text.split('\n')[0] ?? '';
  const parsed = Papa.parse<string[]>(firstLine, { header: false });
  const values = (parsed.data[0] || []).map((v) => v.trim().toLowerCase());
  return REQUIRED_COLUMNS.every((col) => values.includes(col));
}

export function parseCsvFile(file: File): Promise<Papa.ParseResult<Record<string, string>>> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(parseCsvString(reader.result as string));
    };
    reader.readAsText(file);
  });
}

export function parseCsvString(text: string): Papa.ParseResult<Record<string, string>> {
  if (detectHasHeaders(text)) {
    return Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
    });
  }

  // No headers — parse without headers and map columns positionally
  const raw = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: true,
  });

  const data = raw.data.map((row) => {
    const record: Record<string, string> = {};
    for (let i = 0; i < row.length && i < POSITIONAL_COLUMNS.length; i++) {
      record[POSITIONAL_COLUMNS[i]] = row[i];
    }
    return record;
  });

  const maxCols = Math.max(...raw.data.map((r) => r.length), 0);
  const fields = POSITIONAL_COLUMNS.slice(0, maxCols);

  return {
    data,
    errors: raw.errors,
    meta: { ...raw.meta, fields },
  } as Papa.ParseResult<Record<string, string>>;
}

export function validateRows(
  data: Record<string, string>[],
  fields: string[]
): { players: ParsedPlayer[]; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const players: ParsedPlayer[] = [];

  // Check required columns exist
  const missingColumns = REQUIRED_COLUMNS.filter((col) => !fields.includes(col));
  if (missingColumns.length > 0) {
    errors.push({ row: 0, message: `Missing required columns: ${missingColumns.join(', ')}` });
    return { players, errors };
  }

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 1;

    const name = row['name']?.trim();
    const agaId = row['aga_id']?.trim();
    const rank = row['rank']?.trim();

    if (!name) {
      errors.push({ row: rowNum, message: `Row ${rowNum}: missing name` });
      continue;
    }
    if (!agaId) {
      errors.push({ row: rowNum, message: `Row ${rowNum}: missing aga_id` });
      continue;
    }
    if (!rank) {
      errors.push({ row: rowNum, message: `Row ${rowNum}: missing rank` });
      continue;
    }
    if (!RANK_PATTERN.test(rank)) {
      errors.push({ row: rowNum, message: `Row ${rowNum}: invalid rank "${rank}" (expected e.g. 5k, 3d)` });
      continue;
    }

    players.push({
      name,
      agaId,
      rank: rank.toLowerCase(),
      club: row['club']?.trim() || undefined,
      email: row['email']?.trim() || undefined,
    });
  }

  return { players, errors };
}

export function categorizeRows(
  players: ParsedPlayer[],
  allPlayers: Player[],
  registeredPlayerIds: Set<string>
): CategorizedRow[] {
  const playerByAgaId = new Map<string, Player>();
  for (const p of allPlayers) {
    if (p.agaId) {
      playerByAgaId.set(p.agaId, p);
    }
  }

  return players.map((player) => {
    const dbPlayer = playerByAgaId.get(player.agaId);

    if (!dbPlayer) {
      return { player, status: 'new' as RowStatus };
    }

    if (dbPlayer.name.toLowerCase() !== player.name.toLowerCase()) {
      return { player, status: 'mismatch' as RowStatus, dbName: dbPlayer.name };
    }

    if (registeredPlayerIds.has(dbPlayer.id)) {
      return { player, status: 'already_registered' as RowStatus, dbName: dbPlayer.name };
    }

    return { player, status: 'existing' as RowStatus };
  });
}
