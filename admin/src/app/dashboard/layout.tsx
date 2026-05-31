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
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border font-mono text-sm tracking-wide transition-all ${
        isActive
          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 glow-mint'
          : 'text-emerald-500/50 border-transparent hover:text-emerald-300 hover:bg-forest-800/40'
      }`}
    >
      {icon}
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
        const res = await fetch(process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/../health` : 'http://localhost:3002/health');
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
        return 'System Overview';
      case '/dashboard/freelancers':
        return 'Freelancers Registry';
      case '/dashboard/orders':
        return 'Operations Log';
      case '/dashboard/reports':
        return 'Incident Reports';
      case '/dashboard/broadcast':
        return 'Comm Dispatcher';
      default:
        return 'Operations Panel';
    }
  };

  return (
    <div className="min-h-screen flex bg-forest-950 text-emerald-100 font-sans bg-grid-dots">
      
      {/* ── Sidebar ── */}
      <aside className="w-64 border-r border-emerald-500/10 bg-forest-950/80 backdrop-blur-md flex flex-col justify-between p-6 z-20">
        
        {/* Top Section */}
        <div className="space-y-8">
          
          {/* Logo Brand */}
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-forest-900 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold font-display text-sm tracking-wider text-emerald-300 leading-tight">
                SHUTTLE BOT
              </h2>
              <span className="text-[10px] font-mono text-emerald-600 uppercase tracking-widest block">
                ADMIN CONSOLE
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            <div className="text-[10px] font-mono text-emerald-800 uppercase tracking-wider pl-4 mb-2">
              Core Operations
            </div>
            
            <SidebarLink 
              href="/dashboard" 
              label="Overview" 
              icon={<LayoutDashboard className="w-4 h-4" />} 
            />
            
            <SidebarLink 
              href="/dashboard/freelancers" 
              label="Freelancers" 
              icon={<Users className="w-4 h-4" />} 
            />
            
            <SidebarLink 
              href="/dashboard/orders" 
              label="Orders Log" 
              icon={<ClipboardList className="w-4 h-4" />} 
            />
            
            <SidebarLink 
              href="/dashboard/reports" 
              label="Incidents" 
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
          <hr className="border-emerald-500/10" />
          
          {/* Operator Badge */}
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-forest-900/40 border border-emerald-500/5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse glow-mint" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono text-emerald-400 font-semibold truncate">admin_root</p>
              <p className="text-[10px] font-mono text-emerald-600 truncate">SYS_OP_LEVEL_1</p>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-transparent font-mono text-sm tracking-wide text-red-400/70 hover:text-red-400 hover:bg-red-950/20 hover:border-red-950/40 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>TERMINATE LINK</span>
          </button>
        </div>
      </aside>

      {/* ── Main Panel ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        
        {/* Topbar/Header */}
        <header className="h-16 border-b border-emerald-500/10 bg-forest-950/40 backdrop-blur-md px-8 flex items-center justify-between z-10">
          
          {/* Page Title */}
          <div>
            <h1 className="text-lg font-bold font-display tracking-wide text-emerald-200">
              {getPageTitle()}
            </h1>
          </div>

          {/* System Status Indicators */}
          <div className="flex items-center gap-6">
            
            {/* API Server connection checker */}
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-500/50" />
              <span className="text-[10px] font-mono text-emerald-500/50 uppercase tracking-wider">
                API LINK:
              </span>
              {serverStatus === 'checking' && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-forest-800 border border-emerald-500/10 text-emerald-500/50 text-[10px] font-mono font-semibold">
                  <Activity className="w-3 h-3 animate-pulse" />
                  PINGING...
                </div>
              )}
              {serverStatus === 'online' && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-semibold shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  ONLINE
                </div>
              )}
              {serverStatus === 'offline' && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-950/40 border border-red-500/30 text-red-400 text-[10px] font-mono font-semibold shadow-[0_0_10px_rgba(239,68,68,0.1)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  OFFLINE
                </div>
              )}
            </div>

            {/* Time Stamp */}
            <div className="hidden md:flex items-center gap-2 border-l border-emerald-500/10 pl-6">
              <span className="text-[10px] font-mono text-emerald-500/40 uppercase tracking-wider">
                LOC_TIME:
              </span>
              <span className="text-xs font-mono text-emerald-400/70" id="live-timer">
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
