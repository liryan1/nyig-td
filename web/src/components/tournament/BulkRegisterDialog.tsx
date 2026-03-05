import { useState, useMemo, useRef } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

interface BulkRegisterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allPlayers: Player[];
  registeredPlayerIds: Set<string>;
  onConfirm: (players: ParsedPlayer[]) => void;
  isLoading: boolean;
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

const STATUS_LABELS: Record<RowStatus, string> = {
  new: 'New',
  existing: 'Existing',
  mismatch: 'Name Mismatch',
  already_registered: 'Already Registered',
};

const STATUS_VARIANTS: Record<RowStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  new: 'default',
  existing: 'secondary',
  mismatch: 'destructive',
  already_registered: 'outline',
};

export function BulkRegisterDialog({
  open,
  onOpenChange,
  allPlayers,
  registeredPlayerIds,
  onConfirm,
  isLoading,
}: BulkRegisterDialogProps) {
  const [step, setStep] = useState<'upload' | 'confirm'>('upload');
  const [, setParsedPlayers] = useState<ParsedPlayer[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [categorized, setCategorized] = useState<CategorizedRow[]>([]);
  const [pasteText, setPasteText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processData = (result: Papa.ParseResult<Record<string, string>>) => {
    const { players, errors: validationErrors } = validateRows(result.data, result.meta.fields || []);

    setErrors(validationErrors);
    setParsedPlayers(players);

    if (validationErrors.length === 0 && players.length > 0) {
      const rows = categorizeRows(players, allPlayers, registeredPlayerIds);
      setCategorized(rows);
      setStep('confirm');
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await parseCsvFile(file);
    processData(result);
  };

  const handlePasteImport = () => {
    const result = parseCsvString(pasteText);
    processData(result);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setStep('upload');
      setParsedPlayers([]);
      setErrors([]);
      setCategorized([]);
      setPasteText('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
    onOpenChange(open);
  };

  const handleBack = () => {
    setStep('upload');
    setParsedPlayers([]);
    setErrors([]);
    setCategorized([]);
    setPasteText('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirm = () => {
    const playersToRegister = categorized
      .filter((r) => r.status !== 'already_registered')
      .map((r) => r.player);
    onConfirm(playersToRegister);
  };

  const counts = useMemo(() => {
    const c = { new: 0, existing: 0, mismatch: 0, already_registered: 0 };
    for (const row of categorized) {
      c[row.status]++;
    }
    return c;
  }, [categorized]);

  const toRegisterCount = counts.new + counts.existing + counts.mismatch;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Players from CSV</DialogTitle>
          <DialogDescription>
            {step === 'upload'
              ? 'Upload a CSV file with columns: name, aga_id, rank. Optional: club, email.'
              : `${toRegisterCount} player(s) will be registered.`}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <Input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              data-testid="csv-file-input"
            />
            <div className="text-center text-sm text-muted-foreground">or</div>
            <textarea
              className="w-full min-h-30 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={"John Doe,12345,5k\nJane Smith,67890,3d"}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              data-testid="csv-paste-input"
            />
            <Button
              onClick={handlePasteImport}
              disabled={pasteText.trim().length === 0}
              variant="secondary"
              className="w-full"
            >
              Import
            </Button>
            {errors.length > 0 && (
              <div className="space-y-1" role="alert">
                {errors.map((error, i) => (
                  <p key={i} className="text-sm text-destructive">
                    {error.message}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'confirm' && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex gap-3 mb-4 flex-wrap">
              {counts.new > 0 && (
                <Badge variant="default">{counts.new} new</Badge>
              )}
              {counts.existing > 0 && (
                <Badge variant="secondary">{counts.existing} existing</Badge>
              )}
              {counts.mismatch > 0 && (
                <Badge variant="destructive">{counts.mismatch} name mismatch</Badge>
              )}
              {counts.already_registered > 0 && (
                <Badge variant="outline">{counts.already_registered} already registered</Badge>
              )}
            </div>

            <div className="overflow-auto flex-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>AGA ID</TableHead>
                    <TableHead>Rank</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categorized.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        {row.player.name}
                        {row.status === 'mismatch' && (
                          <span className="text-muted-foreground text-sm block">
                            DB: {row.dbName}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{row.player.agaId}</TableCell>
                      <TableCell>{row.player.rank}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANTS[row.status]}>
                          {STATUS_LABELS[row.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <DialogFooter>
            <Button variant="outline" onClick={handleBack} disabled={isLoading}>
              Back
            </Button>
            <Button onClick={handleConfirm} disabled={isLoading || toRegisterCount === 0}>
              {isLoading ? 'Registering...' : `Register ${toRegisterCount} Player(s)`}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
