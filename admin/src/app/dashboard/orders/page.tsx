'use client';

import React, { useEffect, useState } from 'react';
import { api, type Order, getCookie } from '@/lib/api';
import { 
  Search, 
  Car, 
  ShoppingBag, 
  Sparkles, 
  ExternalLink, 
  Loader2,
  FileText,
  X,
  User,
  MapPin,
  Tag,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  
  // Filter states
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination states
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const limit = 10;

  const fetchOrders = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const data = await api.getOrders(
        filterType || undefined,
        filterStatus || undefined,
        searchQuery || undefined,
        page,
        limit
      );
      setOrders(data.data);
      setTotalPages(data.meta.totalPages);
      setTotalRecords(data.meta.total);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat daftar transaksi.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Reset to page 1 on filter or search change
  useEffect(() => {
    setPage(1);
  }, [filterType, filterStatus, searchQuery]);

  useEffect(() => {
    fetchOrders(true);
  }, [filterType, filterStatus, searchQuery, page]);

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
          fetchOrders(false);
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
  }, [filterType, filterStatus, searchQuery, page]);

  return (
    <div className="space-y-6 animate-fade-in relative text-slate-200">
      
      {/* ── Search & Filter Panel ── */}
      <div className="flex flex-col xl:flex-row gap-4 justify-between items-stretch">
        
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Cari berdasarkan nomor order, nama pengguna, freelancer, atau lokasi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-lg bg-slate-900/40 border border-slate-800/60 text-slate-100 placeholder-slate-650 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/40 transition-all text-sm"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          
          {/* Category Type Filter */}
          <div className="flex bg-slate-900/20 p-1 rounded-lg border border-slate-850">
            {['', 'ANJEM', 'JASTIP', 'JASA'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  filterType === type
                    ? 'bg-indigo-600/10 text-indigo-400 font-bold'
                    : 'text-slate-500 hover:text-slate-350'
                }`}
              >
                {type === '' ? 'SEMUA TIPE' : type}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-900/40 border border-slate-800/60 text-indigo-450 text-[10px] font-semibold uppercase tracking-wider focus:outline-none focus:border-indigo-500/40"
          >
            <option value="" className="bg-slate-900 text-indigo-450">SEMUA STATUS</option>
            <option value="WAITING" className="bg-slate-900 text-indigo-450">WAITING</option>
            <option value="MATCHED" className="bg-slate-900 text-indigo-450">MATCHED</option>
            <option value="RUNNING" className="bg-slate-900 text-indigo-450">RUNNING</option>
            <option value="DONE" className="bg-slate-900 text-indigo-450">DONE</option>
            <option value="CANCELLED" className="bg-slate-900 text-indigo-450">CANCELLED</option>
          </select>

        </div>

      </div>

      {/* ── Table Log ── */}
      <div className="glass-panel border border-slate-800/60 rounded-xl overflow-hidden">
        
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            <span className="text-xs text-slate-500 tracking-wider font-semibold uppercase">
              Memuat daftar pesanan...
            </span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-red-400">
            ⚠️ ERROR: {error}
          </div>
        ) : orders.length === 0 ? (
          <div className="py-20 text-center text-xs text-slate-500 font-medium">
            Tidak ada transaksi yang tercatat
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              
              {/* Header */}
              <thead>
                <tr className="border-b border-slate-850 bg-slate-900/20 text-slate-400 uppercase tracking-wider text-[10px] font-semibold">
                  <th className="py-4 px-6">No. Pesanan</th>
                  <th className="py-4 px-6">Layanan & Detail</th>
                  <th className="py-4 px-6">Pengguna & Driver</th>
                  <th className="py-4 px-6">Tarif</th>
                  <th className="py-4 px-6">Status & Waktu</th>
                  <th className="py-4 px-6">Rating & Ulasan</th>
                  <th className="py-4 px-6 text-right">Kontrak</th>
                </tr>
              </thead>

              {/* Body */}
              <tbody className="divide-y divide-slate-850">
                {orders.map((order) => {
                  return (
                    <tr key={order.id} className="hover:bg-slate-900/25 transition-colors">
                      
                      {/* Column 1: Order Number */}
                      <td className="py-4 px-6">
                        <div className="font-bold text-indigo-400">#{order.orderNumber}</div>
                        <div className="text-[9px] text-slate-550 truncate max-w-[80px]">
                          {order.id}
                        </div>
                      </td>

                      {/* Column 2: Details */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1.5 text-slate-100 font-semibold mb-1">
                          {order.type === 'ANJEM' && (
                            <>
                              <Car className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Antar Jemput</span>
                            </>
                          )}
                          {order.type === 'JASTIP' && (
                            <>
                              <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
                              <span>Jastip ({order.jastipCategory})</span>
                            </>
                          )}
                          {order.type === 'JASA' && (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                              <span>Jasa ({order.jasaType})</span>
                            </>
                          )}
                        </div>

                        {/* Details specs */}
                        <div className="text-[10px] text-slate-400 space-y-0.5">
                          {order.type === 'ANJEM' && (
                            <>
                              <div>📍 <b>Jemput:</b> {order.pickupLocation}</div>
                              <div>🏁 <b>Tujuan:</b> {order.dropLocation}</div>
                              <div>👥 <b>Jumlah:</b> {order.passengerCount} orang</div>
                            </>
                          )}
                          {order.type === 'JASTIP' && (
                            <div className="truncate max-w-[280px]">
                              📝 <b>Detail:</b> {order.jastipDetail}
                            </div>
                          )}
                          {order.type === 'JASA' && (
                            <div className="truncate max-w-[280px]">
                              📝 <b>Detail:</b> {order.jasaDetail}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Column 3: Users */}
                      <td className="py-4 px-6 space-y-1">
                        <div>
                          <span className="text-slate-550 text-[9px] mr-1">USER:</span>
                          <span className="text-slate-300">{order.user.name}</span>
                          {order.user.username && (
                            <span className="text-[10px] text-slate-500 ml-1">
                              (@{order.user.username})
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-slate-550 text-[9px] mr-1">DRV:</span>
                          {order.freelancer ? (
                            <>
                              <span className="text-slate-300">{order.freelancer.user.name}</span>
                              {order.freelancer.user.username && (
                                <span className="text-[10px] text-slate-500 ml-1">
                                  (@{order.freelancer.user.username})
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-slate-600 italic">Belum ditentukan</span>
                          )}
                        </div>
                      </td>

                      {/* Column 4: Price */}
                      <td className="py-4 px-6">
                        <div className="font-semibold text-slate-100">
                          Rp{order.estimatedPrice.toLocaleString('id-ID')}
                        </div>
                        {order.finalPrice && (
                          <div className="text-[9px] text-slate-500">
                            Akhir: Rp{order.finalPrice.toLocaleString('id-ID')}
                          </div>
                        )}
                      </td>

                      {/* Column 5: Status / Time */}
                      <td className="py-4 px-6 space-y-1">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-semibold border block w-fit ${
                          order.status === 'WAITING'
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                            : order.status === 'MATCHED'
                            ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                            : order.status === 'RUNNING'
                            ? 'bg-orange-500/10 border-orange-500/20 text-orange-400'
                            : order.status === 'DONE'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-red-500/10 border-red-500/20 text-red-400'
                        }`}>
                          {order.status}
                        </span>
                        <div className="text-[9px] text-slate-500">
                          {new Date(order.createdAt).toLocaleString('id-ID')}
                        </div>
                      </td>

                      {/* Column 5.5: Rating & Feedback */}
                      <td className="py-4 px-6">
                        {order.status === 'DONE' ? (
                          order.rating ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-0.5 text-amber-450">
                                <span>{'★'.repeat(order.rating)}{'☆'.repeat(5 - order.rating)}</span>
                                <span className="text-[10px] text-slate-500 ml-1">({order.rating})</span>
                              </div>
                              {order.ratingComment ? (
                                <div className="text-[10px] text-slate-400 italic max-w-[200px] break-words line-clamp-2" title={order.ratingComment}>
                                  "{order.ratingComment}"
                                </div>
                              ) : (
                                <div className="text-[9px] text-slate-600 italic">Tidak ada ulasan</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[9px] text-slate-600 italic">Belum dinilai</span>
                          )
                        ) : (
                          <span className="text-[9px] text-slate-700">-</span>
                        )}
                      </td>

                      {/* Column 6: Records contract check */}
                      <td className="py-4 px-6 text-right">
                        {order.contract ? (
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-600/20 hover:text-indigo-300 transition-all cursor-pointer text-[10px] font-medium"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Kontrak
                          </button>
                        ) : (
                          <span className="text-[9px] text-slate-600 italic">Tanpa kontrak</span>
                        )}
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
              Menampilkan {(page - 1) * limit + 1} - {Math.min(page * limit, totalRecords)} dari {totalRecords} transaksi
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

      {/* ── Digital Contract Viewer Modal ── */}
      {selectedOrder && selectedOrder.contract && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-850 rounded-xl p-6 shadow-2xl relative flex flex-col max-h-[85vh] animate-scale-up">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-850">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  KONTRAK DIGITAL KESEPAKATAN #{selectedOrder.orderNumber}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedOrder(null)}
                className="p-1 rounded text-slate-500 hover:text-slate-350 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto py-6 space-y-6 text-xs text-slate-300 leading-relaxed pr-2">
              
              {/* Core Metadata */}
              <div className="grid grid-cols-2 gap-4 bg-slate-950/40 p-4 rounded-lg border border-slate-850">
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase tracking-wider mb-0.5">ID PESANAN</span>
                  <span className="text-slate-300 font-semibold font-mono">{selectedOrder.id}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase tracking-wider mb-0.5">WAKTU PENANDATANGANAN</span>
                  <span className="text-slate-300 font-semibold">
                    {new Date(selectedOrder.contract.signedAt).toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500 block text-[9px] uppercase tracking-wider mb-0.5">HASH TRANSAKSI (SHA-256)</span>
                  <span className="text-amber-450 font-semibold break-all text-[10px] font-mono">
                    {selectedOrder.contract.hash}
                  </span>
                </div>
              </div>

              {/* Parties Info */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-indigo-400 font-semibold border-b border-slate-850 pb-1 uppercase tracking-wider text-[10px]">
                    <User className="w-3.5 h-3.5 text-indigo-400" />
                    Pihak Pertama (Customer)
                  </div>
                  <div><b>Nama:</b> {selectedOrder.user.name}</div>
                  <div><b>Telegram ID:</b> <span className="font-mono">{selectedOrder.user.telegramId}</span></div>
                  <div><b>Peran:</b> PELANGGAN</div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-indigo-400 font-semibold border-b border-slate-850 pb-1 uppercase tracking-wider text-[10px]">
                    <User className="w-3.5 h-3.5 text-indigo-400" />
                    Pihak Kedua (Freelancer)
                  </div>
                  <div><b>Nama:</b> {selectedOrder.freelancer?.user.name}</div>
                  <div><b>Telegram ID:</b> <span className="font-mono">{selectedOrder.freelancer?.user.telegramId}</span></div>
                  <div><b>Peran:</b> MITRA DRIVER</div>
                </div>
              </div>

              {/* Service specs */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-indigo-400 font-semibold border-b border-slate-850 pb-1 uppercase tracking-wider text-[10px]">
                  <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                  Spesifikasi Layanan
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <b>Tipe:</b> {selectedOrder.type}
                  </div>
                  <div>
                    <b>Estimasi Tarif:</b> Rp{selectedOrder.estimatedPrice.toLocaleString('id-ID')}
                  </div>
                  {selectedOrder.type === 'ANJEM' && (
                    <>
                      <div className="col-span-2"><b>Titik Jemput:</b> {selectedOrder.pickupLocation}</div>
                      <div className="col-span-2"><b>Tujuan:</b> {selectedOrder.dropLocation}</div>
                    </>
                  )}
                  {selectedOrder.type === 'JASTIP' && (
                    <>
                      <div><b>Kategori:</b> {selectedOrder.jastipCategory}</div>
                      <div className="col-span-2"><b>Detail Belanja:</b> {selectedOrder.jastipDetail}</div>
                    </>
                  )}
                  {selectedOrder.type === 'JASA' && (
                    <>
                      <div><b>Tipe Jasa:</b> {selectedOrder.jasaType}</div>
                      <div className="col-span-2"><b>Detail Jasa:</b> {selectedOrder.jasaDetail}</div>
                    </>
                  )}
                </div>
              </div>

              {/* Rating & Feedback Section */}
              {selectedOrder.status === 'DONE' && (
                <div className="space-y-3 bg-slate-950/20 p-4 rounded-lg border border-slate-850">
                  <div className="flex items-center gap-1.5 text-indigo-400 font-semibold border-b border-slate-850 pb-1 uppercase tracking-wider text-[10px]">
                    ★ Penilaian & Ulasan Pelanggan
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-amber-450 text-sm">
                        {'★'.repeat(selectedOrder.rating ?? 0)}{'☆'.repeat(5 - (selectedOrder.rating ?? 0))}
                      </span>
                      <span className="text-[11px] text-slate-400 ml-1">
                        ({selectedOrder.rating ?? 'Belum dinilai'} / 5 Bintang)
                      </span>
                    </div>
                    {selectedOrder.ratingComment ? (
                      <div className="bg-slate-950 p-3 rounded border border-slate-850 text-slate-200 italic text-[11px] break-words">
                        "{selectedOrder.ratingComment}"
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-500 italic">
                        Pelanggan tidak memberikan ulasan tertulis.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Terms clauses */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-indigo-400 font-semibold border-b border-slate-850 pb-1 uppercase tracking-wider text-[10px]">
                  <Tag className="w-3.5 h-3.5 text-indigo-400" />
                  Klausul Kesepakatan
                </div>
                <ul className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-400 leading-relaxed">
                  {selectedOrder.contract.content?.clauses?.map((clause: string, idx: number) => (
                    <li key={idx}>{clause}</li>
                  )) || (
                    <>
                      <li>Pihak Kedua (Freelancer) wajib melaksanakan pekerjaan pengantaran/belanja sesuai dengan detail kesepakatan.</li>
                      <li>Pihak Pertama (Customer) berkewajiban membayar tarif jasa secara penuh setelah pekerjaan diselesaikan.</li>
                      <li>Kontrak digital ini bersifat mengikat dan dicatat secara permanen pada sistem Shuttle Bot.</li>
                      <li>Segala bentuk pelanggaran kontrak dapat dilaporkan secara formal ke pengelola administrasi kemahasiswaan kampus.</li>
                    </>
                  )}
                </ul>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-850 text-center text-[9px] text-slate-650">
              DOKUMEN KONTRAK RESMI KAMPUS // SHUTTLE BOT
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
