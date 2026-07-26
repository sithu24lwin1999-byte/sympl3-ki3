import React from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, Inbox } from 'lucide-react';

export const Card = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("ui-card p-6", className)} {...props}>{children}</div>
);

export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' }>(
  ({ className, variant = 'primary', type = 'button', ...props }, ref) => {
    const variants = {
      primary: 'bg-[#667860] text-white hover:bg-[#52634d]',
      secondary: 'bg-[#efeee8] text-slate-900 hover:bg-[#e5e3da]',
      outline: 'border border-[#ddd9ce] bg-white hover:bg-[#f6f5f0]',
      ghost: 'hover:bg-[#efeee8] text-slate-600',
      danger: 'bg-red-600 text-white hover:bg-red-700',
    };
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "min-h-11 inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#71806a] focus-visible:ring-offset-2",
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-12 w-full rounded-xl border border-[#ddd9ce] bg-white px-4 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#71806a] disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const Badge = ({ children, className, variant = 'default' }: { children: React.ReactNode, className?: string, variant?: 'default' | 'success' | 'warning' | 'danger' }) => {
  const variants = {
    default: 'bg-[#efeee8] text-slate-700',
    success: 'bg-emerald-100 text-emerald-800',
    warning: 'bg-amber-100 text-amber-800',
    danger: 'bg-red-100 text-red-800',
  };
  return (
    <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium", variants[variant], className)}>
      {children}
    </span>
  );
};

export function Skeleton({ className }: { className?: string }) { return <div aria-hidden="true" className={cn('skeleton h-4 rounded-lg bg-[#e8e5dc]',className)}/>; }

export function DataState({ loading, error, empty, emptyMessage = 'No records yet.' }: { loading?: boolean; error?: string | null; empty?: boolean; emptyMessage?: string }) {
  if (loading) return <div role="status" aria-label="Loading data" className="space-y-3 p-6"><Skeleton className="h-4 w-1/3"/><Skeleton className="h-12 w-full"/><Skeleton className="h-12 w-full"/><span className="sr-only">Loading data…</span></div>;
  if (error) return <div role="alert" className="m-4 flex items-start gap-2 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>Unable to load data. {error}</span></div>;
  if (empty) return <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-sm text-slate-400"><Inbox className="h-6 w-6" /><span>{emptyMessage}</span></div>;
  return null;
}

export function TableStateRow({ columns, loading, error, empty, emptyMessage }: { columns: number; loading?: boolean; error?: string | null; empty?: boolean; emptyMessage?: string }) {
  if (!loading && !error && !empty) return null;
  return <tr><td colSpan={columns}><DataState loading={loading} error={error} empty={empty} emptyMessage={emptyMessage} /></td></tr>;
}
