'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Shield, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const router = useRouter();
  const toast = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.login(username, password);
      toast.success('Access granted. Secure link established.');
      router.push('/dashboard');
    } catch (err: any) {
      const msg = err.message || 'Login gagal. Periksa username dan password Anda.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center relative bg-grid-dots px-4 overflow-hidden">
      {/* Decorative Neon Blurs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-yellow-500/5 blur-[120px] pointer-events-none" />

      {/* Login Card */}
      <div className="w-full max-w-md glass-panel rounded-2xl p-8 glow-mint border-neon relative z-10 transition-all duration-500">
        
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-forest-800 border border-emerald-500/30 text-emerald-400 mb-4 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            <Shield className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-emerald-400 to-yellow-300 bg-clip-text text-transparent">
          SHUTTLE BOT
          </h1>
          <p className="text-xs text-emerald-500/70 tracking-widest font-mono uppercase mt-1">
            Operations Control Panel
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-6">
          
          {/* Username Field */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-emerald-400 uppercase tracking-wider block">
              Operator Username
            </label>
            <input
              id="username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-forest-950/80 border border-emerald-500/20 text-emerald-100 placeholder-emerald-800 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition-all font-mono"
              placeholder="Username"
            />
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-emerald-400 uppercase tracking-wider block">
              Access Code
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-forest-950/80 border border-emerald-500/20 text-emerald-100 placeholder-emerald-800 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition-all font-mono pr-12"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500/50 hover:text-emerald-400 p-1 rounded transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-400 text-xs font-mono leading-relaxed">
              ⚠️ {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            id="login-btn"
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-forest-950 font-bold tracking-wider font-mono shadow-[0_0_20px_rgba(16,185,129,0.2)] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                AUTHENTICATING...
              </>
            ) : (
              'ESTABLISH SECURE LINK'
            )}
          </button>

        </form>

        {/* Footer */}
        <div className="text-center mt-8 text-[10px] font-mono text-emerald-800">
          SECURE CHANNEL // SHUTTLE BOT DEPLOYMENT v1.0
        </div>
      </div>
    </main>
  );
}
