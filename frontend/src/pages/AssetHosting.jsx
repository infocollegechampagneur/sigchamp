import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Loader2, HardDrive, PlugZap, UploadCloud, Save, Gauge, Trash2, RefreshCw, AlertTriangle } from "lucide-react";

const empty = {
  enabled: false, provider: "ftp", backup_enabled: false, auto_cleanup: false, public_url: "", ftp_host: "", ftp_port: 21,
  ftp_user: "", ftp_password: "", ftp_dir: "", ftp_secure: true,
  r2_account_id: "", r2_access_key: "", r2_secret_key: "", r2_bucket: "",
};

const fmtBytes = (b) => {
  if (!b) return "0 o";
  const u = ["o", "Ko", "Mo", "Go"]; let i = 0; let n = b;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 2 : 0)} ${u[i]}`;
};

export default function AssetHosting() {
  const [form, setForm] = useState(empty);
  const [hasPassword, setHasPassword] = useState(false);
  const [hasR2Secret, setHasR2Secret] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [usage, setUsage] = useState(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const fetchUsage = async () => {
    setLoadingUsage(true);
    try {
      const { data } = await api.get("/assets/usage");
      setUsage(data);
    } catch (e) { setUsage({ available: false, reason: formatApiError(e.response?.data?.detail) }); }
    finally { setLoadingUsage(false); }
  };

  useEffect(() => {
    api.get("/assets/config").then((r) => {
      setForm({ ...empty, ...r.data, ftp_password: "", r2_secret_key: "" });
      setHasPassword(!!r.data.has_password);
      setHasR2Secret(!!r.data.has_r2_secret);
      if (r.data.provider === "r2" && r.data.enabled) fetchUsage();
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/assets/config", form);
      toast.success("Configuration enregistrée.");
      setHasPassword(hasPassword || !!form.ftp_password);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  const test = async () => {
    setTesting(true);
    try {
      await api.put("/assets/config", form); // sauvegarde avant test
      const { data } = await api.post("/assets/test");
      let msg = "Connexion réussie ✔" + (data.test_url ? ` — testez : ${data.test_url}` : "");
      if (data.backup_ok === true) msg += " · Backup SiteGround ✔";
      toast.success(msg, { duration: 12000 });
      if (data.backup_ok === false) toast.error(`Backup SiteGround échoué : ${data.backup_error || ""}`, { duration: 14000 });
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail), { duration: 14000 }); }
    finally { setTesting(false); }
  };

  const publishAll = async () => {
    setPublishing(true);
    try {
      const { data } = await api.post("/assets/publish-all");
      const failed = (data.failed || []).length;
      toast.success(`${data.published} fichier(s) publié(s)${failed ? `, ${failed} échec(s)` : ""}.`, { duration: 12000 });
      if (failed) toast.error(`Échecs : ${data.failed.map((f) => f.file).join(", ")}`, { duration: 14000 });
      if (form.provider === "r2") fetchUsage();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setPublishing(false); }
  };

  const cleanup = async () => {
    setCleaning(true);
    try {
      const { data } = await api.post("/assets/cleanup");
      toast.success(`${data.deleted} fichier(s) orphelin(s) supprimé(s) — ${fmtBytes(data.freed_bytes)} libéré(s).`, { duration: 10000 });
      if ((data.failed || []).length) toast.error(`Erreur : ${data.failed.map((f) => f.error).join(", ")}`, { duration: 12000 });
      fetchUsage();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setCleaning(false); }
  };

  if (loading) return <div className="p-8 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="max-w-3xl" data-testid="asset-hosting-page">
      <p className="text-xs font-semibold tracking-widest text-blue-400 uppercase">Autonomie</p>
      <h1 className="font-display text-4xl sm:text-5xl font-bold text-white mt-1">Hébergement des images</h1>
      <p className="text-slate-400 mt-2 max-w-2xl">
        Publiez automatiquement vos logos, bannières GIF et photos sur votre propre hébergement (ex. SiteGround),
        via un sous-domaine <b>toujours actif en HTTPS</b>. Les signatures pointeront vers ces URLs — les images
        s'afficheront dans Outlook même quand le serveur de l'application est en veille.
      </p>

      <div className="mt-6 rounded-2xl border border-slate-700 bg-[#111827] p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-slate-200 text-base">Activer l'hébergement externe des images</Label>
            <p className="text-xs text-slate-500 mt-1">Quand activé, les nouvelles images sont publiées sur votre FTP et les signatures utilisent l'URL publique.</p>
          </div>
          <Switch data-testid="hosting-enabled" checked={form.enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))} />
        </div>

        <div>
          <Label className="text-slate-300">Fournisseur d'hébergement des images</Label>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {[
              { id: "r2", title: "Cloudflare R2", desc: "Gratuit, toujours actif, sans anti-bot (recommandé)" },
              { id: "ftp", title: "SiteGround / FTP", desc: "Votre hébergement web via FTP" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                data-testid={`hosting-provider-${opt.id}`}
                onClick={() => setForm((f) => ({ ...f, provider: opt.id }))}
                className={`text-left rounded-xl border p-3 transition-colors ${form.provider === opt.id ? "border-blue-500 bg-blue-950/40" : "border-slate-700 bg-slate-800/40 hover:border-slate-600"}`}
              >
                <div className="text-sm font-semibold text-white">{opt.title}</div>
                <div className="text-xs text-slate-400 mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-slate-300">URL publique (HTTPS)</Label>
          <Input data-testid="hosting-public-url" value={form.public_url} onChange={set("public_url")} placeholder={form.provider === "r2" ? "https://xxxx.r2.dev  ou  https://sig.champagneur.qc.ca" : "https://sig.champagneur.qc.ca"} className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
          <p className="text-xs text-slate-500 mt-1">{form.provider === "r2" ? "L'URL publique de votre bucket R2 (r2.dev) ou votre domaine personnalisé relié à R2." : "L'adresse où vos fichiers sont accessibles publiquement (racine du sous-domaine)."}</p>
        </div>

        {form.provider === "r2" && (
          <div className="grid sm:grid-cols-2 gap-4" data-testid="hosting-r2-fields">
            <div>
              <Label className="text-slate-300">Account ID (Cloudflare)</Label>
              <Input data-testid="hosting-r2-account" value={form.r2_account_id} onChange={set("r2_account_id")} placeholder="ex. 8f3a1b2c...  (32 caractères)" className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
            </div>
            <div>
              <Label className="text-slate-300">Nom du bucket</Label>
              <Input data-testid="hosting-r2-bucket" value={form.r2_bucket} onChange={set("r2_bucket")} placeholder="ex. sigchamp" className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
            </div>
            <div>
              <Label className="text-slate-300">Access Key ID</Label>
              <Input data-testid="hosting-r2-access" value={form.r2_access_key} onChange={set("r2_access_key")} placeholder="clé d'accès R2" className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
            </div>
            <div>
              <Label className="text-slate-300">Secret Access Key {hasR2Secret && <span className="text-xs text-emerald-400">(enregistré)</span>}</Label>
              <Input data-testid="hosting-r2-secret" type="password" value={form.r2_secret_key} onChange={set("r2_secret_key")} placeholder={hasR2Secret ? "•••••••• (laisser vide pour garder)" : "secret R2"} className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
            </div>
          </div>
        )}

        {form.provider === "r2" && (
          <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/40 px-4 py-3" data-testid="hosting-backup-toggle-row">
            <div>
              <Label className="text-slate-200 text-sm">Backup automatique vers SiteGround (FTP)</Label>
              <p className="text-xs text-slate-500 mt-1">Copie aussi chaque image sur votre FTP SiteGround. Les signatures continuent d'utiliser R2 ; SiteGround sert de copie de secours.</p>
            </div>
            <Switch data-testid="hosting-backup-enabled" checked={form.backup_enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, backup_enabled: v }))} />
          </div>
        )}

        {form.provider === "r2" && (
          <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/40 px-4 py-3" data-testid="hosting-autocleanup-row">
            <div>
              <Label className="text-slate-200 text-sm">Nettoyage automatique des orphelins</Label>
              <p className="text-xs text-slate-500 mt-1">Supprime automatiquement de R2 les anciens fichiers inutilisés après chaque changement de logo (charte) ou de photo (avatar). Enregistrez pour activer.</p>
            </div>
            <Switch data-testid="hosting-autocleanup-enabled" checked={form.auto_cleanup} onCheckedChange={(v) => setForm((f) => ({ ...f, auto_cleanup: v }))} />
          </div>
        )}

        {(form.provider === "ftp" || (form.provider === "r2" && form.backup_enabled)) && (
        <>
        {form.provider === "r2" && (
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest pt-1">Backup SiteGround / FTP</p>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-slate-300">Hôte FTP</Label>
            <Input data-testid="hosting-ftp-host" value={form.ftp_host} onChange={set("ftp_host")} placeholder="ftp.champagneur.qc.ca" className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
          </div>
          <div>
            <Label className="text-slate-300">Port</Label>
            <Input data-testid="hosting-ftp-port" type="number" value={form.ftp_port} onChange={(e) => setForm((f) => ({ ...f, ftp_port: Number(e.target.value) }))} placeholder="21" className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
          </div>
          <div>
            <Label className="text-slate-300">Utilisateur FTP</Label>
            <Input data-testid="hosting-ftp-user" value={form.ftp_user} onChange={set("ftp_user")} placeholder="sig@champagneur.qc.ca" className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
          </div>
          <div>
            <Label className="text-slate-300">Mot de passe FTP {hasPassword && <span className="text-xs text-emerald-400">(enregistré)</span>}</Label>
            <Input data-testid="hosting-ftp-password" type="password" value={form.ftp_password} onChange={set("ftp_password")} placeholder={hasPassword ? "•••••••• (laisser vide pour garder)" : "mot de passe"} className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-slate-300">Dossier distant (optionnel)</Label>
            <Input data-testid="hosting-ftp-dir" value={form.ftp_dir} onChange={set("ftp_dir")} placeholder="ex. public_html ou / (racine du sous-domaine)" className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
            <p className="text-xs text-slate-500 mt-1">Chemin vers le dossier du sous-domaine sur votre serveur. Laissez vide si le compte FTP y pointe déjà.</p>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/40 px-3 mt-6 sm:mt-[26px] h-11">
            <Label className="text-slate-300 text-sm">FTP sécurisé (FTPS/TLS)</Label>
            <Switch data-testid="hosting-ftp-secure" checked={form.ftp_secure} onCheckedChange={(v) => setForm((f) => ({ ...f, ftp_secure: v }))} />
          </div>
        </div>
        </>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <Button data-testid="hosting-save" onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Enregistrer
          </Button>
          <Button data-testid="hosting-test" onClick={test} disabled={testing} variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-800">
            {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlugZap className="h-4 w-4 mr-2" />} Tester la connexion
          </Button>
          <Button data-testid="hosting-publish" onClick={publishAll} disabled={publishing} variant="outline" className="border-emerald-600 text-emerald-300 hover:bg-emerald-950/40">
            {publishing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UploadCloud className="h-4 w-4 mr-2" />} Publier toutes les images maintenant
          </Button>
        </div>
      </div>

      {form.provider === "r2" && (
        <div className="mt-6 rounded-2xl border border-slate-700 bg-[#111827] p-6" data-testid="r2-usage-card">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-blue-400" />
              <div>
                <h2 className="text-lg font-semibold text-white">Usage du stockage R2</h2>
                <p className="text-xs text-slate-500">Offre gratuite Cloudflare R2 : 10 Go de stockage. La bande passante est toujours gratuite.</p>
              </div>
            </div>
            <Button data-testid="usage-refresh" onClick={fetchUsage} disabled={loadingUsage} variant="outline" size="sm" className="border-slate-600 text-slate-200 hover:bg-slate-800">
              {loadingUsage ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />} Rafraîchir
            </Button>
          </div>

          {!usage && !loadingUsage && (
            <p className="text-sm text-slate-400 mt-4">Cliquez sur « Rafraîchir » pour afficher l'usage (nécessite R2 configuré et enregistré).</p>
          )}

          {usage && usage.available === false && (
            <p className="text-sm text-amber-400 mt-4 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> {usage.reason || "R2 non disponible."}</p>
          )}

          {usage && usage.available && (
            <div className="mt-5 space-y-4" data-testid="usage-details">
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-300">{usage.used_gb} Go / {usage.quota_gb} Go utilisés</span>
                  <span className={usage.percent >= 80 ? "text-red-400 font-semibold" : "text-slate-400"} data-testid="usage-percent">{usage.percent}%</span>
                </div>
                <Progress value={Math.min(usage.percent, 100)} className={`h-2.5 ${usage.percent >= 80 ? "[&>div]:bg-red-500" : "[&>div]:bg-blue-500"}`} />
                {usage.percent >= 80 && (
                  <p className="text-xs text-red-400 mt-2 flex items-center gap-1.5" data-testid="usage-alert">
                    <AlertTriangle className="h-3.5 w-3.5" /> Vous approchez de la limite gratuite de 10 Go. Nettoyez les fichiers orphelins ou basculez vers SiteGround.
                  </p>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-3">
                  <div className="text-xs text-slate-500">Fichiers stockés</div>
                  <div className="text-xl font-semibold text-white mt-0.5" data-testid="usage-objects">{usage.object_count}</div>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-3">
                  <div className="text-xs text-slate-500">Fichiers orphelins (non utilisés)</div>
                  <div className="text-xl font-semibold text-white mt-0.5" data-testid="usage-orphans">{usage.orphan_count} <span className="text-sm font-normal text-slate-400">· {fmtBytes(usage.orphan_bytes)}</span></div>
                </div>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button data-testid="cleanup-btn" disabled={cleaning || usage.orphan_count === 0} variant="outline" className="border-red-600/70 text-red-300 hover:bg-red-950/40 disabled:opacity-40">
                    {cleaning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />} Supprimer les fichiers orphelins
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-[#111827] border-slate-700 text-white">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-white">Supprimer les fichiers orphelins ?</AlertDialogTitle>
                    <AlertDialogDescription className="text-slate-400">
                      Cette action supprime définitivement de R2 (et du backup SiteGround) les <b>{usage.orphan_count} fichier(s)</b> qui ne sont plus utilisés par aucune signature actuelle
                      ({fmtBytes(usage.orphan_bytes)}). Vos logos, bannières et photos <b>actuels</b> ainsi que vos configurations sont conservés. Action irréversible.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-transparent border-slate-600 text-slate-200 hover:bg-slate-800">Annuler</AlertDialogCancel>
                    <AlertDialogAction data-testid="cleanup-confirm" onClick={cleanup} className="bg-red-600 hover:bg-red-500 text-white">Supprimer</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-900/40 p-5 text-sm text-slate-300 space-y-2">
        <p className="flex items-center gap-2 font-semibold text-slate-200"><HardDrive className="h-4 w-4 text-blue-400" /> Comment ça marche</p>
        {form.provider === "r2" ? (
          <ol className="list-decimal ml-5 space-y-1 text-slate-400">
            <li>Créez un compte <b>Cloudflare</b> (gratuit) puis, dans <b>R2</b>, créez un <b>bucket</b> (ex. <code>sigchamp</code>).</li>
            <li>Ouvrez le bucket → <b>Settings</b> → activez <b>Public Development URL</b> (ou reliez un domaine perso). Copiez cette URL publique.</li>
            <li>Menu <b>R2 → Manage R2 API Tokens</b> → créez un jeton <b>Object Read &amp; Write</b> → notez l'<b>Access Key ID</b> et le <b>Secret Access Key</b>.</li>
            <li>Votre <b>Account ID</b> est affiché sur la page d'accueil R2 (ou dans l'URL du tableau de bord).</li>
            <li>Remplissez ci-dessus, cliquez <b>Tester la connexion</b>, <b>Enregistrer</b>, puis <b>Publier toutes les images</b>. Re-poussez ensuite les signatures.</li>
          </ol>
        ) : (
          <ol className="list-decimal ml-5 space-y-1 text-slate-400">
            <li>Créez le sous-domaine <b>sig.champagneur.qc.ca</b> dans SiteGround et activez le <b>SSL (HTTPS)</b> gratuit.</li>
            <li>Créez un <b>compte FTP</b> (Site Tools → FTP) pointant sur le dossier de ce sous-domaine.</li>
            <li>Remplissez ci-dessus, cliquez <b>Tester la connexion</b> (un fichier de test est envoyé), puis <b>Enregistrer</b>.</li>
            <li>Cliquez <b>Publier toutes les images</b> pour envoyer vos logos/bannières actuels, puis re-poussez les signatures.</li>
          </ol>
        )}
      </div>
    </div>
  );
}
