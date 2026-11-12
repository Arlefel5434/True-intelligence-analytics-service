import type { ButtonHTMLAttributes } from 'react';

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-lg bg-slate-900 px-4 py-2.5 font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 ${props.className ?? ''}`}
    />
  );
}
