import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { TournamentListPage } from '@/pages/TournamentListPage';
import { TournamentDetailPage } from '@/pages/TournamentDetailPage';
import { PlayerListPage } from '@/pages/PlayerListPage';
import { PublicTournamentPage } from '@/pages/PublicTournamentPage';
import { CheckInPage } from '@/pages/CheckInPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      refetchOnWindowFocus: false,
    },
  },
});

const router = createBrowserRouter([
  {
    path: '/tournaments/:id/public',
    element: <PublicTournamentPage />,
  },
  {
    path: '/tournaments/:id/checkin',
    element: <CheckInPage />,
  },
  {
    element: <Layout />,
    children: [
      { path: '/', element: <TournamentListPage /> },
      { path: '/tournaments/:id', element: <TournamentDetailPage /> },
      { path: '/players', element: <PlayerListPage /> },
    ],
  },
]);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

export default App;
