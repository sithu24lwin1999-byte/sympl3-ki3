import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { Button } from '@/components/ui';

type ToastTone = 'success' | 'error' | 'info';
interface ToastItem { id: number; message: string; tone: ToastTone }
const ToastContext = createContext<(message: string, tone?: ToastTone) => void>(() => undefined);
const ConfirmContext = createContext<(input: { title: string; message: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean>>(async () => false);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmation, setConfirmation] = useState<{ title: string; message: string; confirmLabel: string; danger: boolean; resolve(value: boolean): void } | null>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const toast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = Date.now() + Math.random(); setToasts(current => [...current.slice(-2), { id, message, tone }]);
    window.setTimeout(() => setToasts(current => current.filter(item => item.id !== id)), 4200);
  }, []);
  const confirm = useCallback((input: { title: string; message: string; confirmLabel?: string; danger?: boolean }) => new Promise<boolean>(resolve => setConfirmation({ title: input.title, message: input.message, confirmLabel: input.confirmLabel || 'Confirm', danger: input.danger === true, resolve })), []);
  const finish = (value: boolean) => { confirmation?.resolve(value); setConfirmation(null); };
  useEffect(() => { if (confirmation) window.setTimeout(() => confirmButton.current?.focus(), 0); }, [confirmation]);
  useEffect(() => { if (!confirmation) return; const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') finish(false); }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); });
  return <ToastContext.Provider value={toast}><ConfirmContext.Provider value={confirm}>{children}
    <div aria-live="polite" aria-atomic="true" className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">{toasts.map(item=><div key={item.id} role="status" className={`pointer-events-auto flex items-start gap-3 rounded-2xl border p-4 shadow-xl backdrop-blur ${item.tone==='success'?'border-emerald-200 bg-emerald-50/95 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/95 dark:text-emerald-100':item.tone==='error'?'border-red-200 bg-red-50/95 text-red-900 dark:border-red-800 dark:bg-red-950/95 dark:text-red-100':'border-blue-200 bg-blue-50/95 text-blue-900 dark:border-blue-800 dark:bg-blue-950/95 dark:text-blue-100'}`}>{item.tone==='success'?<CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0"/>:item.tone==='error'?<AlertTriangle className="mt-0.5 h-5 w-5 shrink-0"/>:<Info className="mt-0.5 h-5 w-5 shrink-0"/>}<p className="flex-1 text-sm font-semibold">{item.message}</p><button aria-label="Dismiss notification" onClick={()=>setToasts(current=>current.filter(entry=>entry.id!==item.id))}><X className="h-4 w-4"/></button></div>)}</div>
    {confirmation&&<div className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)finish(false)}}><div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message" className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"><div className={`mb-4 grid h-11 w-11 place-items-center rounded-2xl ${confirmation.danger?'bg-red-100 text-red-600 dark:bg-red-950':'bg-blue-100 text-blue-600 dark:bg-blue-950'}`}><AlertTriangle className="h-5 w-5"/></div><h2 id="confirm-title" className="text-xl font-black">{confirmation.title}</h2><p id="confirm-message" className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{confirmation.message}</p><div className="mt-6 flex justify-end gap-3"><Button variant="outline" onClick={()=>finish(false)}>Cancel</Button><Button ref={confirmButton} variant={confirmation.danger?'danger':'primary'} onClick={()=>finish(true)}>{confirmation.confirmLabel}</Button></div></div></div>}
  </ConfirmContext.Provider></ToastContext.Provider>;
}

export const useToast = () => useContext(ToastContext);
export const useConfirm = () => useContext(ConfirmContext);
