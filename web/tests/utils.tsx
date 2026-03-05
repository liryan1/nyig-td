import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const customRender = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  render(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => {
      const queryClient = createTestQueryClient();
      const router = createMemoryRouter(
        [{ path: '*', element: children }],
        { initialEntries: ['/'] }
      );
      return (
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      );
    },
    ...options,
  });

export { screen, waitFor, within } from '@testing-library/react';
export { customRender as render };
