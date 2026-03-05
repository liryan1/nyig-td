import { TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

export function WarningAlert({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200',
        className,
      )}
    >
      <TriangleAlert className="h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
