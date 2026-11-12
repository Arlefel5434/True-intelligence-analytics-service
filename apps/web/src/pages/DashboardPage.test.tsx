import { api, type AnalyticsResponse } from '@tia/api-client';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../auth';
import { DashboardPage } from './DashboardPage';

vi.mock('../auth', () => ({ useAuth: vi.fn() }));
vi.mock('@tia/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tia/api-client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      companies: vi.fn(),
      branches: vi.fn(),
      analytics: vi.fn(),
      runImport: vi.fn(),
    },
  };
});

const analytics: AnalyticsResponse = {
  filters: {
    from: '2026-10-01',
    to: '2026-10-30',
    branchId: null,
    metric: 'views',
  },
  totals: {
    views: 1250,
    searches: 400,
    websiteClicks: 80,
    calls: 25,
    routeBuilds: 43,
    newReviewsCount: 12,
    averageRating: 4.7,
  },
  series: [{ date: '2026-10-01', value: 42 }],
  metadata: { branchCount: 2, dataPoints: 1 },
};

function renderDashboard(entry = '/') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DashboardPage', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.branches).mockResolvedValue([]);
    vi.mocked(api.analytics).mockResolvedValue(analytics);
  });

  it('requires an administrator to select a company', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: 'admin',
        email: 'admin@example.test',
        role: 'ADMIN',
        companyId: null,
        companyName: null,
      },
      loading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(api.companies).mockResolvedValue([
      { id: 'company-1', name: 'Север' },
    ]);
    renderDashboard();

    expect(screen.getByText(/Выберите компанию —/)).toBeVisible();
    expect(await screen.findByRole('option', { name: 'Север' })).toBeVisible();
    expect(api.analytics).not.toHaveBeenCalled();
  });

  it('shows the client company and aggregated cards', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: 'client',
        email: 'client@example.test',
        role: 'CLIENT',
        companyId: 'company-1',
        companyName: 'Север',
      },
      loading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
    });
    renderDashboard('/?from=2026-10-01&to=2026-10-30&metric=views');

    expect(await screen.findByText('Север · Все филиалы')).toBeVisible();
    expect(await screen.findByText('1 250')).toBeVisible();
    expect(screen.queryByLabelText('Компания')).not.toBeInTheDocument();
    expect(api.analytics).toHaveBeenCalledWith(
      expect.objectContaining({ from: '2026-10-01', to: '2026-10-30' }),
    );
  });

  it('runs the global import for an administrator', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: 'admin',
        email: 'admin@example.test',
        role: 'ADMIN',
        companyId: null,
        companyName: null,
      },
      loading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(api.companies).mockResolvedValue([
      { id: 'company-1', name: 'Север' },
    ]);
    vi.mocked(api.runImport).mockResolvedValue({
      id: 'run-1',
      source: 'MOCK_PROVIDER',
      dateFrom: '2026-10-01',
      dateTo: '2026-10-30',
      status: 'COMPLETED',
      createdCount: 5,
      updatedCount: 0,
      skippedCount: 2,
      warnings: [],
      errorMessage: null,
      startedAt: '',
      finishedAt: '',
    });
    renderDashboard('/?company=company-1&from=2026-10-01&to=2026-10-30');

    fireEvent.click(screen.getByText('Импорт данных'));
    fireEvent.click(screen.getByRole('button', { name: 'Запустить импорт' }));
    await waitFor(() => expect(api.runImport).toHaveBeenCalled());
    expect(vi.mocked(api.runImport).mock.calls[0]?.[0]).toEqual({
      from: '2026-10-01',
      to: '2026-10-30',
    });
    expect(await screen.findByText(/Создано: 5/)).toBeVisible();
  });
});
