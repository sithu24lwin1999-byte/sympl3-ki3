import { useState } from 'react';
import { Button, Card, Input } from '@/components/ui';
import { Store, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export default function Login() {
  const { login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await action(); }
    catch (issue) { setError(issue instanceof Error ? issue.message : 'Sign in failed.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,.3),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(124,58,237,.25),transparent_40%)]" />
      <Card className="w-full max-w-md relative z-10 p-8 shadow-2xl border-white/10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center mb-5 shadow-xl shadow-blue-500/30"><Store className="w-8 h-8 text-white" /></div>
          <h1 className="text-3xl font-black tracking-tight">KI3 POS</h1>
          <p className="text-slate-500 mt-2">Secure access for admins, owners and staff</p>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); run(() => login(email, password)); }} className="space-y-4">
          <div><label className="block text-sm font-bold mb-2">Email</label><Input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required /></div>
          <div><label className="block text-sm font-bold mb-2">Password</label><Input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required /></div>
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full h-13">{busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Sign In</Button>
        </form>
        <div className="my-5 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />OR<span className="h-px flex-1 bg-slate-200" /></div>
        <Button type="button" variant="outline" disabled={busy} onClick={() => run(loginWithGoogle)} className="w-full bg-white">Continue with Google</Button>
      </Card>
    </div>
  );
}
