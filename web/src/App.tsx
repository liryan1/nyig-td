import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { TournamentListPage } from '@/pages/TournamentListPage';
import { TournamentDetailPage } from '@/pages/TournamentDetailPage';
import { PlayerListPage } from '@/pages/PlayerListPage';
import { PublicTournamentPage } from '@/pages/PublicTournamentPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/tournaments/:id/public" element={<PublicTournamentPage />} />
          <Route element={<Layout />}>
            <Route path="/" element={<TournamentListPage />} />
            <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
            <Route path="/players" element={<PlayerListPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
