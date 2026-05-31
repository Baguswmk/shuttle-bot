"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import {
  Radio,
  Send,
  Loader2,
  AlertTriangle,
  Users,
  UserCheck,
  CheckCircle2,
  X,
} from "lucide-react";

export default function BroadcastPage() {
  const toast = useToast();
  const [target, setTarget] = useState<"all" | "freelancers">("all");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    text: string;
  } | null>(null);

  // Custom confirm state
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmitTrigger = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setShowConfirm(true);
  };

  const handleExecuteBroadcast = async () => {
    setShowConfirm(false);
    setLoading(true);
    setResult(null);

    try {
      const res = await api.broadcast(target, message);
      const textResult = `Berhasil mengirim broadcast ke ${res.count} pengguna Telegram!`;
      setResult({
        success: true,
        text: textResult,
      });
      toast.success(textResult);
      setMessage(""); // Clear text
    } catch (err: any) {
      const errMsg = err.message || "Gagal mengirim broadcast.";
      setResult({
        success: false,
        text: errMsg,
      });
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-fade-in relative">
      {/* Warning Box */}
      <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex gap-3 text-yellow-400">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="text-xs font-mono leading-relaxed space-y-1">
          <h4 className="font-bold uppercase tracking-wider">
            Warning: Direct Transmission Block
          </h4>
          <p className="text-yellow-500/70">
            Aksi ini mengirimkan pesan Telegram langsung dari bot kepada
            pengguna terdaftar. Gunakan hanya untuk pemberitahuan darurat,
            pemeliharaan sistem, atau pengumuman penting universitas.
          </p>
        </div>
      </div>

      {/* Broadcast Form Panel */}
      <div className="glass-panel border-neon rounded-xl p-8 shadow-xl">
        <form onSubmit={handleSubmitTrigger} className="space-y-6">
          {/* Target Selection */}
          <div className="space-y-2.5">
            <label className="text-xs font-mono text-emerald-400 uppercase tracking-widest block font-semibold">
              Select Dispatch Target
            </label>

            <div className="grid grid-cols-2 gap-4">
              {/* Option 1: All Users */}
              <button
                type="button"
                onClick={() => setTarget("all")}
                className={`p-4 rounded-lg border font-mono text-left transition-all cursor-pointer flex items-center gap-4 ${
                  target === "all"
                    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.08)]"
                    : "bg-forest-900/10 border-emerald-500/5 text-emerald-500/40 hover:text-emerald-300 hover:bg-forest-800/10"
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider">
                    All Users
                  </div>
                  <div className="text-[10px] text-emerald-500/50 mt-0.5">
                    Seluruh database pengguna terdaftar
                  </div>
                </div>
              </button>

              {/* Option 2: Freelancers only */}
              <button
                type="button"
                onClick={() => setTarget("freelancers")}
                className={`p-4 rounded-lg border font-mono text-left transition-all cursor-pointer flex items-center gap-4 ${
                  target === "freelancers"
                    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.08)]"
                    : "bg-forest-900/10 border-emerald-500/5 text-emerald-500/40 hover:text-emerald-300 hover:bg-forest-800/10"
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-400">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider">
                    Freelancers
                  </div>
                  <div className="text-[10px] text-emerald-500/50 mt-0.5">
                    Khusus freelancer berstatus APPROVED
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Message Text area */}
          <div className="space-y-2.5">
            <label className="text-xs font-mono text-emerald-400 uppercase tracking-widest block font-semibold">
              Message content (HTML Supported)
            </label>
            <textarea
              required
              rows={8}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="👋 Halo Mahasiswa ! ...&#10;&#10;Gunakan tag HTML dasar seperti <b>tebal</b>, <i>miring</i>, atau <code>kode</code> jika diperlukan."
              className="w-full px-4 py-3 rounded-lg bg-forest-950/80 border border-emerald-500/20 text-emerald-100 placeholder-emerald-800 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/40 transition-all font-mono text-xs leading-relaxed"
            />
          </div>

          {/* Results notices */}
          {result && (
            <div
              className={`p-4 rounded-lg font-mono text-xs leading-relaxed border ${
                result.success
                  ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.05)]"
                  : "bg-red-950/40 border-red-500/30 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.05)]"
              }`}
            >
              <div className="flex gap-2.5 items-start">
                {result.success && (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                )}
                <div>{result.text}</div>
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            id="broadcast-btn"
            type="submit"
            disabled={loading || !message.trim()}
            className="w-full py-3.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-forest-950 font-bold tracking-wider font-mono shadow-[0_0_20px_rgba(16,185,129,0.2)] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                DISPATCHING BROADCAST MISSION...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                INITIATE BROADCAST TRANSMISSION
              </>
            )}
          </button>
        </form>
      </div>

      {/* ── Custom Confirmation Dialog Modal ── */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-forest-950 border border-emerald-500/20 rounded-xl p-6 glow-mint shadow-2xl relative font-mono space-y-4 animate-scale-up">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-emerald-500/10">
              <div className="flex items-center gap-2 text-yellow-400">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  INITIATE MASS BROADCAST
                </h3>
              </div>
              <button
                onClick={() => setShowConfirm(false)}
                className="p-1 rounded text-emerald-500/50 hover:text-emerald-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Message Body */}
            <div className="text-xs text-emerald-400/80 leading-relaxed bg-forest-900/20 border border-emerald-500/5 p-4 rounded-lg">
              Apakah Anda yakin ingin mengirimkan pesan broadcast ini ke{" "}
              <b>
                {target === "all"
                  ? "SEMUA ANGGOTA DATABASE"
                  : "SEMUA OPERATOR FREELANCER YANG DISETUJUI"}
              </b>
              ? Tindakan ini akan mengirimkan notifikasi Telegram secara instan.
            </div>

            {/* Actions Footer */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2 rounded bg-forest-900 border border-emerald-500/10 text-emerald-500/60 font-semibold text-[10px] tracking-wider hover:text-emerald-300 hover:bg-forest-800 transition-colors cursor-pointer"
              >
                ABORT TRANSMISSION
              </button>
              <button
                type="button"
                onClick={handleExecuteBroadcast}
                className="flex-1 py-2 rounded bg-yellow-500 hover:bg-yellow-400 text-forest-950 font-bold font-mono text-[10px] tracking-wider transition-colors cursor-pointer"
              >
                DISPATCH NOW
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
