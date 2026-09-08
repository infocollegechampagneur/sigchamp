import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Cloud, Save, Loader2, Users, Send, CheckCircle2, Search, ShieldCheck, PlugZap, Trash2, XCircle, UserPlus, RefreshCw } from "lucide-react";

export default function M365Connect() {
  const [cfg, setCfg] = useState({ tenant_id: "", client_id: "", client_secret: "", tenant_domain: "", has_secret: false, connected: false });
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState({});
  const [pushing, setPushing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [lastErrors, setLastErrors] = useState([]);
  const [q, setQ] = useState("");
  const [syncProgress, setSyncProgress] = useState(null);
  const [roaming, setRoaming] = useState(null);
  const [roamingBusy, setRoamingBusy] = useState(false);

  useEffect(() => { api.get("/m365/config").then((r) => setCfg((c) => ({ ...c, ...r.data, client_secret: "" }))); }, []);
  useEffect(() => { api.get("/m365/roaming").then((r) => setRoaming(r.data.postponed)).catch(() => {}); }, []);

  const setRoamingState = async (postpone) => {
    setRoamingBusy(true);
    try {
      const { data } = await api.post("/m365/roaming", { postpone });
      setRoaming(data.postponed);
      toast.success(postpone ? "Signatures itinérantes désactivées — les signatures SigChamp seront visibles dans Outlook." : "Signatures itinérantes réactivées.");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } finally { setRoamingBusy(false); }
  };
  const set = (k) => (e) => setCfg((c) => ({ ...c, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/m365/config", { tenant_id: cfg.tenant_id, client_id: cfg.client_id,
        client_secret: cfg.client_secret || undefined, tenant_domain: cfg.tenant_domain });
      const { data } = await api.get("/m365/config");
      setCfg((c) => ({ ...c, ...data, client_secret: "" }));
      toast.success("Configuration Microsoft 365 enregistrée.");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } finally { setSaving(false); }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/m365/users");
      setUsers(data);
      toast.success(`${data.length} utilisateur(s) chargé(s) depuis Microsoft 365.`);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } finally { setLoading(false); }
  };

  const filtered = users.filter((u) => (u.name + u.email).toLowerCase().includes(q.toLowerCase()));
  const selectedEmails = Object.keys(selected).filter((e) => selected[e]);
  const toggle = (email) => setSelected((s) => ({ ...s, [email]: !s[email] }));
  const selectAll = () => { const all = {}; filtered.forEach((u) => (all[u.email] = true)); setSelected(all); };

  const push = async () => {
    if (!selectedEmails.length) { toast.error("Sélectionnez au moins un utilisateur."); return; }
    setPushing(true); setLastErrors([]);
    try {
      const { data } = await api.post("/m365/push", { emails: selectedEmails, fallback: "Ignore" });
      if (data.applied_count) toast.success(`${data.applied_count} signature(s) appliquée(s).`);
      if (data.failed?.length) {
        setLastErrors(data.failed);
        toast.error(`${data.failed.length} échec(s) — ${data.failed[0].error}`, { duration: 15000 });
      }
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } finally { setPushing(false); }
  };

  const removeRules = async () => {
    if (!selectedEmails.length) { toast.error("Sélectionnez au moins un utilisateur."); return; }
    if (!window.confirm(`Retirer la signature M365 de ${selectedEmails.length} utilisateur(s) ?`)) return;
    setRemoving(true); setLastErrors([]);
    try {
      const { data } = await api.post("/m365/remove", { emails: selectedEmails });
      if (data.removed_count) toast.success(`${data.removed_count} signature(s) retirée(s).`);
      if (data.failed?.length) {
        setLastErrors(data.failed);
        toast.error(`${data.failed.length} échec(s) — ${data.failed[0].error}`, { duration: 15000 });
      }
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } finally { setRemoving(false); }
  };

  const testConn = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data } = await api.get("/m365/test");
      setTestResult(data);
      if (data.graph_ok && data.exchange_ok) toast.success("Connexion Microsoft 365 valide ✅");
      else toast.error("Connexion partielle ou invalide — voir le détail.");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } finally { setTesting(false); }
  };

  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const importFiches = async () => {
    if (!selectedEmails.length) { toast.error("Sélectionnez au moins un utilisateur."); return; }
    setImporting(true); setLastErrors([]);
    try {
      const { data } = await api.post("/m365/import", { emails: selectedEmails });
      toast.success(`${data.imported_count} fiche(s) créée(s), ${data.updated_count} mise(s) à jour.`);
      if (data.failed?.length) setLastErrors(data.failed);
      loadUsers();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } finally { setImporting(false); }
  };

  const syncFiches = async () => {
    setSyncing(true); setLastErrors([]); setSyncProgress({ done: 0, total: 0 });
    try {
      const { data } = await api.post("/m365/sync");
      setSyncProgress({ done: 0, total: data.total });
      const poll = setInterval(async () => {
        try {
          const { data: st } = await api.get("/m365/sync/status");
          setSyncProgress({ done: st.done, total: st.total });
          if (!st.running) {
            clearInterval(poll);
            setSyncing(false);
            if (st.failed?.length) setLastErrors(st.failed);
            toast.success(`${st.synced} fiche(s) synchronisée(s) depuis Microsoft 365.`);
            setTimeout(() => setSyncProgress(null), 4000);
          }
        } catch (e) { clearInterval(poll); setSyncing(false); }
      }, 1500);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); setSyncing(false); setSyncProgress(null); }
  };

  return (
    <div className="max-w-5xl mx-auto px-5 lg:px-8 py-8">
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-400">Administration</p>
        <h1 className="font-display text-3xl lg:text-4xl font-extrabold text-white mt-1">Microsoft 365</h1>
        <p className="text-slate-400 mt-2">Connectez votre tenant, listez toutes les adresses, choisissez les destinataires et poussez les signatures directement.</p>
      </div>

      {/* Config */}
      <div className="rounded-2xl bg-[#111827] border border-slate-800 p-6 mb-6 sf-fade-up">
        <div className="flex items-center gap-2 mb-4">
          <Cloud className="h-5 w-5 text-blue-400" />
          <h3 className="font-semibold text-white">Connexion au tenant</h3>
          {cfg.connected && <span className="ml-auto flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Connecté</span>}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><Label className="text-slate-300">Tenant ID</Label>
            <Input data-testid="input-m365-tenant" value={cfg.tenant_id} onChange={set("tenant_id")} placeholder="00000000-0000-0000-0000-000000000000" className="mt-1.5 bg-slate-800/60 border-slate-700 text-white font-mono text-xs" /></div>
          <div><Label className="text-slate-300">Domaine tenant</Label>
            <Input data-testid="input-m365-domain" value={cfg.tenant_domain} onChange={set("tenant_domain")} placeholder="contoso.onmicrosoft.com" className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" /></div>
          <div><Label className="text-slate-300">Client ID (application)</Label>
            <Input data-testid="input-m365-client" value={cfg.client_id} onChange={set("client_id")} placeholder="00000000-0000-0000-0000-000000000000" className="mt-1.5 bg-slate-800/60 border-slate-700 text-white font-mono text-xs" /></div>
          <div><Label className="text-slate-300">Secret client {cfg.has_secret && <span className="text-slate-500">(laisser vide pour conserver)</span>}</Label>
            <Input data-testid="input-m365-secret" type="password" value={cfg.client_secret} onChange={set("client_secret")} placeholder="••••••••" className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" /></div>
        </div>
        <div className="flex flex-wrap gap-3 mt-5">
          <Button onClick={save} disabled={saving} data-testid="button-save-m365" className="h-11 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Enregistrer la connexion
          </Button>
          <Button onClick={testConn} disabled={testing} data-testid="button-test-m365" variant="outline" className="h-11 border-slate-700 bg-slate-800/50 text-slate-200 hover:bg-slate-700 hover:text-white px-6">
            {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlugZap className="h-4 w-4 mr-2" />} Tester la connexion
          </Button>
        </div>
        {testResult && (
          <div className="mt-4 grid sm:grid-cols-2 gap-2" data-testid="m365-test-result">
            {[{ label: "Microsoft Graph (lister)", ok: testResult.graph_ok, err: testResult.graph_error },
              { label: "Exchange (pousser)", ok: testResult.exchange_ok, err: testResult.exchange_error }].map((t) => (
              <div key={t.label} className={`flex items-start gap-2 text-sm rounded-xl p-3 border ${t.ok ? "border-emerald-500/30 bg-emerald-500/10" : "border-red-500/30 bg-red-500/10"}`}>
                {t.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />}
                <div className="min-w-0">
                  <p className={t.ok ? "text-emerald-300" : "text-red-300"}>{t.label} : {t.ok ? "OK" : "échec"}</p>
                  {!t.ok && t.err && <p className="text-xs text-slate-400 break-words">{t.err}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 flex gap-3 text-xs text-slate-400 bg-slate-800/40 border border-slate-700/60 rounded-xl p-3">
          <ShieldCheck className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
          <div>
            « Pousser » définit la <b className="text-slate-200">signature du compte</b> (visible dans Outlook sur le web, Nouveau Outlook et Outlook mobile, ajoutée automatiquement aux nouveaux courriels et réponses). Pour <b className="text-slate-200">Outlook classique installé</b> sur les postes, utilisez le script GPO de la page « Déploiement M365 » (signatures stockées localement).
            <div className="mt-2 pt-2 border-t border-slate-700/60">
              Prérequis Entra ID : une <b className="text-slate-200">App registration</b> avec les permissions d'application
              <code className="text-blue-300"> User.Read.All</code> (Graph) et <code className="text-blue-300"> Exchange.ManageAsApp</code>,
              le consentement admin, et le rôle <b className="text-slate-200">Administrateur Exchange</b> attribué à l'application.
            </div>
          </div>
        </div>
      </div>

      {/* Roaming signatures control */}
      {roaming !== null && (
        <div className={`rounded-2xl border p-5 sf-fade-up ${roaming ? "bg-emerald-500/5 border-emerald-500/30" : "bg-amber-500/5 border-amber-500/30"}`} data-testid="roaming-card">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <h3 className="font-semibold text-white flex items-center gap-2">
                {roaming ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-amber-400" />}
                Signatures itinérantes (roaming)
              </h3>
              <p className="text-sm text-slate-400 mt-1.5">
                {roaming
                  ? "Désactivées ✅ — les signatures poussées par SigChamp s'affichent dans le Nouvel Outlook / Outlook Web / mobile."
                  : "Activées ⚠️ — le Nouvel Outlook / OWA IGNORENT la signature définie par SigChamp. Désactivez-les pour que vos signatures soient visibles."}
              </p>
            </div>
            <Button
              onClick={() => setRoamingState(!roaming)}
              disabled={roamingBusy}
              data-testid="button-toggle-roaming"
              variant="outline"
              className={roaming ? "border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700" : "border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"}
            >
              {roamingBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {roaming ? "Réactiver le roaming" : "Désactiver les signatures itinérantes"}
            </Button>
          </div>
        </div>
      )}

      {/* Users */}
      <div className="rounded-2xl bg-[#111827] border border-slate-800 p-6 sf-fade-up">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2"><Users className="h-5 w-5 text-blue-400" /><h3 className="font-semibold text-white">Adresses du tenant {users.length > 0 && `(${users.length})`}</h3></div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={loadUsers} disabled={loading} data-testid="button-load-m365-users" variant="outline" className="border-slate-700 bg-slate-800/50 text-slate-200 hover:bg-slate-700 hover:text-white">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Users className="h-4 w-4 mr-2" />} Charger les utilisateurs
            </Button>
            <Button onClick={importFiches} disabled={importing || !selectedEmails.length} data-testid="button-import-fiches-m365" variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20">
              {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />} Ajouter comme fiches ({selectedEmails.length})
            </Button>
            <Button onClick={syncFiches} disabled={syncing} data-testid="button-sync-fiches-m365" variant="outline" className="border-slate-700 bg-slate-800/50 text-slate-200 hover:bg-slate-700 hover:text-white">
              {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />} Synchroniser
            </Button>
            <Button onClick={removeRules} disabled={removing || !selectedEmails.length} data-testid="button-remove-m365" variant="outline" className="border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20">
              {removing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />} Retirer ({selectedEmails.length})
            </Button>
            <Button onClick={push} disabled={pushing || !selectedEmails.length} data-testid="button-push-m365" className="bg-blue-600 hover:bg-blue-500 text-white font-semibold">
              {pushing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />} Pousser ({selectedEmails.length})
            </Button>
          </div>
        </div>

        {syncProgress && (
          <div className="mb-4" data-testid="sync-progress">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Synchronisation en cours…</span>
              <span>{syncProgress.done} / {syncProgress.total}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${syncProgress.total ? (syncProgress.done / syncProgress.total) * 100 : 0}%` }} />
            </div>
          </div>
        )}

        {lastErrors.length > 0 && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4" data-testid="m365-push-errors">
            <p className="text-sm font-semibold text-red-300 mb-2">Échec sur {lastErrors.length} utilisateur(s)</p>
            <div className="space-y-2">
              {lastErrors.map((f, i) => (
                <div key={i} className="text-xs">
                  <span className="text-red-200 font-mono">{f.email}</span>
                  <p className="text-red-300/90 mt-0.5 leading-relaxed">{f.error}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {users.length > 0 && (
          <>
            <div className="flex items-center gap-3 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" className="pl-9 bg-slate-800/60 border-slate-700 text-white" data-testid="input-m365-search" />
              </div>
              <button onClick={selectAll} className="text-xs text-blue-400 hover:text-blue-300 shrink-0" data-testid="button-select-all-m365">Tout sélectionner</button>
            </div>
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
              {filtered.map((u) => (
                <label key={u.email} className="flex items-center gap-3 bg-slate-800/40 border border-slate-700/60 rounded-xl p-2.5 cursor-pointer hover:border-slate-600" data-testid={`m365-user-${u.email}`}>
                  <Checkbox checked={!!selected[u.email]} onCheckedChange={() => toggle(u.email)} data-testid={`m365-check-${u.email}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-medium truncate">{u.name || u.email}</p>
                    <p className="text-slate-500 text-xs truncate">{u.email}</p>
                  </div>
                  {u.has_employee && <span className="text-[10px] text-emerald-400 border border-emerald-500/30 rounded-full px-2 py-0.5">Fiche employé</span>}
                  {!u.enabled && <span className="text-[10px] text-slate-500 border border-slate-600 rounded-full px-2 py-0.5">Désactivé</span>}
                </label>
              ))}
            </div>
          </>
        )}
        {!users.length && <p className="text-slate-600 text-sm text-center py-8">Enregistrez la connexion puis cliquez sur « Charger les utilisateurs ».</p>}
      </div>
    </div>
  );
}
