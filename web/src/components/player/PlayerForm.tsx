import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import type { CreatePlayerForm } from '@/types';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  rank: z.string().regex(/^\d+[kdKD]$/, 'Invalid rank format (e.g., 5k, 3d)'),
  club: z.string().max(100).optional(),
  agaId: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

interface PlayerFormProps {
  onSubmit: (data: CreatePlayerForm) => void;
  onCancel: () => void;
  isLoading?: boolean;
  defaultValues?: Partial<CreatePlayerForm>;
}

export function PlayerForm({ onSubmit, onCancel, isLoading, defaultValues }: PlayerFormProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      rank: '',
      club: '',
      agaId: '',
      email: '',
      ...defaultValues,
    },
  });

  const handleSubmit = (data: FormData) => {
    onSubmit(data as CreatePlayerForm);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name *</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="rank"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rank *</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g., 5k, 3d" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="club"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Club</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="agaId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>AGA ID</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
