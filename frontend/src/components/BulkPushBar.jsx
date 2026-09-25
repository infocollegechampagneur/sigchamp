import React, { useState } from "react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Send, Loader2, X, CheckCircle2, AlertTriangle } from "lucide-react";

const CHUNK = 4;

export function useBulkPush(targets, allCount, onDone) {
  const [confirm, setConfirm] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState(null);
  const isSelection = targets.length > 0 && targets.length < allCount;
  const count = targets.length;

  const run = async () => {
    setConfirm(false);
    setRunning(true);
    setResult(null);
    const emails = targets.map((e) => e.email);
    const agg = { applied: [], failed: [], warnings: [] };
    setProgress({ done: 0, total: emails.length });
    for (let i = 0; i < emails.length; i += CHUNK) {
      const batch = emails.slice(i, i + CHUNK);
      try {
        const { data } = await api.post("/m365/push", { emails: batch });
        agg.applied.push(...(data.applied || []));
        agg.failed.push(...(data.failed || []));
        agg.warnings.push(...(data.warnings || []));
      } catch (e) {
        const err = formatApiError(e.response?.data?.detail);
        batch.forEach((email) => agg.failed.push({ email, error: err }));
      }
      setProgress({ done: Math.min(i + CHUNK, emails.length), total: emails.length });
    }
    setResult(agg);
    setRunning(false);
    if (agg.failed.length === 0) toast.success(`${agg.applied.length} signature(s) poussée(s) dans Microsoft 365.`);
    else toast.error(`${agg.applied.length} réussie(s), ${agg.failed.length} échec(s).`, { duration: 10000 });
    onDone?.();
  };

  const button = (
    <>
      <Button onClick={() => setConfirm(true)} disabled={running || count === 0} data-testid="button-bulk-push" className="h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-5">
        {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
        {running ? `Push ${progress.done}/${progress.total}` : isSelection ? `Pousser la sélection (${count})` : `Pousser à tous (${count})`}
      </Button>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent className="bg-[#111827] border-slate-700 text-slate-100" data-testid="bulk-push-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Pousser {count} signature(s) dans Microsoft 365 ?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {isSelection ? "Seuls les employés cochés" : "Tous les employés de la liste"} recevront leur signature SigChamp (règle de flux Exchange, remplacement propre de l'ancienne). L'opération peut prendre quelques secondes par employé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white">Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={run} data-testid="bulk-push-confirm-yes" className="bg-emerald-600 hover:bg-emerald-500 text-white">Pousser maintenant</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  const panel = (running || result) ? (
    <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-4 mb-5" data-testid="bulk-push-panel">
          {running && (
            <>
              <div className="flex justify-between text-sm text-slate-300 mb-2"><span>Envoi des signatures vers Microsoft 365…</span><span className="font-mono">{progress.done}/{progress.total}</span></div>
              <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} className="h-2 bg-slate-700" />
            </>
          )}
          {result && (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="flex items-center gap-1.5 text-emerald-400" data-testid="bulk-push-applied"><CheckCircle2 className="h-4 w-4" />{result.applied.length} réussie(s)</span>
                  <span className="flex items-center gap-1.5 text-red-400" data-testid="bulk-push-failed"><AlertTriangle className="h-4 w-4" />{result.failed.length} échec(s)</span>
                  {result.warnings.length > 0 && <span className="text-amber-400">{result.warnings.length} signature(s) réduite(s) (limite Exchange)</span>}
                </div>
                <button onClick={() => setResult(null)} data-testid="bulk-push-close" className="text-slate-500 hover:text-white"><X className="h-4 w-4" /></button>
              </div>
              {result.failed.length > 0 && (
                <div className="max-h-44 overflow-y-auto text-xs space-y-1 pt-1 border-t border-slate-700">
                  {result.failed.map((f, i) => <div key={i} className="text-red-300"><span className="font-mono text-slate-300">{f.email}</span> — {f.error}</div>)}
                </div>
              )}
            </div>
          )}
    </div>
  ) : null;

  return { button, panel };
}
