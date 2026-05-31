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
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        <span className="font-mono text-xs text-emerald-500/70 tracking-widest uppercase">
          READING CORES STATE...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel border-neon rounded-xl p-6 glow-crimson max-w-2xl mx-auto mt-8">
        <h3 className="font-mono text-sm text-red-400 font-bold mb-2">SYSTEM ERROR</h3>
        <p className="font-mono text-xs text-red-500/70">{error}</p>
      </div>
    );
  }

  // Fallback charts data if API returned empty
  const chartData = stats?.charts?.dailyOrders || [];

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* ── Dashboard Cards Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Card 1: Total Users */}
        <div className="glass-panel border-neon rounded-xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none group-hover:bg-emerald-500/10 transition-all duration-300" />
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-mono text-emerald-500/50 uppercase tracking-widest block">
              Registered Users
            </span>
            <Users className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-3xl font-bold font-display tracking-tight text-emerald-100 mb-1">
            {stats?.totalUsers ?? 0}
          </div>
          <div className="text-[10px] font-mono text-emerald-500/40">
            Total verified Telegram accounts
          </div>
        </div>

        {/* Card 2: Active Freelancers */}
        <div className="glass-panel border-neon rounded-xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none group-hover:bg-emerald-500/10 transition-all duration-300" />
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-mono text-emerald-500/50 uppercase tracking-widest block">
              Active Freelancers
            </span>
            <UserCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-3xl font-bold font-display tracking-tight text-emerald-100 mb-1">
            {stats?.activeFreelancers ?? 0}
          </div>
          <div className="text-[10px] font-mono text-emerald-500/40 flex items-center gap-1.5">
            <span>Approved operators</span>
            {stats?.pendingFreelancers && stats.pendingFreelancers > 0 ? (
              <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300 text-[9px] font-semibold border border-yellow-500/30 animate-pulse">
                {stats.pendingFreelancers} pending
              </span>
            ) : null}
          </div>
        </div>

        {/* Card 3: Active Orders */}
        <div className="glass-panel border-neon rounded-xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/5 rounded-bl-full pointer-events-none group-hover:bg-yellow-500/10 transition-all duration-300" />
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-mono text-yellow-500/50 uppercase tracking-widest block">
              Active Missions
            </span>
            <Activity className="w-5 h-5 text-yellow-400" />
          </div>
          <div className="text-3xl font-bold font-display tracking-tight text-yellow-300 mb-1 glow-gold">
            {stats?.activeOrders ?? 0}
          </div>
          <div className="text-[10px] font-mono text-yellow-500/40">
            Orders in MATCHED or RUNNING state
          </div>
        </div>

        {/* Card 4: Total Orders */}
        <div className="glass-panel border-neon rounded-xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none group-hover:bg-emerald-500/10 transition-all duration-300" />
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-mono text-emerald-500/50 uppercase tracking-widest block">
              Total Operations
            </span>
            <CheckCircle className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-3xl font-bold font-display tracking-tight text-emerald-100 mb-1">
            {stats?.totalOrders ?? 0}
          </div>
          <div className="text-[10px] font-mono text-emerald-500/40">
            All-time system orders logged
          </div>
        </div>

      </div>

      {/* ── Main Operations Chart & Performance ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Graph Card */}
        <div className="glass-panel border-neon rounded-xl p-6 lg:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-semibold font-display tracking-wide text-emerald-200">
                Operations Traffic (Last 7 Days)
              </h3>
              <p className="text-[10px] font-mono text-emerald-500/40">
                Order frequency trends by category
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
              <TrendingUp className="w-4 h-4" />
              <span>ACTIVE FLOWS</span>
            </div>
          </div>

          {/* Recharts area chart */}
          <div className="h-72 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAnjem" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorJastip" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#fbbf24" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorJasa" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(16, 185, 129, 0.05)" />
                  <XAxis 
                    dataKey="date" 
                    stroke="rgba(16, 185, 129, 0.3)" 
                    tick={{ fill: 'rgba(16, 185, 129, 0.6)', fontSize: 10, fontFamily: 'monospace' }} 
                  />
                  <YAxis 
                    stroke="rgba(16, 185, 129, 0.3)" 
                    tick={{ fill: 'rgba(16, 185, 129, 0.6)', fontSize: 10, fontFamily: 'monospace' }} 
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(9, 21, 13, 0.85)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '8px',
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      color: '#ecfdf5',
                      boxShadow: '0 0 15px rgba(16,185,129,0.1)'
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: 10, fontFamily: 'monospace', paddingTop: 10 }}
                    iconType="circle"
                  />
                  <Area 
                    name="Antar Jemput"
                    type="monotone" 
                    dataKey="ANJEM" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorAnjem)" 
                  />
                  <Area 
                    name="Jastip"
                    type="monotone" 
                    dataKey="JASTIP" 
                    stroke="#fbbf24" 
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
              <div className="h-full flex items-center justify-center text-xs font-mono text-emerald-800">
                NO TRAFFIC RECORDED YET
              </div>
            )}
          </div>
        </div>

        {/* Category Breakdown Sidebar card */}
        <div className="glass-panel border-neon rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold font-display tracking-wide text-emerald-200 mb-6">
              Layanan Distribution
            </h3>
            
            <div className="space-y-4">
              {/* Category 1: Anjem */}
              <div className="p-3.5 rounded-lg bg-forest-900/40 border border-emerald-500/10 hover:border-emerald-500/20 transition-all flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Car className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs font-mono mb-1">
                    <span className="text-emerald-300 font-semibold">Antar Jemput</span>
                    <span className="text-emerald-500">
                      {stats?.charts?.dailyOrders?.reduce((acc, curr) => acc + (curr.ANJEM || 0), 0) || 0} order
                    </span>
                  </div>
                  <div className="w-full bg-forest-950 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full" 
                      style={{ 
                        width: `${Math.min(100, ((stats?.charts?.dailyOrders?.reduce((acc, curr) => acc + (curr.ANJEM || 0), 0) || 0) / (stats?.totalOrders || 1)) * 100)}%` 
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Category 2: Jastip */}
              <div className="p-3.5 rounded-lg bg-forest-900/40 border border-yellow-500/10 hover:border-yellow-500/20 transition-all flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/10 text-yellow-400 flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs font-mono mb-1">
                    <span className="text-yellow-300 font-semibold">Jastip</span>
                    <span className="text-yellow-500">
                      {stats?.charts?.dailyOrders?.reduce((acc, curr) => acc + (curr.JASTIP || 0), 0) || 0} order
                    </span>
                  </div>
                  <div className="w-full bg-forest-950 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-yellow-500 h-full rounded-full" 
                      style={{ 
                        width: `${Math.min(100, ((stats?.charts?.dailyOrders?.reduce((acc, curr) => acc + (curr.JASTIP || 0), 0) || 0) / (stats?.totalOrders || 1)) * 100)}%` 
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Category 3: Jasa Lain */}
              <div className="p-3.5 rounded-lg bg-forest-900/40 border border-cyan-500/10 hover:border-cyan-500/20 transition-all flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs font-mono mb-1">
                    <span className="text-cyan-300 font-semibold">Jasa Lainnya</span>
                    <span className="text-cyan-500">
                      {stats?.charts?.dailyOrders?.reduce((acc, curr) => acc + (curr.JASA || 0), 0) || 0} order
                    </span>
                  </div>
                  <div className="w-full bg-forest-950 h-1.5 rounded-full overflow-hidden">
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

          <div className="text-[10px] font-mono text-emerald-800 text-center mt-6 pt-4 border-t border-emerald-500/10">
            LAST CORE PULL STATUS: 200 OK
          </div>
        </div>

      </div>

    </div>
  );
}
