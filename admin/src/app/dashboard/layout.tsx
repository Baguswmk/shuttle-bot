'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { 
  LayoutDashboard, 
  Users, 
  ClipboardList, 
  AlertTriangle, 
  Radio, 
  LogOut, 
  Shield, 
  Activity, 
  Server
} from 'lucide-react';

interface SidebarLinkProps {
  href: string;
  label: string;
  icon: React.ReactNode;
}

function SidebarLink({ href, label, icon }: SidebarLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium transition-all duration-200 ${
        isActive
          ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20 shadow-sm'
          : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/50'
      }`}
    >
      <div className={`${isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'}`}>
        {icon}
      </div>
      <span>{label}</span>
    </Link>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [time, setTime] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  // Polling server health status
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/health` : 'http://localhost:3012/api/health');
        if (res.ok) {
          setServerStatus('online');
        } else {
          setServerStatus('offline');
        }
      } catch (err) {
        setServerStatus('offline');
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, []);

  // Live clock tick
  useEffect(() => {
    const updateTime = () => {
      setTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    api.logout();
    router.push('/login');
  };

  const getPageTitle = () => {
    switch (pathname) {
      case '/dashboard':
        return 'Ringkasan Sistem';
      case '/dashboard/freelancers':
        return 'Daftar Freelancer';
      case '/dashboard/orders':
        return 'Riwayat Transaksi';
      case '/dashboard/reports':
        return 'Laporan Masalah';
      case '/dashboard/broadcast':
        return 'Kirim Broadcast';
      default:
        return 'Panel Admin';
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100 font-sans bg-grid-dots">
      
      {/* ── Sidebar ── */}
      <aside className="w-64 border-r border-slate-800/60 bg-slate-900/65 backdrop-blur-lg flex flex-col justify-between p-6 z-20">
        
        {/* Top Section */}
        <div className="space-y-8">
          
          {/* Logo Brand */}
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold font-display text-sm tracking-wide text-indigo-200 leading-tight">
                SHUTTLE BOT
              </h2>
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block">
                ADMIN PANEL
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider pl-3 mb-2">
              Menu Utama
            </div>
            
            <SidebarLink 
              href="/dashboard" 
              label="Dashboard" 
              icon={<LayoutDashboard className="w-4 h-4" />} 
            />
            
            <SidebarLink 
              href="/dashboard/freelancers" 
              label="Freelancer" 
              icon={<Users className="w-4 h-4" />} 
            />
            
            <SidebarLink 
              href="/dashboard/orders" 
              label="Pesanan" 
              icon={<ClipboardList className="w-4 h-4" />} 
            />
            
            <SidebarLink 
              href="/dashboard/reports" 
              label="Laporan" 
              icon={<AlertTriangle className="w-4 h-4" />} 
            />

            <SidebarLink 
              href="/dashboard/broadcast" 
              label="Broadcast" 
              icon={<Radio className="w-4 h-4" />} 
            />
          </nav>
        </div>

        {/* Bottom Section */}
        <div className="space-y-4">
          <hr className="border-slate-800/60" />
          
          {/* Operator Badge */}
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/30 border border-slate-800/50">
            <div className="w-2 h-2 rounded-full bg-indigo-400 shadow-sm" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-300 truncate">Administrator</p>
              <p className="text-[10px] text-slate-500 truncate">Sistem Utama</p>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-transparent text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-950/20 hover:border-red-900/30 transition-all duration-200 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* ── Main Panel ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        
        {/* Topbar/Header */}
        <header className="h-16 border-b border-slate-800/60 bg-slate-900/40 backdrop-blur-md px-8 flex items-center justify-between z-10">
          
          {/* Page Title */}
          <div>
            <h1 className="text-base font-bold font-display tracking-wide text-slate-200">
              {getPageTitle()}
            </h1>
          </div>

          {/* System Status Indicators */}
          <div className="flex items-center gap-6">
            
            {/* API Server connection checker */}
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-slate-500" />
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Status API:
              </span>
              {serverStatus === 'checking' && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800 border border-slate-700/50 text-slate-400 text-[10px] font-medium">
                  <Activity className="w-3 h-3 animate-pulse" />
                  MENGHUBUNGKAN...
                </div>
              )}
              {serverStatus === 'online' && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/30 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  TERSAMBUNG
                </div>
              )}
              {serverStatus === 'offline' && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-950/30 border border-red-500/20 text-red-400 text-[10px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  TERPUTUS
                </div>
              )}
            </div>

            {/* Time Stamp */}
            <div className="hidden md:flex items-center gap-2 border-l border-slate-800 pl-6">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Waktu:
              </span>
              <span className="text-xs text-slate-400" id="live-timer">
                {time || '--:--:--'}
              </span>
            </div>

          </div>
        </header>

        {/* Page Content viewport */}
        <main className="flex-1 p-8 overflow-y-auto z-0">
          {children}
        </main>

      </div>
    </div>
  );
}
