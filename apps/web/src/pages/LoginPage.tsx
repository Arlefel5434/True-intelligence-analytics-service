import { ApiError } from '@tia/api-client';
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { Button } from '../components/Button';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (user) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || password.length < 8) {
      setError('Введите корректный email и пароль не короче 8 символов.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await login({ email: email.trim(), password });
      const target = (location.state as { from?: string } | null)?.from ?? '/';
      navigate(target, { replace: true });
    } catch (reason) {
      setError(
        reason instanceof ApiError && reason.status === 401
          ? 'Неверный email или пароль.'
          : 'Не удалось войти. Попробуйте ещё раз.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-6">
      <form
        className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl"
        onSubmit={submit}
      >
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
          Истинный интеллект
        </p>
        <h1 className="mb-2 text-3xl font-bold text-slate-950">
          Вход в кабинет
        </h1>
        <p className="mb-8 text-sm text-slate-600">
          Аналитика присутствия ваших филиалов
        </p>
        <label className="mb-5 block text-sm font-semibold text-slate-700">
          Email
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-slate-700"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="mb-4 block text-sm font-semibold text-slate-700">
          Пароль
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-slate-700"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && (
          <p
            role="alert"
            className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <Button className="w-full" disabled={submitting} type="submit">
          {submitting ? 'Входим…' : 'Войти'}
        </Button>
      </form>
    </main>
  );
}
