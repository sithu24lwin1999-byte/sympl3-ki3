import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Input } from '@/components/ui';
import { Store, User, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Login() {
  const navigate = useNavigate();
  const [role, setRole] = useState<'ADMIN' | 'OWNER' | 'EMPLOYEE'>('ADMIN');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (role === 'ADMIN') navigate('/admin');
    if (role === 'OWNER') navigate('/owner');
    if (role === 'EMPLOYEE') navigate('/pos');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-6 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/20 rounded-full blur-[120px] pointer-events-none" />

      <Card className="w-full max-w-md relative z-10 p-8 shadow-2xl shadow-blue-900/5 border-white/40 dark:border-gray-800/60">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-blue-500/30 rotate-3">
            <Store className="w-8 h-8 text-white -rotate-3" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">KI3 POS</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Sign in to your workspace</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email Address</label>
            <Input type="email" placeholder="admin@ki3.com" defaultValue="demo@ki3.com" required />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Password</label>
            <Input type="password" placeholder="••••••••" defaultValue="password" required />
          </div>

          <div className="pt-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Simulate Role (Demo)</label>
            <div className="grid grid-cols-3 gap-3">
              <RoleSelector 
                active={role === 'ADMIN'} 
                onClick={() => setRole('ADMIN')} 
                icon={<ShieldCheck className="w-4 h-4" />} 
                label="Admin" 
              />
              <RoleSelector 
                active={role === 'OWNER'} 
                onClick={() => setRole('OWNER')} 
                icon={<User className="w-4 h-4" />} 
                label="Owner" 
              />
              <RoleSelector 
                active={role === 'EMPLOYEE'} 
                onClick={() => setRole('EMPLOYEE')} 
                icon={<Store className="w-4 h-4" />} 
                label="POS" 
              />
            </div>
          </div>

          <Button type="submit" className="w-full mt-6 h-14 text-lg">
            Sign In
          </Button>
        </form>
      </Card>
    </div>
  );
}

function RoleSelector({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${
        active 
          ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/20 dark:border-blue-500 dark:text-blue-400' 
          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-800'
      }`}
    >
      {icon}
      <span className="text-xs font-medium mt-1">{label}</span>
    </button>
  );
}
