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
      toast.success('Login berhasil. Selamat datang di Panel Admin.');
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
    <main className="min-h-screen w-full flex items-center justify-center relative bg-grid-dots px-4 overflow-hidden text-slate-200">
      {/* Decorative Blurs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-indigo-600/5 blur-[120px] pointer-events-none" />

      {/* Login Card */}
      <div className="w-full max-w-md glass-panel rounded-2xl p-8 border border-slate-800/60 relative z-10 transition-all duration-300">
        
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-slate-900 border border-slate-800 text-indigo-400 mb-4 shadow-[0_4px_20px_rgba(99,102,241,0.15)]">
            <Shield className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight font-display text-slate-100">
            SHUTTLE BOT
          </h1>
          <p className="text-xs text-slate-500 tracking-wider uppercase mt-1.5 font-semibold">
            Panel Kontrol Admin
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          
          {/* Username Field */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Username Admin
            </label>
            <input
              id="username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/40 transition-all text-sm"
              placeholder="Masukkan username"
            />
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Kata Sandi
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/40 transition-all text-sm pr-12"
                placeholder="Masukkan kata sandi"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-350 p-1 rounded transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/20 text-red-400 text-xs leading-relaxed">
              ⚠️ {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            id="login-btn"
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold tracking-wider text-sm shadow-[0_4px_25px_rgba(99,102,241,0.25)] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                MEMASUKI SISTEM...
              </>
            ) : (
              'MASUK SEBAGAI ADMIN'
            )}
          </button>

        </form>

        {/* Footer */}
        <div className="text-center mt-8 text-[10px] text-slate-600 uppercase tracking-widest font-semibold">
          Koneksi Terenkripsi v1.0
        </div>
      </div>
    </main>
  );
}
