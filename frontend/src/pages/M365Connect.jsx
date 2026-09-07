import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Cloud, Save, Loader2, Users, Send, CheckCircle2, Search, ShieldCheck } from "lucide-react";

export default function M365Connect() {
  const [cfg, setCfg] = useState({ tenant_id: "", client_id: "", client_secret: "", tenant_domain: "", has_secret: false, connected: false });
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState({});
  const [pushing, setPushing] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => { api.get("/m365/config").then((r) => setCfg((c) => ({ ...c, ...r.data, client_secret: "" }))); }, []);
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
    setPushing(true);
    try {
      const { data } = await api.post("/m365/push", { emails: selectedEmails, fallback: "Ignore" });
      toast.success(`${data.applied_count} signature(s) appliquée(s).${data.failed.length ? ` ${data.failed.length} échec(s).` : ""}`);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } finally { setPushing(false); }
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
        <Button onClick={save} disabled={saving} data-testid="button-save-m365" className="mt-5 h-11 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Enregistrer la connexion
        </Button>
        <div className="mt-4 flex gap-3 text-xs text-slate-400 bg-slate-800/40 border border-slate-700/60 rounded-xl p-3">
          <ShieldCheck className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
          <div>
            Créez une <b className="text-slate-200">App registration</b> dans Entra ID avec les permissions d'application
            <code className="text-blue-300"> User.Read.All</code> (Graph) et <code className="text-blue-300"> Exchange.ManageAsApp</code>,
            accordez le consentement admin, et attribuez le rôle <b className="text-slate-200">Administrateur Exchange</b> à l'application.
            Détails dans <code className="text-blue-300">SELF_HOSTING_M365_GUIDE.md</code>.
          </div>
        </div>
      </div>

      {/* Users */}
      <div className="rounded-2xl bg-[#111827] border border-slate-800 p-6 sf-fade-up">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2"><Users className="h-5 w-5 text-blue-400" /><h3 className="font-semibold text-white">Adresses du tenant {users.length > 0 && `(${users.length})`}</h3></div>
          <div className="flex gap-2">
            <Button onClick={loadUsers} disabled={loading} data-testid="button-load-m365-users" variant="outline" className="border-slate-700 bg-slate-800/50 text-slate-200 hover:bg-slate-700 hover:text-white">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Users className="h-4 w-4 mr-2" />} Charger les utilisateurs
            </Button>
            <Button onClick={push} disabled={pushing || !selectedEmails.length} data-testid="button-push-m365" className="bg-blue-600 hover:bg-blue-500 text-white font-semibold">
              {pushing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />} Pousser ({selectedEmails.length})
            </Button>
          </div>
        </div>

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
