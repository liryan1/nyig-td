import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TiebreakerCriteria } from '@/types';

const CRITERIA_LABELS: Record<TiebreakerCriteria, string> = {
  wins: 'Wins',
  sos: 'SOS (Sum of Opponents\' Scores)',
  sds: 'SDS (Sum of Defeated opponents\' Scores)',
  sosos: 'SOSOS (Sum of Opponents\' SOS)',
  hth: 'HTH (Head-to-Head)',
};

const ALL_CRITERIA: TiebreakerCriteria[] = ['wins', 'sos', 'sds', 'sosos', 'hth'];

interface TiebreakerOrderEditorProps {
  value: TiebreakerCriteria[];
  onChange: (value: TiebreakerCriteria[]) => void;
}

export function TiebreakerOrderEditor({ value, onChange }: TiebreakerOrderEditorProps) {
  const available = ALL_CRITERIA.filter((c) => !value.includes(c));

  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...value];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next);
  };

  const moveDown = (index: number) => {
    if (index === value.length - 1) return;
    const next = [...value];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(next);
  };

  const remove = (index: number) => {
    if (value.length <= 1) return;
    onChange(value.filter((_, i) => i !== index));
  };

  const add = (criteria: TiebreakerCriteria) => {
    if (value.length >= 4) return;
    onChange([...value, criteria]);
  };

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        {value.map((criteria, index) => (
          <div
            key={criteria}
            className="flex items-center gap-2 p-2 border rounded text-sm"
          >
            <span className="text-muted-foreground w-5 text-center">{index + 1}.</span>
            <span className="flex-1">{CRITERIA_LABELS[criteria]}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => moveUp(index)}
              disabled={index === 0}
            >
              ↑
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => moveDown(index)}
              disabled={index === value.length - 1}
            >
              ↓
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={() => remove(index)}
              disabled={value.length <= 1}
            >
              ×
            </Button>
          </div>
        ))}
      </div>

      {available.length > 0 && value.length < 4 && (
        <Select onValueChange={(v) => add(v as TiebreakerCriteria)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Add tiebreaker..." />
          </SelectTrigger>
          <SelectContent>
            {available.map((criteria) => (
              <SelectItem key={criteria} value={criteria}>
                {CRITERIA_LABELS[criteria]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
