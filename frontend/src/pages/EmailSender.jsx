import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Mail, Save, Loader2, Send, SendHorizonal, ServerCog, CheckCircle2, BellRing, Circle, History, XCircle, Zap } from "lucide-react";

function StatusBadge({ status }) {
  if (status === "sent") return <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" />Envoyée</span>;
  if (status === "failed") return <span className="inline-flex items-center gap-1 text-xs text-red-400"><XCircle className="h-3.5 w-3.5" />Échec</span>;
  return <span className="text-xs text-slate-500">—</span>;
}

export default function EmailSender() {
  const [cfg, setCfg] = useState({ host: "", port: 587, username: "", password: "", from_email: "", from_name: "", has_password: false });
  const [employees, setEmployees] = useState([]);
  const [log, setLog] = useState([]);
  const [savingCfg, setSavingCfg] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [sendingId, setSendingId] = useState(null);

  const loadEmployees = () => api.get("/employees").then((r) => setEmployees(r.data));
  const loadLog = () => api.get("/send-log").then((r) => setLog(r.data));

  useEffect(() => {
    api.get("/smtp").then((r) => setCfg((c) => ({ ...c, ...r.data, password: "" })));
    loadEmployees();
    loadLog();
  }, []);

  const set = (k) => (e) => setCfg((c) => ({ ...c, [k]: e.target.value }));

  const prefillSmtp2go = () => {
    setCfg((c) => ({ ...c, host: "mail.smtp2go.com", port: 587 }));
    toast.success("Réglages SMTP2Go pré-remplis. Ajoutez votre utilisateur, mot de passe et adresse d'expéditeur.");
  };

  const saveCfg = async () => {
    setSavingCfg(true);
    try {
      await api.put("/smtp", { host: cfg.host, port: Number(cfg.port), username: cfg.username,
        password: cfg.password || undefined, from_email: cfg.from_email, from_name: cfg.from_name });
      const { data } = await api.get("/smtp");
      setCfg((c) => ({ ...c, ...data, password: "" }));
      toast.success("Paramètres SMTP enregistrés.");
      // Test automatique juste après l'enregistrement
      const dest = data.from_email || data.username;
      if (dest) {
        toast.info(`Envoi d'un test automatique à ${dest}…`);
        try {
          await api.post("/email/test", { to: dest });
          toast.success(`Test réussi ✅ — courriel envoyé à ${dest}.`);
        } catch (te) {
          toast.error(`Test échoué : ${formatApiError(te.response?.data?.detail)}`);
        }
      }
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } finally { setSavingCfg(false); }
  };

  const sendTest = async () => {
    if (!testTo) { toast.error("Indiquez une adresse de test."); return; }
    setTesting(true);
    try { await api.post("/email/test", { to: testTo }); toast.success(`Courriel de test envoyé à ${testTo}.`); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } finally { setTesting(false); }
  };

  const afterSend = () => { loadEmployees(); loadLog(); };

  const sendOne = async (emp) => {
    setSendingId(emp.id);
    try { await api.post(`/email/send/${emp.id}`); toast.success(`Signature envoyée à ${emp.email}.`); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } finally { setSendingId(null); afterSend(); }
  };

  const sendAll = async () => {
    setSendingAll(true);
    try { const { data } = await api.post("/email/send-all"); toast.success(`${data.sent_count} envoyée(s).${data.failed.length ? ` ${data.failed.length} échec(s).` : ""}`); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } finally { setSendingAll(false); afterSend(); }
  };

  const sendReminders = async () => {
    setReminding(true);
    try {
      const { data } = await api.post("/email/send-reminders");
      toast.success(`Relance : ${data.sent_count}/${data.targeted} non-installé(s) recontacté(s).${data.failed.length ? ` ${data.failed.length} échec(s).` : ""}`);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } finally { setReminding(false); afterSend(); }
  };

  const toggleInstalled = async (emp) => {
    try { await api.put(`/employees/${emp.id}/installed`); await loadEmployees(); }
    catch { toast.error("Échec de la mise à jour."); }
  };

  const notInstalled = employees.filter((e) => e.role === "employee" && !e.signature_installed).length;

  return (
    <div className="max-w-6xl mx-auto px-5 lg:px-8 py-8">
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-400">Administration</p>
        <h1 className="font-display text-3xl lg:text-4xl font-extrabold text-white mt-1">Envois courriel</h1>
        <p className="text-slate-400 mt-2">Configurez le SMTP, envoyez les signatures, suivez qui l'a installée et relancez les retardataires.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* SMTP config */}
        <div className="rounded-2xl bg-[#111827] border border-slate-800 p-6 sf-fade-up">
          <div className="flex items-center gap-2 mb-5">
            <ServerCog className="h-5 w-5 text-blue-400" />
            <h3 className="font-semibold text-white">Serveur SMTP</h3>
            <button onClick={prefillSmtp2go} data-testid="button-prefill-smtp2go" className="ml-auto flex items-center gap-1.5 text-xs text-blue-300 hover:text-blue-200 border border-blue-500/40 bg-blue-500/10 rounded-lg px-2.5 py-1.5 transition-colors">
              <Zap className="h-3.5 w-3.5" /> Pré-remplir SMTP2Go
            </button>
          </div>
          <div className="flex items-center gap-2 mb-4 -mt-2">
            {cfg.has_password && <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Configuré</span>}
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><Label className="text-slate-300">Hôte SMTP</Label>
              <Input data-testid="input-smtp-host" value={cfg.host} onChange={set("host")} placeholder="smtp.office365.com" className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" /></div>
            <div><Label className="text-slate-300">Port</Label>
              <Input data-testid="input-smtp-port" type="number" value={cfg.port} onChange={set("port")} placeholder="587" className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" /></div>
            <div><Label className="text-slate-300">Nom d'expéditeur</Label>
              <Input data-testid="input-smtp-fromname" value={cfg.from_name} onChange={set("from_name")} placeholder="Mon Entreprise" className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" /></div>
            <div className="sm:col-span-2"><Label className="text-slate-300">Utilisateur</Label>
              <Input data-testid="input-smtp-username" value={cfg.username} onChange={set("username")} placeholder="no-reply@entreprise.com" className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" /></div>
            <div className="sm:col-span-2"><Label className="text-slate-300">Mot de passe {cfg.has_password && <span className="text-slate-500">(laisser vide pour conserver)</span>}</Label>
              <Input data-testid="input-smtp-password" type="password" value={cfg.password} onChange={set("password")} placeholder="••••••••" className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" /></div>
            <div className="sm:col-span-2"><Label className="text-slate-300">Adresse d'expéditeur (From)</Label>
              <Input data-testid="input-smtp-fromemail" value={cfg.from_email} onChange={set("from_email")} placeholder="signatures@entreprise.com" className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" /></div>
          </div>
          <Button onClick={saveCfg} disabled={savingCfg} data-testid="button-save-smtp" className="w-full mt-5 h-11 bg-blue-600 hover:bg-blue-500 text-white font-semibold">
            {savingCfg ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Enregistrer SMTP
          </Button>
          <div className="mt-5 pt-5 border-t border-slate-800">
            <Label className="text-slate-300">Envoyer un courriel de test</Label>
            <div className="flex gap-2 mt-1.5">
              <Input data-testid="input-test-email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="vous@entreprise.com" className="bg-slate-800/60 border-slate-700 text-white" />
              <Button onClick={sendTest} disabled={testing} data-testid="button-send-test" variant="outline" className="border-slate-700 bg-slate-800/50 text-slate-200 hover:bg-slate-700 hover:text-white shrink-0">
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Employees send list */}
        <div className="rounded-2xl bg-[#111827] border border-slate-800 p-6 sf-fade-up">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2"><Mail className="h-5 w-5 text-blue-400" /><h3 className="font-semibold text-white">Envoyer les signatures</h3></div>
            <div className="flex gap-2">
              <Button onClick={sendReminders} disabled={reminding || !notInstalled} data-testid="button-send-reminders" variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20">
                {reminding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BellRing className="h-4 w-4 mr-2" />} Relancer {notInstalled > 0 ? `(${notInstalled})` : ""}
              </Button>
              <Button onClick={sendAll} disabled={sendingAll || !employees.length} data-testid="button-send-all" className="bg-blue-600 hover:bg-blue-500 text-white font-semibold">
                {sendingAll ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <SendHorizonal className="h-4 w-4 mr-2" />} Tous
              </Button>
            </div>
          </div>
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {employees.map((emp) => (
              <div key={emp.id} className="flex items-center gap-3 bg-slate-800/40 border border-slate-700/70 rounded-xl p-2.5" data-testid={`send-row-${emp.id}`}>
                <Avatar className="h-9 w-9 border border-slate-700"><AvatarImage src={emp.avatar_url} /><AvatarFallback className="bg-blue-600/80 text-white text-xs">{(emp.name || "?").slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-medium truncate">{emp.name}</p>
                  <div className="flex items-center gap-2"><StatusBadge status={emp.last_send_status} /></div>
                </div>
                <button onClick={() => toggleInstalled(emp)} data-testid={`toggle-installed-${emp.id}`} title="Marquer comme installée"
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors ${emp.signature_installed ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-slate-600 bg-slate-800 text-slate-400 hover:text-white"}`}>
                  {emp.signature_installed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />} Installée
                </button>
                <Button onClick={() => sendOne(emp)} disabled={sendingId === emp.id} data-testid={`button-send-${emp.id}`} size="sm" variant="outline" className="border-slate-700 bg-slate-800/50 text-slate-200 hover:bg-slate-700 hover:text-white shrink-0">
                  {sendingId === emp.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            ))}
            {!employees.length && <p className="text-slate-600 text-sm text-center py-6">Aucun employé.</p>}
          </div>
        </div>
      </div>

      {/* Send log */}
      <div className="rounded-2xl bg-[#111827] border border-slate-800 p-6 mt-8 sf-fade-up" data-testid="send-log-section">
        <div className="flex items-center gap-2 mb-5"><History className="h-5 w-5 text-blue-400" /><h3 className="font-semibold text-white">Journal d'envois</h3></div>
        <div className="space-y-1.5 max-h-[360px] overflow-y-auto">
          {log.map((e) => (
            <div key={e.id} className="flex items-center gap-3 text-sm py-2 border-b border-slate-800/70" data-testid={`log-row-${e.id}`}>
              <div className="w-28 shrink-0"><StatusBadge status={e.status} /></div>
              <div className="flex-1 min-w-0">
                <span className="text-slate-200">{e.name}</span> <span className="text-slate-500">· {e.email}</span>
                {e.status === "failed" && e.error && <p className="text-xs text-red-400/80 truncate">{e.error}</p>}
              </div>
              <span className="text-xs text-slate-500 shrink-0">{new Date(e.ts).toLocaleString("fr-CA")}</span>
            </div>
          ))}
          {!log.length && <p className="text-slate-600 text-sm text-center py-8">Aucun envoi pour l'instant.</p>}
        </div>
      </div>
    </div>
  );
}
