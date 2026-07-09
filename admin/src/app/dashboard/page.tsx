'use client';

import React, { useEffect, useState } from 'react';
import { api, type StatsResponse, getCookie } from '@/lib/api';
import { 
  Users, 
  UserCheck, 
  Clock, 
  CheckCircle, 
  TrendingUp, 
  Activity,
  ShoppingBag,
  Car,
  Sparkles,
  Loader2
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

export default function OverviewPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimeout: any = null;
    let isMounted = true;

    const fetchStats = async () => {
      try {
        const data = await api.getStats();
        if (isMounted) setStats(data);
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Gagal memuat data statistik.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchStats();

    const connectWS = () => {
      if (!isMounted) return;

      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api';
      const wsUrl = `${API_BASE.replace(/^http/, 'ws')}/ws`;
      const token = getCookie('admin_token');

      if (!token) return;

      socket = new WebSocket(`${wsUrl}?token=${token}`);

      socket.onopen = () => {
        console.log('[WS Client] Connected to dashboard live feed');
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'STATS_UPDATE' && isMounted) {
            setStats(message.data);
            setLoading(false);
          }
        } catch (err) {
          console.error('[WS Client] Message parse error:', err);
        }
      };

      socket.onclose = () => {
        console.log('[WS Client] Connection closed. Retrying in 5s...');
        if (isMounted) {
          reconnectTimeout = setTimeout(connectWS, 5000);
        }
      };

      socket.onerror = (err) => {
        console.error('[WS Client] WebSocket error:', err);
      };
    };

    connectWS();

    return () => {
      isMounted = false;
      if (socket) socket.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
        <span className="text-xs text-slate-500 tracking-wider uppercase font-medium">
          Memuat data sistem...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel border border-red-500/20 rounded-xl p-6 glow-crimson max-w-2xl mx-auto mt-8">
        <h3 className="text-sm text-red-400 font-bold mb-2">GAGAL MEMUAT DATA</h3>
        <p className="text-xs text-slate-400">{error}</p>
      </div>
    );
  }

  // Fallback charts data if API returned empty
  const chartData = stats?.charts?.dailyOrders || [];

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* ── Dashboard Cards Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: Total Users */}
        <div className="glass-panel rounded-xl p-5 relative overflow-hidden group border border-slate-800/40">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full pointer-events-none group-hover:bg-indigo-500/10 transition-all duration-300" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Pengguna Terdaftar
            </span>
            <Users className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-display tracking-tight text-slate-100 mb-1">
            {stats?.totalUsers ?? 0}
          </div>
          <div className="text-[10px] text-slate-500">
            Total akun Telegram terverifikasi
          </div>
        </div>

        {/* Card 2: Active Freelancers */}
        <div className="glass-panel rounded-xl p-5 relative overflow-hidden group border border-slate-800/40">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full pointer-events-none group-hover:bg-indigo-500/10 transition-all duration-300" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Freelancer Aktif
            </span>
            <UserCheck className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-display tracking-tight text-slate-100 mb-1">
            {stats?.activeFreelancers ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
            <span>Mitra terverifikasi</span>
            {stats?.pendingFreelancers && stats.pendingFreelancers > 0 ? (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[9px] font-medium border border-amber-500/20 animate-pulse">
                {stats.pendingFreelancers} tertunda
              </span>
            ) : null}
          </div>
        </div>

        {/* Card 3: Active Orders */}
        <div className="glass-panel rounded-xl p-5 relative overflow-hidden group border border-slate-800/40">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full pointer-events-none group-hover:bg-amber-500/10 transition-all duration-300" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold text-amber-500/80 uppercase tracking-wider block">
              Transaksi Aktif
            </span>
            <Activity className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-display tracking-tight text-amber-400 mb-1">
            {stats?.activeOrders ?? 0}
          </div>
          <div className="text-[10px] text-slate-500">
            Pesanan yang sedang berjalan
          </div>
        </div>

        {/* Card 4: Total Orders */}
        <div className="glass-panel rounded-xl p-5 relative overflow-hidden group border border-slate-800/40">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full pointer-events-none group-hover:bg-indigo-500/10 transition-all duration-300" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total Transaksi
            </span>
            <CheckCircle className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-display tracking-tight text-slate-100 mb-1">
            {stats?.totalOrders ?? 0}
          </div>
          <div className="text-[10px] text-slate-500">
            Semua pesanan yang pernah tercatat
          </div>
        </div>

      </div>

      {/* ── Main Operations Chart & Performance ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Graph Card */}
        <div className="glass-panel rounded-xl p-5 lg:col-span-2 flex flex-col justify-between border border-slate-800/40">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">
                Statistik Pesanan (7 Hari Terakhir)
              </h3>
              <p className="text-[10px] text-slate-500">
                Tren frekuensi pesanan berdasarkan kategori
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs text-indigo-400 font-medium">
              <TrendingUp className="w-4 h-4" />
              <span>TREN AKTIF</span>
            </div>
          </div>

          {/* Recharts area chart */}
          <div className="h-72 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAnjem" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorJastip" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorJasa" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.03)" />
                  <XAxis 
                    dataKey="date" 
                    stroke="rgba(255, 255, 255, 0.1)" 
                    tick={{ fill: '#64748b', fontSize: 10 }} 
                  />
                  <YAxis 
                    stroke="rgba(255, 255, 255, 0.1)" 
                    tick={{ fill: '#64748b', fontSize: 10 }} 
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#0f172a',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      fontSize: '11px',
                      color: '#f8fafc',
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: 10, paddingTop: 10 }}
                    iconType="circle"
                  />
                  <Area 
                    name="Antar Jemput"
                    type="monotone" 
                    dataKey="ANJEM" 
                    stroke="#6366f1" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorAnjem)" 
                  />
                  <Area 
                    name="Jastip"
                    type="monotone" 
                    dataKey="JASTIP" 
                    stroke="#f59e0b" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorJastip)" 
                  />
                  <Area 
                    name="Jasa Lainnya"
                    type="monotone" 
                    dataKey="JASA" 
                    stroke="#06b6d4" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorJasa)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                BELUM ADA TRANSAKSI TERCATAT
              </div>
            )}
          </div>
        </div>

        {/* Category Breakdown Sidebar card */}
        <div className="glass-panel rounded-xl p-5 flex flex-col justify-between border border-slate-800/40">
          <div>
            <h3 className="text-sm font-semibold text-slate-200 mb-5">
              Distribusi Layanan
            </h3>
            
            <div className="space-y-4">
              {/* Category 1: Anjem */}
              <div className="p-3.5 rounded-lg bg-slate-900/40 border border-slate-800 hover:border-slate-700 transition-all flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                  <Car className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">Antar Jemput</span>
                    <span className="text-indigo-400 font-semibold">
                      {stats?.charts?.dailyOrders?.reduce((acc, curr) => acc + (curr.ANJEM || 0), 0) || 0} order
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-500 h-full rounded-full" 
                      style={{ 
                        width: `${Math.min(100, ((stats?.charts?.dailyOrders?.reduce((acc, curr) => acc + (curr.ANJEM || 0), 0) || 0) / (stats?.totalOrders || 1)) * 100)}%` 
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Category 2: Jastip */}
              <div className="p-3.5 rounded-lg bg-slate-900/40 border border-slate-800 hover:border-slate-700 transition-all flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">Jastip</span>
                    <span className="text-amber-400 font-semibold">
                      {stats?.charts?.dailyOrders?.reduce((acc, curr) => acc + (curr.JASTIP || 0), 0) || 0} order
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-amber-500 h-full rounded-full" 
                      style={{ 
                        width: `${Math.min(100, ((stats?.charts?.dailyOrders?.reduce((acc, curr) => acc + (curr.JASTIP || 0), 0) || 0) / (stats?.totalOrders || 1)) * 100)}%` 
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Category 3: Jasa Lain */}
              <div className="p-3.5 rounded-lg bg-slate-900/40 border border-slate-800 hover:border-slate-700 transition-all flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">Jasa Lainnya</span>
                    <span className="text-cyan-400 font-semibold">
                      {stats?.charts?.dailyOrders?.reduce((acc, curr) => acc + (curr.JASA || 0), 0) || 0} order
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-cyan-500 h-full rounded-full" 
                      style={{ 
                        width: `${Math.min(100, ((stats?.charts?.dailyOrders?.reduce((acc, curr) => acc + (curr.JASA || 0), 0) || 0) / (stats?.totalOrders || 1)) * 100)}%` 
                      }}
                    />
                  </div>
                </div>
              </div>

            </div>
          </div>

          <div className="text-[10px] text-slate-500 text-center mt-6 pt-4 border-t border-slate-800">
            Pembaruan otomatis aktif
          </div>
        </div>

      </div>

    </div>
  );
}
