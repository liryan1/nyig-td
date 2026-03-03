import { Link, Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Tournaments', href: '/' },
  { name: 'Players', href: '/players' },
];

export function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen">
      <nav className="bg-primary">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Link to="/" className="text-primary-foreground font-bold text-xl">
                NYIG Tournament
              </Link>
              <div className="ml-10 flex items-baseline space-x-4">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      'px-3 py-2 rounded-md text-sm font-medium',
                      location.pathname === item.href
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground'
                    )}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
