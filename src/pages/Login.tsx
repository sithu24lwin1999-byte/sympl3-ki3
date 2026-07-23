import { useState } from 'react';
import { Button, Card, Input } from '@/components/ui';
import { Store, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { ThemeToggle } from '@/lib/theme';

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
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6 relative overflow-hidden">
      <ThemeToggle className="absolute right-5 top-5 z-20" />
      <div className="absolute inset-x-0 top-0 h-1 bg-blue-600" />
      <Card className="w-full max-w-md relative z-10 p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-5"><Store className="w-8 h-8 text-white" /></div>
          <h1 className="text-3xl font-black tracking-tight">KI3 POS</h1>
          <p className="text-slate-500 mt-2">Secure access for admins, owners and staff</p>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); run(() => login(email, password)); }} className="space-y-4">
          <div><label className="block text-sm font-bold mb-2">Email</label><Input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required /></div>
          <div><label className="block text-sm font-bold mb-2">Password</label><Input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required /></div>
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full h-13">{busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Sign In</Button>
          <button type="button" disabled={busy} onClick={() => run(async () => { await resetPassword(email); setMessage('Password reset link sent. Please check your email.'); })} className="w-full text-sm font-bold text-blue-600 hover:text-blue-700">Forgot password?</button>
        </form>
        {message && <p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">{message}</p>}
      </Card>
    </div>
  );
}
