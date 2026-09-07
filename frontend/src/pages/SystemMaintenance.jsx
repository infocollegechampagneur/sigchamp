import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, RefreshCw, RotateCcw, Power, ServerCog, CheckCircle2, XCircle } from "lucide-react";

const STATE_COLORS = {
  RUNNING: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  STARTING: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  STOPPED: "text-red-400 border-red-500/30 bg-red-500/10",
  FATAL: "text-red-400 border-red-500/30 bg-red-500/10",
};

export default function SystemMaintenance() {
  const [status, setStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);

  const loadStatus = async () => {
    setLoadingStatus(true);
    try {
      const { data } = await api.get("/system/status");
      setStatus(data);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => { loadStatus(); }, []);

  const doReload = async () => {
    setReloading(true);
    try {
      const { data } = await api.post("/system/reload");
      toast.success(data.message, { duration: 6000 });
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setReloading(false);
    }
  };

  const doRestart = async () => {
    setConfirmRestart(false);
    setRestarting(true);
    try {
      const { data } = await api.post("/system/restart");
      toast.success(data.message, { duration: 8000 });
      // Re-check status after services come back
      setTimeout(loadStatus, 9000);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setTimeout(() => setRestarting(false), 9000);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-8" data-testid="system-maintenance-page">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
          <ServerCog className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-white">Système / Maintenance</h1>
          <p className="text-sm text-slate-400">Redémarrez ou rechargez SigChamp en toute sécurité.</p>
        </div>
      </div>

      {/* Status */}
      <div className="mt-6 rounded-2xl bg-[#111827] border border-slate-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">État des services</h3>
          <Button onClick={loadStatus} disabled={loadingStatus} variant="outline" size="sm" data-testid="button-refresh-status"
            className="border-slate-700 bg-slate-800/50 text-slate-200 hover:bg-slate-700 hover:text-white">
            {loadingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
        {loadingStatus && !status ? (
          <p className="text-sm text-slate-500">Chargement…</p>
        ) : status?.services?.length ? (
          <div className="space-y-2" data-testid="services-list">
            {status.services.map((s) => {
              const cls = STATE_COLORS[s.state] || "text-slate-400 border-slate-600 bg-slate-800/40";
              return (
                <div key={s.name} className="flex items-center justify-between bg-slate-800/40 border border-slate-700/60 rounded-xl px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    {s.state === "RUNNING" ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-red-400" />}
                    <span className="text-white text-sm font-medium capitalize">{s.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 hidden sm:block">{s.info}</span>
                    <span className={`text-[11px] font-mono border rounded-full px-2.5 py-0.5 ${cls}`}>{s.state}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-amber-400">{status?.error || "Statut indisponible."}</p>
        )}
      </div>

      {/* Actions */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {/* Soft reload */}
        <div className="rounded-2xl bg-[#111827] border border-slate-800 p-6 flex flex-col">
          <div className="flex items-center gap-2.5 mb-2">
            <RotateCcw className="h-5 w-5 text-emerald-400" />
            <h3 className="font-semibold text-white">Rechargement léger</h3>
          </div>
          <p className="text-sm text-slate-400 flex-1">Relit la configuration et vérifie la base de données <span className="text-emerald-400 font-medium">sans interrompre</span> le service. Idéal après un changement de réglages.</p>
          <Button onClick={doReload} disabled={reloading} data-testid="button-system-reload"
            className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold">
            {reloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
            Recharger
          </Button>
        </div>

        {/* Full restart */}
        <div className="rounded-2xl bg-[#111827] border border-red-500/20 p-6 flex flex-col">
          <div className="flex items-center gap-2.5 mb-2">
            <Power className="h-5 w-5 text-red-400" />
            <h3 className="font-semibold text-white">Redémarrage complet</h3>
          </div>
          <p className="text-sm text-slate-400 flex-1">Redémarre les services <span className="text-white font-medium">backend + frontend</span>. Courte interruption de quelques secondes. Fonctionne ici et sur votre serveur auto-hébergé.</p>
          <Button onClick={() => setConfirmRestart(true)} disabled={restarting} data-testid="button-system-restart"
            className="mt-4 bg-red-600 hover:bg-red-500 text-white font-semibold">
            {restarting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Power className="h-4 w-4 mr-2" />}
            {restarting ? "Redémarrage…" : "Redémarrer les services"}
          </Button>
        </div>
      </div>

      {status?.restart_command && (
        <p className="mt-4 text-xs text-slate-500">
          Commande de redémarrage utilisée : <code className="text-slate-400">{status.restart_command}</code>. En auto-hébergé, définissez la variable d'environnement <code className="text-slate-400">RESTART_COMMAND</code> (ex. <code className="text-slate-400">docker compose restart</code>) selon votre installation.
        </p>
      )}

      <AlertDialog open={confirmRestart} onOpenChange={setConfirmRestart}>
        <AlertDialogContent className="bg-[#0d1119] border-slate-800" data-testid="confirm-restart-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Redémarrer les services ?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              SigChamp sera indisponible quelques secondes, le temps que le backend et le frontend redémarrent. Les utilisateurs connectés devront peut-être rafraîchir la page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700" data-testid="button-cancel-restart">Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={doRestart} className="bg-red-600 hover:bg-red-500 text-white" data-testid="button-confirm-restart">Redémarrer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
