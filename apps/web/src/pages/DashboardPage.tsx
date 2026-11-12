import {
  api,
  ApiError,
  type AnalyticsMetric,
  type AnalyticsResponse,
} from '@tia/api-client';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../auth';
import { Button } from '../components/Button';

const metrics: { value: AnalyticsMetric; label: string }[] = [
  { value: 'views', label: 'Просмотры' },
  { value: 'searches', label: 'Поиски' },
  { value: 'websiteClicks', label: 'Переходы на сайт' },
  { value: 'calls', label: 'Звонки' },
  { value: 'routeBuilds', label: 'Построенные маршруты' },
  { value: 'newReviewsCount', label: 'Новые отзывы' },
  { value: 'averageRating', label: 'Средний рейтинг' },
];
const metricValues = new Set(metrics.map(({ value }) => value));
const numberFormat = new Intl.NumberFormat('ru-RU');
const ratingFormat = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: 'short',
});
const fullDateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function isoDate(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function defaultPeriod() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 29);
  return { from: isoDate(from), to: isoDate(to) };
}

function isDate(value: string | null): value is string {
  return Boolean(
    value &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00`)),
  );
}

function validatePeriod(from: string, to: string): string | null {
  if (!isDate(from) || !isDate(to)) return 'Укажите обе даты.';
  if (from > to) return 'Дата начала не может быть позже даты окончания.';
  if (to > isoDate(new Date()))
    return 'Период не может заканчиваться в будущем.';
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;
  return days > 366 ? 'Период не может превышать 366 дней.' : null;
}

function formatValue(value: number | null, rating = false) {
  if (value === null) return 'Нет данных';
  return rating ? ratingFormat.format(value) : numberFormat.format(value);
}

function ErrorPanel({ retry }: { retry(): void }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-900"
    >
      <p className="font-semibold">Не удалось загрузить аналитику</p>
      <p className="mt-1 text-sm">Проверьте соединение и повторите запрос.</p>
      <Button className="mt-4" onClick={retry}>
        Повторить
      </Button>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const defaults = useMemo(() => defaultPeriod(), []);
  const isAdmin = user?.role === 'ADMIN';
  const rawFrom = params.get('from');
  const rawTo = params.get('to');
  const urlPeriodValid =
    isDate(rawFrom) && isDate(rawTo) && validatePeriod(rawFrom, rawTo) === null;
  const appliedFrom = urlPeriodValid ? rawFrom : defaults.from;
  const appliedTo = urlPeriodValid ? rawTo : defaults.to;
  const rawMetric = params.get('metric') as AnalyticsMetric | null;
  const metric = rawMetric && metricValues.has(rawMetric) ? rawMetric : 'views';
  const companyId = isAdmin
    ? (params.get('company') ?? '')
    : (user?.companyId ?? '');
  const branchId = params.get('branch') ?? '';
  const [draftFrom, setDraftFrom] = useState(appliedFrom);
  const [draftTo, setDraftTo] = useState(appliedTo);
  const [draftBranch, setDraftBranch] = useState(branchId);
  const [periodError, setPeriodError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    // URL navigation is an external state change; keep the editable draft aligned.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraftFrom(appliedFrom);
    setDraftTo(appliedTo);
    setDraftBranch(branchId);
  }, [appliedFrom, appliedTo, branchId]);

  useEffect(() => {
    const invalid =
      ((rawFrom !== null || rawTo !== null) && !urlPeriodValid) ||
      (rawMetric !== null && !metricValues.has(rawMetric));
    if (!invalid) return;
    const next = new URLSearchParams(params);
    next.set('from', appliedFrom);
    next.set('to', appliedTo);
    next.set('metric', metric);
    setParams(next, { replace: true });
    // This status belongs to the URL normalization side effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotice('Некоторые фильтры были сброшены.');
  }, [
    appliedFrom,
    appliedTo,
    metric,
    params,
    rawFrom,
    rawMetric,
    rawTo,
    setParams,
    urlPeriodValid,
  ]);

  const companies = useQuery({
    queryKey: ['companies'],
    queryFn: api.companies,
    enabled: isAdmin,
  });
  const selectedCompany = companies.data?.find(
    (company) => company.id === companyId,
  );

  useEffect(() => {
    const clientHasCompanyParameter = !isAdmin && params.has('company');
    const adminHasUnknownCompany =
      isAdmin &&
      Boolean(companyId) &&
      Boolean(companies.data) &&
      !selectedCompany;
    if (!clientHasCompanyParameter && !adminHasUnknownCompany) return;
    const next = new URLSearchParams(params);
    next.delete('company');
    next.delete('branch');
    setParams(next, { replace: true });
    // This status belongs to the company normalization side effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotice('Недоступная компания была сброшена.');
  }, [companyId, companies.data, isAdmin, params, selectedCompany, setParams]);

  const companyReady = isAdmin ? Boolean(selectedCompany) : Boolean(companyId);
  const branches = useQuery({
    queryKey: ['branches', companyId],
    queryFn: () => api.branches(isAdmin ? companyId : undefined),
    enabled: companyReady,
  });

  useEffect(() => {
    if (
      !branchId ||
      !branches.data ||
      branches.data.some((branch) => branch.id === branchId)
    )
      return;
    const next = new URLSearchParams(params);
    next.delete('branch');
    setParams(next, { replace: true });
    // This status belongs to the branch normalization side effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotice('Недоступный филиал сброшен на «Все филиалы».');
  }, [branchId, branches.data, params, setParams]);

  const analytics = useQuery({
    queryKey: [
      'analytics',
      companyId,
      branchId,
      appliedFrom,
      appliedTo,
      metric,
    ],
    queryFn: () =>
      api.analytics({
        companyId: isAdmin ? companyId : undefined,
        branchId: branchId || undefined,
        from: appliedFrom,
        to: appliedTo,
        metric,
      }),
    enabled: companyReady,
    placeholderData: keepPreviousData,
  });

  const importMutation = useMutation({
    mutationFn: api.runImport,
    onSuccess: async () =>
      queryClient.invalidateQueries({ queryKey: ['analytics'] }),
  });

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    const error = validatePeriod(draftFrom, draftTo);
    setPeriodError(error);
    if (error) return;
    const next = new URLSearchParams(params);
    next.set('from', draftFrom);
    next.set('to', draftTo);
    if (draftBranch) next.set('branch', draftBranch);
    else next.delete('branch');
    setParams(next);
  }

  const currentMetric = metrics.find((item) => item.value === metric)!;
  const contextCompany = isAdmin ? selectedCompany?.name : user?.companyName;
  const contextBranch = branchId
    ? branches.data?.find((branch) => branch.id === branchId)?.name
    : 'Все филиалы';

  return (
    <div className="space-y-6">
      <div aria-live="polite" className="sr-only">
        {notice ?? (analytics.isFetching ? 'Обновляем данные' : '')}
      </div>
      <section>
        <p className="text-sm font-semibold text-slate-500">Обзор</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Аналитика филиалов</h1>
            <p className="mt-2 text-slate-600">
              {contextCompany
                ? `${contextCompany} · ${contextBranch ?? 'Все филиалы'}`
                : 'Выберите компанию для просмотра данных'}
            </p>
          </div>
          {analytics.isFetching && analytics.data && (
            <p className="text-sm text-slate-500">Обновляем данные…</p>
          )}
        </div>
      </section>

      {notice && (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {notice}
        </div>
      )}

      <form
        onSubmit={applyFilters}
        className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-5 lg:items-end"
      >
        {isAdmin && (
          <label className="text-sm font-semibold text-slate-700">
            Компания
            <select
              className="field mt-1"
              value={companyId}
              onChange={(event) => {
                const next = new URLSearchParams(params);
                if (event.target.value) next.set('company', event.target.value);
                else next.delete('company');
                next.delete('branch');
                setParams(next);
              }}
            >
              <option value="">Выберите компанию</option>
              {companies.data?.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-sm font-semibold text-slate-700">
          Филиал
          <select
            className="field mt-1"
            value={draftBranch}
            disabled={!companyReady || branches.isLoading}
            onChange={(event) => setDraftBranch(event.target.value)}
          >
            <option value="">Все филиалы</option>
            {branches.data?.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          С
          <input
            className="field mt-1"
            type="date"
            max={draftTo || isoDate(new Date())}
            value={draftFrom}
            onChange={(event) => setDraftFrom(event.target.value)}
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          По
          <input
            className="field mt-1"
            type="date"
            min={draftFrom}
            max={isoDate(new Date())}
            value={draftTo}
            onChange={(event) => setDraftTo(event.target.value)}
          />
        </label>
        <Button type="submit" disabled={!companyReady}>
          Применить
        </Button>
        {periodError && (
          <p role="alert" className="text-sm text-red-700 lg:col-span-5">
            {periodError}
          </p>
        )}
      </form>

      {isAdmin && (
        <ImportPanel
          from={appliedFrom}
          to={appliedTo}
          mutation={importMutation}
        />
      )}

      {!companyReady ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">
          Выберите компанию — после этого станут доступны её филиалы и
          показатели.
        </div>
      ) : analytics.isLoading ? (
        <div role="status" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-2xl bg-slate-200"
            />
          ))}
        </div>
      ) : analytics.isError ? (
        <ErrorPanel retry={() => analytics.refetch()} />
      ) : analytics.data ? (
        <DashboardResults
          data={analytics.data}
          metric={metric}
          setMetric={(value) => {
            const next = new URLSearchParams(params);
            next.set('metric', value);
            setParams(next);
          }}
          dimmed={analytics.isFetching}
          metricLabel={currentMetric.label}
        />
      ) : null}
    </div>
  );
}

type ImportMutation = ReturnType<
  typeof useMutation<
    Awaited<ReturnType<typeof api.runImport>>,
    Error,
    { from: string; to: string }
  >
>;

function ImportPanel({
  from,
  to,
  mutation,
}: {
  from: string;
  to: string;
  mutation: ImportMutation;
}) {
  const [importFrom, setImportFrom] = useState(from);
  const [importTo, setImportTo] = useState(to);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    // A newly applied dashboard range becomes the next import default.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setImportFrom(from);
    setImportTo(to);
  }, [from, to]);
  const apiError =
    mutation.error instanceof ApiError && mutation.error.status === 409
      ? 'Импорт уже выполняется. Повторите позже.'
      : mutation.error
        ? 'Не удалось выполнить импорт.'
        : null;
  return (
    <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <summary className="cursor-pointer font-bold">Импорт данных</summary>
      <form
        className="mt-4 flex flex-wrap items-end gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const validation = validatePeriod(importFrom, importTo);
          setError(validation);
          if (!validation) mutation.mutate({ from: importFrom, to: importTo });
        }}
      >
        <p className="w-full text-sm text-slate-600">
          Импортировать данные всех компаний из внешнего источника.
        </p>
        <label className="text-sm font-semibold">
          С
          <input
            className="field mt-1"
            type="date"
            value={importFrom}
            max={importTo}
            onChange={(event) => setImportFrom(event.target.value)}
          />
        </label>
        <label className="text-sm font-semibold">
          По
          <input
            className="field mt-1"
            type="date"
            value={importTo}
            min={importFrom}
            max={isoDate(new Date())}
            onChange={(event) => setImportTo(event.target.value)}
          />
        </label>
        <Button disabled={mutation.isPending}>
          {mutation.isPending ? 'Импортируем…' : 'Запустить импорт'}
        </Button>
      </form>
      {(error || apiError) && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error ?? apiError}
        </p>
      )}
      {mutation.data && (
        <div
          aria-live="polite"
          className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-950"
        >
          <p className="font-bold">Импорт завершён: {mutation.data.status}</p>
          <p className="mt-1">
            Создано: {mutation.data.createdCount} · Обновлено:{' '}
            {mutation.data.updatedCount} · Пропущено:{' '}
            {mutation.data.skippedCount}
          </p>
          {mutation.data.warnings.length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {mutation.data.warnings.map((warning, index) => (
                <li key={`${warning.code}-${index}`}>{warning.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </details>
  );
}

function DashboardResults({
  data,
  metric,
  setMetric,
  dimmed,
  metricLabel,
}: {
  data: AnalyticsResponse;
  metric: AnalyticsMetric;
  setMetric(value: AnalyticsMetric): void;
  dimmed: boolean;
  metricLabel: string;
}) {
  const cards = [
    ['Просмотры', data.totals.views, false],
    ['Переходы на сайт', data.totals.websiteClicks, false],
    ['Звонки', data.totals.calls, false],
    ['Построенные маршруты', data.totals.routeBuilds, false],
    ['Средний рейтинг', data.totals.averageRating, true],
    ['Новые отзывы', data.totals.newReviewsCount, false],
  ] as const;
  return (
    <div
      className={`space-y-6 transition-opacity ${dimmed ? 'opacity-60' : ''}`}
      aria-busy={dimmed}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value, rating]) => (
          <article
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-semibold text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold">
              {formatValue(value, rating)}
            </p>
          </article>
        ))}
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Динамика</h2>
            <p className="mt-1 text-sm text-slate-500">
              {data.filters.from} — {data.filters.to}
            </p>
          </div>
          <label className="text-sm font-semibold">
            Показатель
            <select
              className="field mt-1"
              value={metric}
              onChange={(event) =>
                setMetric(event.target.value as AnalyticsMetric)
              }
            >
              {metrics.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {data.metadata.dataPoints === 0 ? (
          <div className="py-16 text-center text-slate-600">
            <p className="font-semibold">За выбранный период данных нет</p>
            <p className="mt-1 text-sm">
              Измените период или запустите импорт.
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <div
              className="h-80 min-w-[560px]"
              role="img"
              aria-label={`${metricLabel} с ${data.filters.from} по ${data.filters.to}`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.series} margin={{ left: 8, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value: string) =>
                      dateFormat.format(new Date(`${value}T00:00:00`))
                    }
                  />
                  <YAxis
                    tickFormatter={(value: number) =>
                      numberFormat.format(value)
                    }
                    width={70}
                  />
                  <Tooltip
                    labelFormatter={(value) =>
                      fullDateFormat.format(
                        new Date(`${String(value)}T00:00:00`),
                      )
                    }
                    formatter={(value) => [
                      formatValue(
                        typeof value === 'number' ? value : null,
                        metric === 'averageRating',
                      ),
                      metricLabel,
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#0f172a"
                    strokeWidth={2.5}
                    dot={false}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
