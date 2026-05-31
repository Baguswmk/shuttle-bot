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
      toast.success('Profil operator berhasil diperbarui.');
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
    actionType: 'APPROVE' | 'SUSPEND' | 'BAN';
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
    setConfirmDialog({
      isOpen: true,
      title: 'ESTABLISH OPERATOR LINK',
      message: 'Apakah Anda yakin ingin MENYETUJUI pendaftaran freelancer ini? Tindakan ini akan memberikan akses penuh pada sistem shuttle.',
      actionType: 'APPROVE',
      targetId: id
    });
  };

  const triggerSuspend = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'SUSPEND OPERATOR STATUS',
      message: 'Apakah Anda yakin ingin men-SUSPEND akun freelancer ini selama 7 hari? Mereka tidak akan bisa menerima pesanan selama suspend aktif.',
      actionType: 'SUSPEND',
      targetId: id
    });
  };

  const triggerBan = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'CRITICAL: TERMINATE OPERATOR LINK (BAN)',
      message: 'Apakah Anda yakin ingin mem-BAN permanen freelancer ini? Tindakan ini tidak dapat diurungkan dan akan menutup akses akun selamanya.',
      actionType: 'BAN',
      targetId: id
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmDialog) return;
    const { actionType, targetId } = confirmDialog;
    setConfirmDialog(null);
    setActionLoading(targetId);

    try {
      if (actionType === 'APPROVE') {
        await api.approveFreelancer(targetId);
        toast.success('Operator approved successfully.');
      } else if (actionType === 'SUSPEND') {
        await api.suspendFreelancer(targetId, 7);
        toast.success('Operator suspended for 7 days.');
      } else if (actionType === 'BAN') {
        await api.banFreelancer(targetId);
        toast.success('Operator terminated (banned) successfully.');
      }
      await fetchFreelancers();
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengeksekusi aksi.');
    } finally {
      setActionLoading(null);
    }
  };



  return (
    <div className="space-y-6 animate-fade-in relative">
      
      {/* ── Filter and Search Controls ── */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch">
        
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500/50" />
          <input
            type="text"
            placeholder="Cari berdasarkan nama atau username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-lg bg-forest-900/40 border border-emerald-500/10 text-emerald-100 placeholder-emerald-800 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/40 transition-all font-mono text-sm"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {/* Status filter buttons */}
          {['', 'PENDING', 'APPROVED', 'SUSPENDED', 'BANNED'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2.5 rounded-lg border font-mono text-xs tracking-wider transition-all cursor-pointer ${
                filterStatus === status
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.08)]'
                  : 'bg-forest-900/10 border-emerald-500/5 text-emerald-500/50 hover:text-emerald-300 hover:bg-forest-800/20'
              }`}
            >
              {status || 'ALL'}
            </button>
          ))}
        </div>

      </div>

      {/* ── Table Container ── */}
      <div className="glass-panel border-neon rounded-xl overflow-hidden">
        
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
            <span className="font-mono text-[10px] text-emerald-500/50 uppercase tracking-widest">
              QUERYING CORES OPERATORS...
            </span>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="font-mono text-xs text-red-400">{error}</p>
          </div>
        ) : freelancers.length === 0 ? (
          <div className="py-20 text-center font-mono text-xs text-emerald-500/40">
            NO CORRESPONDING OPERATOR RECORDS FOUND
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-mono text-xs">
              
              {/* Header */}
              <thead>
                <tr className="border-b border-emerald-500/10 bg-forest-900/20 text-emerald-400 uppercase tracking-widest text-[10px]">
                  <th className="py-4 px-6">Operator User</th>
                  <th className="py-4 px-6">Credentials / Verification</th>
                  <th className="py-4 px-6">Performance</th>
                  <th className="py-4 px-6">Risk Index</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              
              {/* Body */}
              <tbody className="divide-y divide-emerald-500/5">
                {freelancers.map((freelancer) => {
                  const isHighRisk = freelancer.riskScore >= 50;
                  const isActionDisabled = actionLoading !== null;

                  return (
                    <tr key={freelancer.id} className="hover:bg-forest-900/10 transition-colors">
                      
                      {/* Column 1: Profile */}
                      <td className="py-4 px-6">
                        <div className="font-semibold text-emerald-100">{freelancer.user.name}</div>
                        <div className="text-[10px] text-emerald-500/50">
                          {freelancer.user.username ? `@${freelancer.user.username}` : `ID: ${freelancer.user.telegramId}`}
                        </div>
                      </td>

                      {/* Column 2: Verifications (KTM, Selfie, Emergency) */}
                      <td className="py-4 px-6 space-y-1">
                        <div className="flex gap-2">
                          <a
                            href={getMediaUrl(freelancer.ktmUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 hover:underline"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            KTM Photo
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                          {freelancer.selfieUrl && (
                            <a
                              href={getMediaUrl(freelancer.selfieUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 hover:underline"
                            >
                              Selfie Photo
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                        <div className="text-[9px] text-emerald-500/40">
                          Darurat: {freelancer.emergencyName} ({freelancer.emergencyPhone})
                        </div>
                      </td>

                      {/* Column 3: Stats */}
                      <td className="py-4 px-6 space-y-1">
                        <div className="flex items-center gap-1">
                          <span className="text-emerald-200 font-semibold">{freelancer.totalOrders}</span>
                          <span className="text-[10px] text-emerald-500/40">missions completed</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px]">
                          <span className="text-yellow-400 font-semibold flex items-center gap-0.5">
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            {freelancer.avgRating.toFixed(1)}
                          </span>
                          <span className="text-emerald-500/30">/ 5.0</span>
                        </div>
                      </td>

                      {/* Column 4: Risk Index & Status */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <div className={`text-sm font-bold flex items-center gap-1.5 ${
                            isHighRisk ? 'text-red-400 glow-crimson' : 'text-emerald-400'
                          }`}>
                            {isHighRisk && <ShieldAlert className="w-4 h-4 text-red-500" />}
                            {freelancer.riskScore}%
                          </div>
                          
                          {/* Status Badge */}
                          <span className={`px-2 py-0.5 rounded text-[9px] font-semibold border ${
                            freelancer.status === 'PENDING'
                              ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
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
                          <div className="text-[8px] text-orange-500/60 mt-1">
                            Suspended until: {new Date(freelancer.suspendedUntil).toLocaleDateString()}
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
                              className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/35 hover:text-emerald-200 disabled:opacity-50 transition-all flex items-center gap-1 cursor-pointer"
                            >
                              {actionLoading === freelancer.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              <span>Approve</span>
                            </button>
                          )}
                          {freelancer.status === 'APPROVED' && (
                            <>
                              <button
                                disabled={isActionDisabled}
                                onClick={() => triggerSuspend(freelancer.id)}
                                className="px-2.5 py-1 rounded bg-orange-500/15 text-orange-400 border border-orange-500/20 hover:bg-orange-500/25 hover:text-orange-300 disabled:opacity-50 transition-all flex items-center gap-1 cursor-pointer"
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
                                className="px-2.5 py-1 rounded bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 hover:text-red-300 disabled:opacity-50 transition-all flex items-center gap-1 cursor-pointer"
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
                          <button
                            disabled={isActionDisabled}
                            onClick={() => triggerEdit(freelancer)}
                            className="px-2.5 py-1 rounded bg-blue-500/15 text-blue-300 border border-blue-500/20 hover:bg-blue-500/25 hover:text-blue-200 disabled:opacity-50 transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Edit</span>
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-emerald-500/10 bg-forest-900/10">
            <div className="text-[10px] text-emerald-500/50 uppercase tracking-wider">
              Menampilkan {(page - 1) * limit + 1} - {Math.min(page * limit, totalRecords)} dari {totalRecords} operator
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

      {/* ── Custom Confirmation Dialog Modal ── */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-forest-950 border border-emerald-500/20 rounded-xl p-6 glow-mint shadow-2xl relative font-mono space-y-4 animate-scale-up">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-emerald-500/10">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`w-5 h-5 ${
                  confirmDialog.actionType === 'BAN' 
                    ? 'text-red-500 animate-pulse' 
                    : confirmDialog.actionType === 'SUSPEND'
                    ? 'text-orange-500'
                    : 'text-emerald-400'
                }`} />
                <h3 className={`text-xs font-bold uppercase tracking-wider ${
                  confirmDialog.actionType === 'BAN' 
                    ? 'text-red-400' 
                    : confirmDialog.actionType === 'SUSPEND'
                    ? 'text-orange-400'
                    : 'text-emerald-400'
                }`}>
                  {confirmDialog.title}
                </h3>
              </div>
              <button 
                onClick={() => setConfirmDialog(null)}
                className="p-1 rounded text-emerald-500/50 hover:text-emerald-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Message Body */}
            <div className="text-xs text-emerald-400/80 leading-relaxed bg-forest-900/20 border border-emerald-500/5 p-4 rounded-lg">
              {confirmDialog.message}
            </div>

            {/* Actions Footer */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="flex-1 py-2 rounded bg-forest-900 border border-emerald-500/10 text-emerald-500/60 font-semibold text-[10px] tracking-wider hover:text-emerald-300 hover:bg-forest-800 transition-colors cursor-pointer"
              >
                ABORT ACTION
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                className={`flex-1 py-2 rounded font-semibold text-[10px] tracking-wider transition-colors cursor-pointer text-forest-950 ${
                  confirmDialog.actionType === 'BAN'
                    ? 'bg-red-500 hover:bg-red-400 font-bold'
                    : confirmDialog.actionType === 'SUSPEND'
                    ? 'bg-orange-500 hover:bg-orange-400 font-bold'
                    : 'bg-emerald-500 hover:bg-emerald-400 font-bold'
                }`}
              >
                EXECUTE DECREE
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── Edit Freelancer Modal ── */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form 
            onSubmit={handleEditSubmit}
            className="w-full max-w-md bg-forest-950 border border-emerald-500/20 rounded-xl p-6 glow-mint shadow-2xl relative font-mono space-y-4 animate-scale-up"
          >
            <div className="flex items-center justify-between pb-3 border-b border-emerald-500/10">
              <div className="flex items-center gap-2 text-blue-400">
                <Pencil className="w-5 h-5" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  EDIT OPERATOR PROFILE
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="p-1 rounded text-emerald-500/50 hover:text-emerald-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-emerald-400 uppercase tracking-widest font-semibold block">
                Nama Lengkap
              </label>
              <input
                type="text"
                required
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full px-3.5 py-2 rounded bg-forest-900/40 border border-emerald-500/10 text-emerald-100 placeholder-emerald-800 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/40 transition-all font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-emerald-400 uppercase tracking-widest font-semibold block">
                Nomor HP Driver
              </label>
              <input
                type="text"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                placeholder="misal: 081234567890"
                className="w-full px-3.5 py-2 rounded bg-forest-900/40 border border-emerald-500/10 text-emerald-100 placeholder-emerald-800 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/40 transition-all font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-emerald-400 uppercase tracking-widest font-semibold block">
                Username Telegram
              </label>
              <input
                type="text"
                value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                placeholder="misal: username_driver (tanpa @)"
                className="w-full px-3.5 py-2 rounded bg-forest-900/40 border border-emerald-500/10 text-emerald-100 placeholder-emerald-800 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/40 transition-all font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-emerald-400 uppercase tracking-widest font-semibold block">
                Nama Kontak Darurat
              </label>
              <input
                type="text"
                required
                value={editForm.emergencyName}
                onChange={(e) => setEditForm({ ...editForm, emergencyName: e.target.value })}
                className="w-full px-3.5 py-2 rounded bg-forest-900/40 border border-emerald-500/10 text-emerald-100 placeholder-emerald-800 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/40 transition-all font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-emerald-400 uppercase tracking-widest font-semibold block">
                No. HP Kontak Darurat
              </label>
              <input
                type="text"
                required
                value={editForm.emergencyPhone}
                onChange={(e) => setEditForm({ ...editForm, emergencyPhone: e.target.value })}
                className="w-full px-3.5 py-2 rounded bg-forest-900/40 border border-emerald-500/10 text-emerald-100 placeholder-emerald-800 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/40 transition-all font-mono text-xs"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="flex-1 py-2 rounded bg-forest-900 border border-emerald-500/10 text-emerald-500/60 font-semibold text-[10px] tracking-wider hover:text-emerald-300 hover:bg-forest-800 transition-colors cursor-pointer"
              >
                ABORT CHANGES
              </button>
              <button
                type="submit"
                disabled={actionLoading !== null}
                className="flex-1 py-2 rounded bg-blue-500 hover:bg-blue-400 text-forest-950 font-bold text-[10px] tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                {actionLoading !== null ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  'COMMIT CHANGES'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
