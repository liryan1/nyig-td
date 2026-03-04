import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import type { CreateTournamentForm } from '@/types';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(2000).optional(),
  date: z.string().min(1, 'Date is required'),
  location: z.string().max(200).optional(),
  settings: z.object({
    numRounds: z.number().int().min(1).max(10),
    pairingAlgorithm: z.enum(['swiss', 'mcmahon', 'round_robin']),
    handicapEnabled: z.boolean(),
    handicapReduction: z.number().int().min(0).max(5),
    mcmahonBar: z.string().regex(/^\d+[kdKD]$/).optional().or(z.literal('')),
    crossDivisionPairing: z.boolean(),
  }),
});

type FormData = z.infer<typeof schema>;

interface TournamentFormProps {
  onSubmit: (data: CreateTournamentForm) => void;
  onCancel: () => void;
  isLoading?: boolean;
  defaultValues?: Partial<CreateTournamentForm>;
}

export function TournamentForm({ onSubmit, onCancel, isLoading, defaultValues }: TournamentFormProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      date: new Date().toISOString().split('T')[0],
      settings: {
        numRounds: 4,
        pairingAlgorithm: 'mcmahon',
        handicapEnabled: true,
        handicapReduction: 0,
        mcmahonBar: '3d',
        crossDivisionPairing: true,
      },
      ...defaultValues,
    },
  });

  const algorithm = useWatch({ control: form.control, name: 'settings.pairingAlgorithm' });

  const handleSubmit = (data: FormData) => {
    onSubmit(data as CreateTournamentForm);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tournament Name *</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date *</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Location</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea {...field} rows={3} />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="settings.numRounds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Number of Rounds *</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="settings.pairingAlgorithm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pairing Algorithm *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="mcmahon">McMahon</SelectItem>
                    <SelectItem value="swiss">Swiss</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        </div>

        {algorithm === 'mcmahon' && (
          <FormField
            control={form.control}
            name="settings.mcmahonBar"
            render={({ field }) => (
              <FormItem>
                <FormLabel>McMahon Bar</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g., 3d" />
                </FormControl>
                <FormDescription>
                  Players at or above this rank start with score 0
                </FormDescription>
              </FormItem>
            )}
          />
        )}

        <div className="flex items-center gap-4">
          <FormField
            control={form.control}
            name="settings.handicapEnabled"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel className="!mt-0">Enable Handicaps</FormLabel>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="settings.handicapReduction"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2">
                <FormLabel className="!mt-0">Reduction:</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={5}
                    className="w-16"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="settings.crossDivisionPairing"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div>
                <FormLabel className="!mt-0">Cross-Division Pairing</FormLabel>
                <FormDescription>
                  Pair players across divisions (uncheck to pair within division only)
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Tournament'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
