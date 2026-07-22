import { Ban, LogOut } from 'lucide-react';
import { Button } from '@/components/ui';

export default function AccessDenied({ message = 'You do not have permission to access this page.', onExit }: { message?: string; onExit?(): void | Promise<void> }) {
  return <main className="min-h-screen grid place-items-center bg-slate-50 p-6">
    <section role="alert" className="w-full max-w-md rounded-3xl border border-red-100 bg-white p-8 text-center shadow-sm">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-600"><Ban className="h-7 w-7" /></span>
      <h1 className="mt-5 text-2xl font-black text-slate-900">Access unavailable</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">{message}</p>
      <Button className="mt-6 w-full gap-2" onClick={() => onExit ? void onExit() : window.history.back()}><LogOut className="h-4 w-4" />{onExit ? 'Sign out' : 'Go back'}</Button>
    </section>
  </main>;
}
