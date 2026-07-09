'use client';

import React, { useEffect, useState } from 'react';
import { api, type Freelancer, getMediaUrl, getCookie } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { 
  Search, 
  Check, 
  AlertOctagon, 
  Ban, 
  ExternalLink, 
  Star,
  ShieldAlert,
  Loader2,
  FileText,
  X,
  AlertTriangle,
  Pencil,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function FreelancersPage() {
  const toast = useToast();
  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>(''); // empty means ALL
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionReason, setActionReason] = useState('');

  // Pagination states
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const limit = 10;

  // Edit modal states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFreelancerId, setEditFreelancerId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    username: '',
    emergencyName: '',
    emergencyPhone: '',
  });

  const triggerEdit = (freelancer: Freelancer) => {
    setEditFreelancerId(freelancer.id);
    setEditForm({
      name: freelancer.user.name,
      phone: freelancer.user.phone || '',
      username: freelancer.user.username || '',
      emergencyName: freelancer.emergencyName,
      emergencyPhone: freelancer.emergencyPhone,
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFreelancerId) return;

    setActionLoading(editFreelancerId);
    try {
      await api.updateFreelancer(editFreelancerId, editForm);
      toast.success('Profil freelancer berhasil diperbarui.');
      setEditModalOpen(false);
      await fetchFreelancers();
    } catch (err: any) {
      toast.error(err.message || 'Gagal memperbarui profil.');
    } finally {
      setActionLoading(null);
    }
  };

  // Custom confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionType: 'APPROVE' | 'SUSPEND' | 'BAN' | 'UNSUSPEND' | 'UNBAN';
    targetId: string;
  } | null>(null);

  const fetchFreelancers = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const data = await api.getFreelancers(filterStatus || undefined, searchQuery || undefined, page, limit);
      setFreelancers(data.data);
      setTotalPages(data.meta.totalPages);
      setTotalRecords(data.meta.total);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat daftar freelancer.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Reset to page 1 on filter or search change
  useEffect(() => {
    setPage(1);
  }, [filterStatus, searchQuery]);

  useEffect(() => {
    fetchFreelancers(true);
  }, [filterStatus, searchQuery, page]);

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
          fetchFreelancers(false);
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
  }, [filterStatus, searchQuery, page]);

  const triggerApprove = (id: string) => {
    setActionReason('');
    setConfirmDialog({
      isOpen: true,
      title: 'Setujui Pendaftaran Freelancer',
      message: 'Apakah Anda yakin ingin MENYETUJUI pendaftaran freelancer ini? Tindakan ini akan memberikan akses penuh untuk menerima pesanan.',
      actionType: 'APPROVE',
      targetId: id
    });
  };

  const triggerSuspend = (id: string) => {
    setActionReason('');
    setConfirmDialog({
      isOpen: true,
      title: 'Suspend Freelancer',
      message: 'Apakah Anda yakin ingin men-suspend akun freelancer ini selama 7 hari? Mereka tidak akan dapat menerima pesanan selama masa suspend.',
      actionType: 'SUSPEND',
      targetId: id
    });
  };

  const triggerBan = (id: string) => {
    setActionReason('');
    setConfirmDialog({
      isOpen: true,
      title: 'Blokir Freelancer (Ban)',
      message: 'Apakah Anda yakin ingin memblokir permanen (ban) freelancer ini? Tindakan ini tidak dapat dibatalkan.',
      actionType: 'BAN',
      targetId: id
    });
  };

  const triggerUnsuspend = (id: string) => {
    setActionReason('');
    setConfirmDialog({
      isOpen: true,
      title: 'Cabut Suspend',
      message: 'Apakah Anda yakin ingin mencabut suspend freelancer ini? Akun mereka akan kembali aktif dan bisa menerima pesanan.',
      actionType: 'UNSUSPEND',
      targetId: id
    });
  };

  const triggerUnban = (id: string) => {
    setActionReason('');
    setConfirmDialog({
      isOpen: true,
      title: 'Cabut Ban',
      message: 'Apakah Anda yakin ingin mencabut ban freelancer ini? Akun mereka akan kembali aktif dan bisa menerima pesanan.',
      actionType: 'UNBAN',
      targetId: id
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmDialog) return;
    const { actionType, targetId } = confirmDialog;
    
    if ((actionType === 'SUSPEND' || actionType === 'BAN') && !actionReason.trim()) {
      toast.error('Alasan tindakan wajib diisi.');
      return;
    }

    setConfirmDialog(null);
    setActionLoading(targetId);

    try {
      if (actionType === 'APPROVE') {
        await api.approveFreelancer(targetId);
        toast.success('Pendaftaran freelancer berhasil disetujui.');
      } else if (actionType === 'SUSPEND') {
        await api.suspendFreelancer(targetId, actionReason, 7);
        toast.success('Freelancer disuspend selama 7 hari.');
      } else if (actionType === 'BAN') {
        await api.banFreelancer(targetId, actionReason);
        toast.success('Freelancer berhasil diblokir permanen (banned).');
      } else if (actionType === 'UNSUSPEND') {
        await api.unsuspendFreelancer(targetId);
        toast.success('Suspend freelancer berhasil dicabut.');
      } else if (actionType === 'UNBAN') {
        await api.unbanFreelancer(targetId);
        toast.success('Ban freelancer berhasil dicabut.');
      }
      await fetchFreelancers();
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengeksekusi aksi.');
    } finally {
      setActionLoading(null);
      setActionReason('');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in relative text-slate-200">
      
      {/* ── Filter and Search Controls ── */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch">
        
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Cari berdasarkan nama atau username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-lg bg-slate-900/40 border border-slate-800/60 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/40 transition-all text-sm"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {/* Status filter buttons */}
          {['', 'PENDING', 'APPROVED', 'SUSPENDED', 'BANNED'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2.5 rounded-lg border text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                filterStatus === status
                  ? 'bg-indigo-600/10 border-indigo-500/20 text-indigo-400'
                  : 'bg-slate-900/10 border-slate-800/40 text-slate-400 hover:text-slate-200 hover:bg-slate-800/20'
              }`}
            >
              {status || 'SEMUA'}
            </button>
          ))}
        </div>

      </div>

      {/* ── Table Container ── */}
      <div className="glass-panel border border-slate-800/60 rounded-xl overflow-hidden">
        
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            <span className="text-xs text-slate-500 tracking-wider uppercase font-medium">
              Memuat data freelancer...
            </span>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        ) : freelancers.length === 0 ? (
          <div className="py-20 text-center text-xs text-slate-500 font-medium">
            Tidak ada data freelancer yang cocok
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              
              {/* Header */}
              <thead>
                <tr className="border-b border-slate-850 bg-slate-900/20 text-slate-400 uppercase tracking-wider text-[10px] font-semibold">
                  <th className="py-4 px-6">Pengguna</th>
                  <th className="py-4 px-6">Verifikasi Berkas</th>
                  <th className="py-4 px-6">Performa</th>
                  <th className="py-4 px-6">Status & Risiko</th>
                  <th className="py-4 px-6 text-right">Aksi</th>
                </tr>
              </thead>
              
              {/* Body */}
              <tbody className="divide-y divide-slate-850">
                {freelancers.map((freelancer) => {
                  const isHighRisk = freelancer.riskScore >= 50;
                  const isActionDisabled = actionLoading !== null;

                  return (
                    <tr key={freelancer.id} className="hover:bg-slate-900/25 transition-colors">
                      
                      {/* Column 1: Profile */}
                      <td className="py-4 px-6">
                        <div className="font-semibold text-slate-100">{freelancer.user.name}</div>
                        <div className="text-[10px] text-slate-500">
                          {freelancer.user.username ? `@${freelancer.user.username}` : `ID: ${freelancer.user.telegramId}`}
                        </div>
                      </td>

                      {/* Column 2: Verifications (KTM, Selfie, Emergency) */}
                      <td className="py-4 px-6 space-y-1">
                        <div className="flex gap-3">
                          <a
                            href={getMediaUrl(freelancer.ktmUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 hover:underline font-medium"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Foto KTM
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                          {freelancer.selfieUrl && (
                            <a
                              href={getMediaUrl(freelancer.selfieUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 hover:underline font-medium"
                            >
                              Foto Selfie
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                        <div className="text-[9px] text-slate-500">
                          Darurat: {freelancer.emergencyName} ({freelancer.emergencyPhone})
                        </div>
                      </td>

                      {/* Column 3: Stats */}
                      <td className="py-4 px-6 space-y-1">
                        <div className="flex items-center gap-1">
                          <span className="text-slate-200 font-semibold">{freelancer.totalOrders}</span>
                          <span className="text-[10px] text-slate-500">pesanan selesai</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px]">
                          <span className="text-amber-500 font-semibold flex items-center gap-0.5">
                            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                            {freelancer.avgRating.toFixed(1)}
                          </span>
                          <span className="text-slate-500">/ 5.0</span>
                        </div>
                      </td>

                      {/* Column 4: Risk Index & Status */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <div className={`text-sm font-bold flex items-center gap-1.5 ${
                            isHighRisk ? 'text-red-400' : 'text-indigo-400'
                          }`}>
                            {isHighRisk && <ShieldAlert className="w-4 h-4 text-red-500" />}
                            {freelancer.riskScore}%
                          </div>
                          
                          {/* Status Badge */}
                          <span className={`px-2 py-0.5 rounded text-[9px] font-semibold border ${
                            freelancer.status === 'PENDING'
                              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                              : freelancer.status === 'APPROVED'
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                              : freelancer.status === 'SUSPENDED'
                              ? 'bg-orange-500/10 border-orange-500/20 text-orange-400'
                              : 'bg-red-500/10 border-red-500/20 text-red-400'
                          }`}>
                            {freelancer.status}
                          </span>
                        </div>
                        {freelancer.suspendedUntil && freelancer.status === 'SUSPENDED' && (
                          <div className="text-[8px] text-orange-400/80 mt-1">
                            Disuspend hingga: {new Date(freelancer.suspendedUntil).toLocaleDateString()}
                          </div>
                        )}
                      </td>

                      {/* Column 5: Actions */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-2">
                          {freelancer.status === 'PENDING' && (
                            <button
                              disabled={isActionDisabled}
                              onClick={() => triggerApprove(freelancer.id)}
                              className="px-2.5 py-1 rounded bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-600/20 hover:text-indigo-300 disabled:opacity-50 transition-all flex items-center gap-1 cursor-pointer font-medium"
                            >
                              {actionLoading === freelancer.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              <span>Setujui</span>
                            </button>
                          )}
                          {freelancer.status === 'APPROVED' && (
                            <>
                              <button
                                disabled={isActionDisabled}
                                onClick={() => triggerSuspend(freelancer.id)}
                                className="px-2.5 py-1 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 disabled:opacity-50 transition-all flex items-center gap-1 cursor-pointer font-medium"
                              >
                                {actionLoading === freelancer.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <AlertOctagon className="w-3.5 h-3.5" />
                                )}
                                <span>Suspend</span>
                              </button>
                              <button
                                disabled={isActionDisabled}
                                onClick={() => triggerBan(freelancer.id)}
                                className="px-2.5 py-1 rounded bg-red-500/10 text-red-450 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50 transition-all flex items-center gap-1 cursor-pointer font-medium"
                              >
                                {actionLoading === freelancer.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Ban className="w-3.5 h-3.5" />
                                )}
                                <span>Ban</span>
                              </button>
                            </>
                          )}
                          {freelancer.status === 'SUSPENDED' && (
                            <button
                              disabled={isActionDisabled}
                              onClick={() => triggerUnsuspend(freelancer.id)}
                              className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-50 transition-all flex items-center gap-1 cursor-pointer font-medium"
                            >
                              {actionLoading === freelancer.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              <span>Unsuspend</span>
                            </button>
                          )}
                          {freelancer.status === 'BANNED' && (
                            <button
                              disabled={isActionDisabled}
                              onClick={() => triggerUnban(freelancer.id)}
                              className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-50 transition-all flex items-center gap-1 cursor-pointer font-medium"
                            >
                              {actionLoading === freelancer.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              <span>Unban</span>
                            </button>
                          )}
                          <button
                            disabled={isActionDisabled}
                            onClick={() => triggerEdit(freelancer)}
                            className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-slate-200 disabled:opacity-50 transition-all flex items-center gap-1 cursor-pointer font-medium"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Ubah</span>
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>

            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-850 bg-slate-900/10">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
              Menampilkan {(page - 1) * limit + 1} - {Math.min(page * limit, totalRecords)} dari {totalRecords} freelancer
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-250 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer flex items-center justify-center"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              
              <span className="text-[10px] text-slate-400 px-2 font-semibold">
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

      {/* ── Custom Confirmation Dialog Modal ── */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-850 rounded-xl p-6 shadow-2xl relative space-y-4 animate-scale-up text-slate-200">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-850">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`w-5 h-5 ${
                  confirmDialog.actionType === 'BAN' 
                    ? 'text-red-500' 
                    : confirmDialog.actionType === 'SUSPEND'
                    ? 'text-orange-500'
                    : 'text-indigo-400'
                }`} />
                <h3 className="text-sm font-bold text-slate-100">
                  {confirmDialog.title}
                </h3>
              </div>
              <button 
                onClick={() => setConfirmDialog(null)}
                className="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Message Body */}
            <div className="text-xs text-slate-400 leading-relaxed bg-slate-950/40 border border-slate-850 p-4 rounded-lg">
              {confirmDialog.message}
            </div>

            {/* Reason input for Suspend & Ban */}
            {(confirmDialog.actionType === 'SUSPEND' || confirmDialog.actionType === 'BAN') && (
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
                  Alasan Tindakan <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Contoh: Pelanggaran ketentuan pesanan, rating terlalu rendah, dll..."
                  rows={3}
                  className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-850 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/40 transition-all text-xs resize-none"
                />
              </div>
            )}

            {/* Actions Footer */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="flex-1 py-2 rounded bg-slate-850 border border-slate-800 text-slate-400 font-semibold text-xs hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                className={`flex-1 py-2 rounded font-semibold text-xs transition-colors cursor-pointer text-slate-950 ${
                  confirmDialog.actionType === 'BAN'
                    ? 'bg-red-500 hover:bg-red-400 text-white font-bold'
                    : confirmDialog.actionType === 'SUSPEND'
                    ? 'bg-orange-500 hover:bg-orange-400 text-white font-bold'
                    : 'bg-indigo-500 hover:bg-indigo-400 text-white font-bold'
                }`}
              >
                Konfirmasi
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── Edit Freelancer Modal ── */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form 
            onSubmit={handleEditSubmit}
            className="w-full max-w-md bg-slate-900 border border-slate-850 rounded-xl p-6 shadow-2xl relative space-y-4 animate-scale-up"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-850">
              <div className="flex items-center gap-2 text-indigo-400">
                <Pencil className="w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-100">
                  Ubah Profil Freelancer
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
                Nama Lengkap
              </label>
              <input
                type="text"
                required
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full px-3.5 py-2 rounded bg-slate-950 border border-slate-850 text-slate-100 placeholder-slate-650 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/40 transition-all text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
                Nomor HP Driver
              </label>
              <input
                type="text"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                placeholder="misal: 081234567890"
                className="w-full px-3.5 py-2 rounded bg-slate-950 border border-slate-850 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/40 transition-all text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
                Username Telegram
              </label>
              <input
                type="text"
                value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                placeholder="misal: username_driver (tanpa @)"
                className="w-full px-3.5 py-2 rounded bg-slate-950 border border-slate-850 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/40 transition-all text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
                Nama Kontak Darurat
              </label>
              <input
                type="text"
                required
                value={editForm.emergencyName}
                onChange={(e) => setEditForm({ ...editForm, emergencyName: e.target.value })}
                className="w-full px-3.5 py-2 rounded bg-slate-950 border border-slate-850 text-slate-100 placeholder-slate-650 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/40 transition-all text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
                No. HP Kontak Darurat
              </label>
              <input
                type="text"
                required
                value={editForm.emergencyPhone}
                onChange={(e) => setEditForm({ ...editForm, emergencyPhone: e.target.value })}
                className="w-full px-3.5 py-2 rounded bg-slate-950 border border-slate-850 text-slate-100 placeholder-slate-650 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/40 transition-all text-xs"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="flex-1 py-2 rounded bg-slate-850 border border-slate-800 text-slate-400 font-semibold text-xs hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={actionLoading !== null}
                className="flex-1 py-2 rounded bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                {actionLoading !== null ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  'Simpan Perubahan'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
