import { useState, useMemo, useRef } from 'react';
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
import type { RowStatus, CategorizedRow } from './bulkRegisterUtils';
import { parseCsvFile, parseCsvString, validateRows, categorizeRows } from './bulkRegisterUtils';

interface ParsedPlayer {
  name: string;
  agaId: string;
  rank: string;
  club?: string;
  email?: string;
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
