import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Download, Loader2, ServerCog, MonitorCog, ShieldCheck, RefreshCw, Copy, RotateCcw } from "lucide-react";

function useDownload() {
  const [loading, setLoading] = useState(null);
  const download = async (path, filename, key) => {
    setLoading(key);
    try {
      const res = await api.get(path, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${filename} téléchargé.`);
    } catch {
      toast.error("Échec du téléchargement. Assurez-vous d'avoir des employés configurés.");
    } finally {
      setLoading(null);
    }
  };
  return { loading, download };
}

export default function M365Deploy() {
  const { loading, download } = useDownload();
  const [info, setInfo] = useState(null);

  useEffect(() => { api.get("/deploy/info").then((r) => setInfo(r.data)).catch(() => {}); }, []);

  const copy = (txt) => { navigator.clipboard.writeText(txt); toast.success("URL copiée."); };

  const [rotating, setRotating] = useState(false);
  const rotate = async () => {
    if (!window.confirm("Régénérer le jeton invalidera immédiatement les anciennes URL d'automatisation. Continuer ?")) return;
    setRotating(true);
    try {
      const { data } = await api.post("/deploy/rotate-token");
      setInfo(data);
      toast.success("Nouveau jeton généré. Mettez à jour vos tâches planifiées.");
    } catch { toast.error("Échec de la rotation du jeton."); } finally { setRotating(false); }
  };

  return (
    <div className="max-w-5xl mx-auto px-5 lg:px-8 py-8">
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-400">Administration</p>
        <h1 className="font-display text-3xl lg:text-4xl font-extrabold text-white mt-1">Déploiement M365</h1>
        <p className="text-slate-400 mt-2">Poussez les signatures automatiquement, sans copier-coller. Téléchargez un script pré-rempli et exécutez-le côté admin.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Exchange */}
        <div className="rounded-2xl bg-[#111827] border border-slate-800 p-6 sf-fade-up flex flex-col">
          <div className="h-11 w-11 rounded-xl bg-blue-600/20 flex items-center justify-center mb-4"><ServerCog className="h-6 w-6 text-blue-400" /></div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-display text-xl font-bold text-white">Exchange Online</h3>
            <span className="text-[10px] font-bold uppercase tracking-wide bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full">Recommandé</span>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            Ajoute la signature <b className="text-slate-200">automatiquement en bas de chaque courriel sortant</b> de chaque
            employé, côté serveur. Rien à installer sur les postes.
          </p>
          <ol className="text-sm text-slate-400 space-y-1.5 mb-5 list-decimal list-inside">
            <li><code className="text-blue-300">Install-Module ExchangeOnlineManagement</code></li>
            <li><code className="text-blue-300">Connect-ExchangeOnline</code> (compte admin)</li>
            <li>Exécutez le script téléchargé</li>
          </ol>
          <div className="mt-auto">
            <Button onClick={() => download("/deploy/exchange-script", "sigflow-exchange-signatures.ps1", "ex")} disabled={loading === "ex"} data-testid="button-download-exchange" className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-semibold">
              {loading === "ex" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />} Script Exchange (.ps1)
            </Button>
          </div>
        </div>

        {/* GPO */}
        <div className="rounded-2xl bg-[#111827] border border-slate-800 p-6 sf-fade-up flex flex-col">
          <div className="h-11 w-11 rounded-xl bg-blue-600/20 flex items-center justify-center mb-4"><MonitorCog className="h-6 w-6 text-blue-400" /></div>
          <h3 className="font-display text-xl font-bold text-white mb-1">GPO / Outlook Bureau</h3>
          <p className="text-sm text-slate-400 mb-4">
            Définit la <b className="text-slate-200">signature par défaut d'Outlook</b> sur chaque poste, via une stratégie
            de groupe (script d'ouverture de session). Idéal avec Active Directory.
          </p>
          <ol className="text-sm text-slate-400 space-y-1.5 mb-5 list-decimal list-inside">
            <li>GPO → Configuration utilisateur → Scripts</li>
            <li>Ouverture de session → ajoutez le .ps1</li>
            <li>Chaque employé reçoit sa signature au login</li>
          </ol>
          <div className="mt-auto">
            <Button onClick={() => download("/deploy/gpo-script", "sigflow-outlook-gpo.ps1", "gpo")} disabled={loading === "gpo"} data-testid="button-download-gpo" variant="outline" className="w-full h-11 border-slate-700 bg-slate-800/50 text-slate-200 hover:bg-slate-700 hover:text-white font-semibold">
              {loading === "gpo" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />} Script GPO (.ps1)
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-[#111827] border border-slate-800 p-6 sf-fade-up" data-testid="auto-regen-card">
        <div className="flex items-center gap-2 mb-2">
          <RefreshCw className="h-5 w-5 text-blue-400" />
          <h3 className="font-display text-xl font-bold text-white">Régénération automatique</h3>
          {info?.has_token && (
            <button onClick={rotate} disabled={rotating} data-testid="button-rotate-token" className="ml-auto flex items-center gap-1.5 text-xs text-amber-300 hover:text-amber-200 border border-amber-500/40 bg-amber-500/10 rounded-lg px-2.5 py-1.5 transition-colors">
              {rotating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Régénérer le jeton
            </button>
          )}
        </div>
        <p className="text-sm text-slate-400 mb-4">
          Ces URL renvoient <b className="text-slate-200">toujours la version la plus à jour</b> des scripts (signatures + employés courants).
          Faites-les récupérer par une <b className="text-slate-200">tâche planifiée</b> (Windows) ou un <b className="text-slate-200">cron</b> (Linux) pour ré-appliquer automatiquement après chaque changement. Voir le guide <code className="text-blue-300">SELF_HOSTING_M365_GUIDE.md</code>.
        </p>
        {info?.has_token ? (
          <div className="space-y-3">
            {[{ label: "Exchange Online", url: info.exchange_url }, { label: "GPO / Outlook", url: info.gpo_url }].map((r) => (
              <div key={r.label}>
                <p className="text-xs text-slate-500 mb-1">{r.label}</p>
                <div className="flex gap-2">
                  <code className="flex-1 text-xs text-blue-300 bg-slate-900 rounded-lg p-2.5 break-all font-mono">{r.url}</code>
                  <Button onClick={() => copy(r.url)} variant="outline" size="sm" data-testid={`copy-auto-url-${r.label}`} className="shrink-0 border-slate-700 bg-slate-800/50 text-slate-200 hover:bg-slate-700 hover:text-white">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <p className="text-xs text-amber-300/80">⚠️ Ces URL contiennent un jeton secret (`DEPLOY_API_TOKEN`). Ne les partagez qu'avec votre équipe IT.</p>
            <p className="text-xs text-slate-500" data-testid="token-rotated-at">
              Dernière rotation du jeton : {info.rotated_at ? new Date(info.rotated_at).toLocaleString("fr-CA") : "jamais (jeton initial)"}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Définissez la variable d'environnement <code className="text-blue-300">DEPLOY_API_TOKEN</code> côté serveur pour activer les URL d'automatisation.</p>
        )}
      </div>

      <div className="mt-6 rounded-2xl bg-blue-600/10 border border-blue-500/20 p-5 flex gap-3">
        <ShieldCheck className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-slate-300">
          <p className="font-semibold text-white mb-1">Chaque script est pré-rempli avec les signatures actuelles.</p>
          <p className="text-slate-400">Regénérez et re-téléchargez le script après avoir modifié la charte graphique, les bannières ou la liste des employés, afin que les signatures déployées restent à jour. Les images (logo, GIF) restent hébergées et se mettent à jour automatiquement.</p>
        </div>
      </div>
    </div>
  );
}
