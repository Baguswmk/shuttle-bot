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
      setError(err.message || 'Gagal memuat daftar laporan.');
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
        toast.success('Laporan berhasil disetujui. Skor risiko driver telah bertambah.');
      } else {
        await api.invalidateReport(activeReportId, adminNote);
        toast.success('Laporan berhasil ditolak.');
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
    <div className="space-y-6 animate-fade-in relative text-slate-200">
      
      {/* ── Filters ── */}
      <div className="flex justify-end gap-2">
        {['', 'PENDING', 'VALID', 'INVALID'].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2.5 rounded-lg border text-xs font-semibold tracking-wide transition-all cursor-pointer ${
              filterStatus === status
                ? 'bg-indigo-600/10 border-indigo-500/20 text-indigo-400'
                : 'bg-slate-900/10 border-slate-800/40 text-slate-400 hover:text-slate-250 hover:bg-slate-850'
            }`}
          >
            {status === '' ? 'SEMUA LAPORAN' : status}
          </button>
        ))}
      </div>

      {/* ── Reports Grid Layout ── */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
          <span className="text-xs text-slate-500 tracking-wider font-medium uppercase">
            Memuat daftar laporan...
          </span>
        </div>
      ) : error ? (
        <div className="glass-panel border border-slate-800 p-6 text-center text-xs text-red-400">
          ⚠️ ERROR: {error}
        </div>
      ) : reports.length === 0 ? (
        <div className="glass-panel border border-slate-850 py-20 text-center text-xs text-slate-500 font-medium">
          TIDAK ADA LAPORAN YANG TERCATAT
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
                  className={`glass-panel border border-slate-850 rounded-xl p-6 flex flex-col justify-between transition-all relative overflow-hidden group ${
                    report.status === 'VALID' 
                      ? 'border-red-500/20 hover:border-red-500/40' 
                      : ''
                  }`}
                >
                  {/* Visual Status Indicator strip */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                    report.status === 'PENDING'
                      ? 'bg-amber-500'
                      : report.status === 'VALID'
                      ? 'bg-red-500'
                      : 'bg-emerald-500'
                  }`} />

                  {/* Metadata */}
                  <div className="space-y-4">
                    
                    {/* Row 1: Header info */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 font-mono">
                        KASUS ID: {report.id.substring(0, 8).toUpperCase()}...
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-semibold border ${
                        report.status === 'PENDING'
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                          : report.status === 'VALID'
                          ? 'bg-red-500/10 border-red-500/20 text-red-400 animate-pulse'
                          : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      }`}>
                        {report.status}
                      </span>
                    </div>

                    {/* Row 2: Description */}
                    <div className="space-y-1.5">
                      <h4 className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">
                        Deskripsi Insiden
                      </h4>
                      <p className="text-xs text-slate-350 bg-slate-950/40 border border-slate-850 p-3 rounded-lg leading-relaxed">
                        "{report.description}"
                      </p>
                    </div>

                    {/* Row 3: Parties involved */}
                    <div className="grid grid-cols-2 gap-4 text-[10px] border-t border-slate-850 pt-3">
                      <div>
                        <span className="text-slate-500 uppercase text-[8px] block tracking-wider mb-0.5">PELAPOR (CLIENT)</span>
                        <span className="text-slate-300 font-semibold">{report.reporter.name}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 uppercase text-[8px] block tracking-wider mb-0.5">TERLAPOR (DRIVER)</span>
                        <span className="text-slate-300 font-semibold">{report.freelancer.user.name}</span>
                        <div className="flex items-center gap-1 text-[8px] text-red-450 mt-0.5">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>Skor Risiko: {report.freelancer.riskScore}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Row 4: Evidence & Order link */}
                    <div className="flex items-center justify-between text-[10px] border-t border-slate-850 pt-3">
                      <div>
                        <span className="text-slate-500 uppercase text-[8px] block tracking-wider mb-0.5">PESANAN TERKAIT</span>
                        <span className="text-slate-300 font-semibold">Order #{report.order.orderNumber}</span>
                      </div>
                      <div className="flex gap-2">
                        {report.evidenceUrl && (
                          <a
                            href={getMediaUrl(report.evidenceUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 hover:underline font-medium"
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
                      <div className="text-[10px] bg-slate-950/50 border border-slate-850 p-3 rounded-lg">
                        <span className="text-slate-500 block text-[8px] uppercase tracking-wider mb-1">Catatan Penyelesaian:</span>
                        <span className="text-slate-300">"{report.adminNote}"</span>
                        {report.reviewedAt && (
                          <span className="block text-[8px] text-slate-650 mt-1">
                            Diselesaikan pada: {new Date(report.reviewedAt).toLocaleString('id-ID')}
                          </span>
                        )}
                      </div>
                    )}

                  </div>

                  {/* Actions Panel */}
                  {isPending && (
                    <div className="flex gap-2 mt-6 border-t border-slate-850 pt-4">
                      <button
                        disabled={isActionDisabled}
                        onClick={() => openActionDialog(report.id, 'VALIDATE')}
                        className="flex-1 py-2 rounded bg-red-500/10 border border-red-500/20 text-red-400 font-bold tracking-wide text-xs hover:bg-red-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Validasi Laporan
                      </button>
                      <button
                        disabled={isActionDisabled}
                        onClick={() => openActionDialog(report.id, 'INVALIDATE')}
                        className="flex-1 py-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 font-bold tracking-wide text-xs hover:bg-emerald-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Tolak Laporan
                      </button>
                    </div>
                  )}

                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="glass-panel border border-slate-850 rounded-xl overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-slate-900/10">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                Menampilkan {(page - 1) * limit + 1} - {Math.min(page * limit, totalRecords)} dari {totalRecords} laporan
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-250 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer flex items-center justify-center"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                
                <span className="text-[10px] text-slate-450 px-2 font-semibold">
                  Halaman {page} dari {totalPages}
                </span>

                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-250 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer flex items-center justify-center"
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form 
            onSubmit={handleSubmitAction}
            className="w-full max-w-md bg-slate-900 border border-slate-850 rounded-xl p-6 shadow-2xl relative space-y-4 animate-scale-up"
          >
            
            {/* Header */}
            <div>
              <h3 className={`text-sm font-bold tracking-wide ${
                activeAction === 'VALIDATE' ? 'text-red-400' : 'text-emerald-450'
              }`}>
                {activeAction === 'VALIDATE' ? 'Validasi Laporan Kasus' : 'Abaikan Laporan Kasus'}
              </h3>
              <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                {activeAction === 'VALIDATE' 
                  ? 'Aksi ini akan meningkatkan skor risiko freelancer terlaporkan dan dapat memicu pembekuan akun (suspend) otomatis jika mencapai ambang batas.'
                  : 'Aksi ini akan menutup kasus tanpa dampak sanksi apa pun terhadap freelancer terlaporkan.'}
              </p>
            </div>

            {/* Note input field */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
                Catatan Penyelesaian Laporan <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={4}
                className="w-full px-3.5 py-2.5 rounded bg-slate-950 border border-slate-850 text-slate-100 placeholder-slate-700 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/40 transition-all text-xs leading-relaxed resize-none"
                placeholder="Tulis alasan keputusan, temuan bukti, atau keputusan admin..."
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={closeActionDialog}
                className="flex-1 py-2 rounded bg-slate-850 border border-slate-800 text-slate-400 font-semibold text-xs hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={actionLoading !== null}
                className={`flex-1 py-2 rounded font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-white ${
                  activeAction === 'VALIDATE'
                    ? 'bg-red-500 hover:bg-red-400'
                    : 'bg-indigo-500 hover:bg-indigo-400'
                }`}
              >
                {actionLoading !== null ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  'Konfirmasi'
                )}
              </button>
            </div>

          </form>
        </div>
      )}

    </div>
  );
}
