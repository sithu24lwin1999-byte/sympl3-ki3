import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Input } from '@/components/ui';
import { Download, Store, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export default function Login() {
  const { login, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(''); setMessage('');
    try { await action(); }
    catch (issue) { setError(issue instanceof Error ? issue.message : 'Sign in failed.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="page-shell relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f5f4ef] p-6">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#71806a] via-[#9aa58d] to-[#71806a]" />
      <div className="absolute left-1/2 top-16 h-72 w-72 -translate-x-1/2 rounded-full bg-[#71806a]/10 blur-3xl" />
      <Card className="premium-panel relative z-10 w-full max-w-md border-[#e5e1d7] p-8 sm:p-9">
        <div className="flex flex-col items-center mb-8">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#71806a] shadow-xl shadow-[#71806a]/25"><Store className="w-8 h-8 text-white" /></div>
          <h1 className="text-3xl font-black tracking-tight">KI3 POS</h1>
          <p className="text-slate-500 mt-2 text-center">Secure access for admins, owners and staff</p>
          <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#e5e1d7] bg-white/70 px-3 py-1 text-xs font-bold text-[#667860]"><ShieldCheck className="h-3.5 w-3.5" />Protected POS workspace</span>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); run(() => login(email, password)); }} className="space-y-4">
          <div><label className="block text-sm font-bold mb-2">Email</label><Input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required /></div>
          <div><label className="block text-sm font-bold mb-2">Password</label><Input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required /></div>
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full h-13">{busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Sign In</Button>
          <button type="button" disabled={busy} onClick={() => run(async () => { await resetPassword(email); setMessage('Password reset link sent. Please check your email.'); })} className="w-full text-sm font-bold text-[#5f725a] hover:text-[#465741]">Forgot password?</button>
          <Link to="/download" className="flex w-full items-center justify-center gap-2 text-sm font-bold text-slate-500 hover:text-[#465741]">
            <Download className="h-4 w-4" />
            Download app
          </Link>
        </form>
        {message && <p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">{message}</p>}
      </Card>
    </div>
  );
}
