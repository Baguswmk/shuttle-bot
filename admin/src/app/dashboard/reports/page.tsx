'use client';

import React, { useEffect, useState } from 'react';
import { api, type Report, getMediaUrl, getCookie } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { 
  Filter, 
  Check, 
  XCircle, 
  ExternalLink, 
  Loader2,
  FileText,
  User,
  ShieldAlert,
  AlertTriangle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function ReportsPage() {
  const toast = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>(''); // empty means ALL
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Pagination states
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const limit = 10;

  // Note input modal/state
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<'VALIDATE' | 'INVALIDATE' | null>(null);
  const [adminNote, setAdminNote] = useState('');

  const fetchReports = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const data = await api.getReports(filterStatus || undefined, page, limit);
      setReports(data.data);
      setTotalPages(data.meta.totalPages);
      setTotalRecords(data.meta.total);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat dewan laporan.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Reset to page 1 on filter status change
  useEffect(() => {
    setPage(1);
  }, [filterStatus]);

  useEffect(() => {
    fetchReports(true);
  }, [filterStatus, page]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimeout: any = null;
    let isMounted = true;

    const connectWS = () => {
      if (!isMounted) return;

      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api';
      const wsUrl = `${API_BASE.replace(/^http/, 'ws')}/ws`;
      const token = getCookie('admin_token');

      if (!token) return;

      socket = new WebSocket(`${wsUrl}?token=${token}`);

      socket.onmessage = (event) => {
        if (isMounted) {
          fetchReports(false);
        }
      };

      socket.onclose = () => {
        if (isMounted) {
          reconnectTimeout = setTimeout(connectWS, 5000);
        }
      };
    };

    connectWS();

    return () => {
      isMounted = false;
      if (socket) socket.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [filterStatus, page]);

  const openActionDialog = (id: string, action: 'VALIDATE' | 'INVALIDATE') => {
    setActiveReportId(id);
    setActiveAction(action);
    setAdminNote('');
  };

  const closeActionDialog = () => {
    setActiveReportId(null);
    setActiveAction(null);
    setAdminNote('');
  };

  const handleSubmitAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReportId || !activeAction) return;

    setActionLoading(activeReportId);
    try {
      if (activeAction === 'VALIDATE') {
        await api.validateReport(activeReportId, adminNote);
        toast.success('Incident validated. Risk score has been increased.');
      } else {
        await api.invalidateReport(activeReportId, adminNote);
        toast.success('Incident dismissed.');
      }
      closeActionDialog();
      await fetchReports();
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengeksekusi aksi.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in relative">
      
      {/* ── Filters ── */}
      <div className="flex justify-end gap-2">
        {['', 'PENDING', 'VALID', 'INVALID'].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2.5 rounded-lg border font-mono text-xs tracking-wider transition-all cursor-pointer ${
              filterStatus === status
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.08)]'
                : 'bg-forest-900/10 border-emerald-500/5 text-emerald-500/50 hover:text-emerald-300 hover:bg-forest-800/20'
            }`}
          >
            {status || 'ALL REPORTS'}
          </button>
        ))}
      </div>

      {/* ── Reports Grid Layout ── */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
          <span className="font-mono text-[10px] text-emerald-500/50 uppercase tracking-widest">
            FETCHING SECURITY LOGS...
          </span>
        </div>
      ) : error ? (
        <div className="glass-panel border-neon p-6 text-center font-mono text-xs text-red-400">
          ⚠️ ERROR: {error}
        </div>
      ) : reports.length === 0 ? (
        <div className="glass-panel border-neon py-20 text-center font-mono text-xs text-emerald-500/40">
          NO INCIDENT REPORTS REGISTERED
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reports.map((report) => {
              const isPending = report.status === 'PENDING';
              const isActionDisabled = actionLoading !== null;

              return (
                <div 
                  key={report.id} 
                  className={`glass-panel border-neon rounded-xl p-6 flex flex-col justify-between transition-all relative overflow-hidden group ${
                    report.status === 'VALID' 
                      ? 'border-red-500/20 hover:border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.05)]' 
                      : ''
                  }`}
                >
                  {/* Visual Status Indicator strip */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                    report.status === 'PENDING'
                      ? 'bg-yellow-500'
                      : report.status === 'VALID'
                      ? 'bg-red-500'
                      : 'bg-emerald-500'
                  }`} />

                  {/* Metadata */}
                  <div className="space-y-4">
                    
                    {/* Row 1: Header info */}
                    <div className="flex items-center justify-between font-mono">
                      <span className="text-[10px] text-emerald-500/50">
                        CASE ID: {report.id.substring(0, 8).toUpperCase()}...
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-semibold border ${
                        report.status === 'PENDING'
                          ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                          : report.status === 'VALID'
                          ? 'bg-red-500/10 border-red-500/20 text-red-400 animate-pulse'
                          : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      }`}>
                        {report.status}
                      </span>
                    </div>

                    {/* Row 2: Description */}
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-semibold text-emerald-300 font-mono">
                        DESKRIPSI INSIDEN
                      </h4>
                      <p className="text-xs text-emerald-400/80 bg-forest-900/20 border border-emerald-500/5 p-3 rounded-lg leading-relaxed font-mono">
                        "{report.description}"
                      </p>
                    </div>

                    {/* Row 3: Parties involved */}
                    <div className="grid grid-cols-2 gap-4 text-[10px] font-mono border-t border-emerald-500/5 pt-3">
                      <div>
                        <span className="text-emerald-500/35 uppercase text-[8px] block tracking-wider">PELAPOR (CLIENT)</span>
                        <span className="text-emerald-200 font-semibold">{report.reporter.name}</span>
                      </div>
                      <div>
                        <span className="text-emerald-500/35 uppercase text-[8px] block tracking-wider">TERLAPOR (OPERATOR)</span>
                        <span className="text-emerald-200 font-semibold">{report.freelancer.user.name}</span>
                        <div className="flex items-center gap-1 text-[8px] text-red-400/60 mt-0.5">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>Risk Score: {report.freelancer.riskScore}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Row 4: Evidence & Order link */}
                    <div className="flex items-center justify-between text-[10px] font-mono border-t border-emerald-500/5 pt-3">
                      <div>
                        <span className="text-emerald-500/35 uppercase text-[8px] block tracking-wider">RELATED MISSION</span>
                        <span className="text-emerald-300 font-semibold">Order #{report.order.orderNumber}</span>
                      </div>
                      <div className="flex gap-2">
                        {report.evidenceUrl && (
                          <a
                            href={getMediaUrl(report.evidenceUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 hover:underline"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Foto Bukti
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Admin Notes displays */}
                    {report.adminNote && (
                      <div className="text-[10px] font-mono bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-lg">
                        <span className="text-emerald-500/50 block text-[8px] uppercase tracking-wider mb-1">RESOLVED NOTES:</span>
                        <span className="text-emerald-300">"{report.adminNote}"</span>
                        {report.reviewedAt && (
                          <span className="block text-[8px] text-emerald-500/30 mt-1">
                            Processed at: {new Date(report.reviewedAt).toLocaleString('id-ID')}
                          </span>
                        )}
                      </div>
                    )}

                  </div>

                  {/* Actions Panel */}
                  {isPending && (
                    <div className="flex gap-2 mt-6 border-t border-emerald-500/5 pt-4">
                      <button
                        disabled={isActionDisabled}
                        onClick={() => openActionDialog(report.id, 'VALIDATE')}
                        className="flex-1 py-2 rounded bg-red-500/15 border border-red-500/35 text-red-400 font-semibold font-mono tracking-wider text-[10px] hover:bg-red-500/25 hover:text-red-300 disabled:opacity-50 transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        VALIDATE CASE
                      </button>
                      <button
                        disabled={isActionDisabled}
                        onClick={() => openActionDialog(report.id, 'INVALIDATE')}
                        className="flex-1 py-2 rounded bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 font-semibold font-mono tracking-wider text-[10px] hover:bg-emerald-500/25 hover:text-emerald-300 disabled:opacity-50 transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        DISMISS CASE
                      </button>
                    </div>
                  )}

                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="glass-panel border-neon rounded-xl overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-forest-900/10 font-mono">
              <div className="text-[10px] text-emerald-500/50 uppercase tracking-wider">
                Menampilkan {(page - 1) * limit + 1} - {Math.min(page * limit, totalRecords)} dari {totalRecords} laporan
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="p-1.5 rounded bg-forest-900/40 border border-emerald-500/10 text-emerald-400 hover:text-emerald-300 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer flex items-center justify-center"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                
                <span className="font-mono text-[10px] text-emerald-300 px-2">
                  Halaman {page} dari {totalPages}
                </span>

                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded bg-forest-900/40 border border-emerald-500/10 text-emerald-400 hover:text-emerald-300 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer flex items-center justify-center"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Dialog Modal for Admin review notes input ── */}
      {activeReportId && activeAction && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form 
            onSubmit={handleSubmitAction}
            className="w-full max-w-md bg-forest-950 border border-emerald-500/20 rounded-xl p-6 glow-mint shadow-2xl relative font-mono space-y-4 animate-scale-up"
          >
            
            {/* Header */}
            <div>
              <h3 className={`text-sm font-bold uppercase tracking-wider ${
                activeAction === 'VALIDATE' ? 'text-red-400' : 'text-emerald-400'
              }`}>
                {activeAction === 'VALIDATE' ? 'Validate Incident Case' : 'Dismiss Incident Case'}
              </h3>
              <p className="text-[10px] text-emerald-500/50 mt-1">
                {activeAction === 'VALIDATE' 
                  ? 'Aksi ini akan meningkatkan skor risiko freelancer terlaporkan dan memicu sanksi jika ambang batas tercapai.'
                  : 'Aksi ini akan menutup kasus tanpa dampak sanksi terhadap freelancer terlaporkan.'}
              </p>
            </div>

            {/* Note input field */}
            <div className="space-y-2">
              <label className="text-[10px] text-emerald-400 uppercase tracking-widest font-semibold block">
                Catatan Penyelesaian (Review Note)
              </label>
              <textarea
                required
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 rounded-lg bg-forest-950 border border-emerald-500/20 text-emerald-100 placeholder-emerald-800 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/40 transition-all text-xs leading-relaxed"
                placeholder="Tulis alasan keputusan, temuan bukti, atau instruksi sanksi..."
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={closeActionDialog}
                className="flex-1 py-2.5 rounded bg-forest-900 border border-emerald-500/10 text-emerald-500/60 font-semibold font-mono text-[10px] tracking-wider hover:text-emerald-300 hover:bg-forest-800 transition-colors cursor-pointer"
              >
                ABORT
              </button>
              <button
                type="submit"
                disabled={actionLoading !== null}
                className={`flex-1 py-2.5 rounded font-semibold font-mono text-[10px] tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-forest-950 ${
                  activeAction === 'VALIDATE'
                    ? 'bg-red-500 hover:bg-red-400 font-bold'
                    : 'bg-emerald-500 hover:bg-emerald-400 font-bold'
                }`}
              >
                {actionLoading !== null ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  'EXECUTE DECREE'
                )}
              </button>
            </div>

          </form>
        </div>
      )}

    </div>
  );
}
