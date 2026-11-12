import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { Button } from '../components/Button';

export function ProtectedLayout() {
  const { user, loading, error, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading)
    return (
      <main className="grid min-h-screen place-items-center">
        Восстанавливаем сессию…
      </main>
    );
  if (error)
    return (
      <main className="grid min-h-screen place-items-center">
        Сервис временно недоступен.
      </main>
    );
  if (!user)
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Истинный интеллект
            </p>
            <p className="font-bold">Аналитический кабинет</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="text-right">
              <p className="font-semibold">{user.email}</p>
              <p className="text-slate-500">
                {user.role === 'ADMIN' ? 'Администратор' : 'Клиент'}
              </p>
            </div>
            <Button
              onClick={async () => {
                await logout();
                navigate('/login', { replace: true });
              }}
            >
              Выйти
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-6">
        <Outlet />
      </main>
    </div>
  );
}

export function HomePage() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <p className="mb-2 text-sm font-semibold text-slate-500">Обзор</p>
      <h1 className="text-3xl font-bold">Аналитика филиалов</h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        Основа кабинета готова. Выбор компании, фильтры и визуализация
        показателей будут собраны на следующем шаге.
      </p>
    </section>
  );
}
