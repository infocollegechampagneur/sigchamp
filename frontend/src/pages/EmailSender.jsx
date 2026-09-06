import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Mail, Save, Loader2, Send, SendHorizonal, ServerCog, CheckCircle2 } from "lucide-react";

export default function EmailSender() {
  const [cfg, setCfg] = useState({ host: "", port: 587, username: "", password: "", from_email: "", from_name: "", has_password: false });
  const [employees, setEmployees] = useState([]);
  const [savingCfg, setSavingCfg] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendingId, setSendingId] = useState(null);

  useEffect(() => {
    api.get("/smtp").then((r) => setCfg((c) => ({ ...c, ...r.data, password: "" })));
    api.get("/employees").then((r) => setEmployees(r.data));
  }, []);

  const set = (k) => (e) => setCfg((c) => ({ ...c, [k]: e.target.value }));

  const saveCfg = async () => {
    setSavingCfg(true);
    try {
      await api.put("/smtp", {
        host: cfg.host, port: Number(cfg.port), username: cfg.username,
        password: cfg.password || undefined, from_email: cfg.from_email, from_name: cfg.from_name,
      });
      const { data } = await api.get("/smtp");
      setCfg((c) => ({ ...c, ...data, password: "" }));
      toast.success("Paramètres SMTP enregistrés.");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setSavingCfg(false);
    }
  };

  const sendTest = async () => {
    if (!testTo) { toast.error("Indiquez une adresse de test."); return; }
    setTesting(true);
    try {
      await api.post("/email/test", { to: testTo });
      toast.success(`Courriel de test envoyé à ${testTo}.`);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setTesting(false);
    }
  };

  const sendOne = async (emp) => {
    setSendingId(emp.id);
    try {
      await api.post(`/email/send/${emp.id}`);
      toast.success(`Signature envoyée à ${emp.email}.`);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setSendingId(null);
    }
  };

  const sendAll = async () => {
    setSendingAll(true);
    try {
      const { data } = await api.post("/email/send-all");
      toast.success(`${data.sent_count} signature(s) envoyée(s).${data.failed.length ? ` ${data.failed.length} échec(s).` : ""}`);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setSendingAll(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-5 lg:px-8 py-8">
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-400">Administration</p>
        <h1 className="font-display text-3xl lg:text-4xl font-extrabold text-white mt-1">Envois courriel</h1>
        <p className="text-slate-400 mt-2">Configurez votre serveur SMTP puis envoyez à chaque employé sa signature (corps + fichier .html).</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* SMTP config */}
        <div className="rounded-2xl bg-[#111827] border border-slate-800 p-6 sf-fade-up">
          <div className="flex items-center gap-2 mb-5">
            <ServerCog className="h-5 w-5 text-blue-400" />
            <h3 className="font-semibold text-white">Serveur SMTP</h3>
            {cfg.has_password && <span className="ml-auto flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Configuré</span>}
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label className="text-slate-300">Hôte SMTP</Label>
              <Input data-testid="input-smtp-host" value={cfg.host} onChange={set("host")} placeholder="smtp.office365.com" className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
            </div>
            <div>
              <Label className="text-slate-300">Port</Label>
              <Input data-testid="input-smtp-port" type="number" value={cfg.port} onChange={set("port")} placeholder="587" className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
            </div>
            <div>
              <Label className="text-slate-300">Nom d'expéditeur</Label>
              <Input data-testid="input-smtp-fromname" value={cfg.from_name} onChange={set("from_name")} placeholder="Mon Entreprise" className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-slate-300">Utilisateur</Label>
              <Input data-testid="input-smtp-username" value={cfg.username} onChange={set("username")} placeholder="no-reply@entreprise.com" className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-slate-300">Mot de passe {cfg.has_password && <span className="text-slate-500">(laisser vide pour conserver)</span>}</Label>
              <Input data-testid="input-smtp-password" type="password" value={cfg.password} onChange={set("password")} placeholder="••••••••" className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-slate-300">Adresse d'expéditeur (From)</Label>
              <Input data-testid="input-smtp-fromemail" value={cfg.from_email} onChange={set("from_email")} placeholder="signatures@entreprise.com" className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
            </div>
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
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2"><Mail className="h-5 w-5 text-blue-400" /><h3 className="font-semibold text-white">Envoyer les signatures</h3></div>
            <Button onClick={sendAll} disabled={sendingAll || !employees.length} data-testid="button-send-all" className="bg-blue-600 hover:bg-blue-500 text-white font-semibold">
              {sendingAll ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <SendHorizonal className="h-4 w-4 mr-2" />} Envoyer à tous
            </Button>
          </div>
          <div className="space-y-2">
            {employees.map((emp) => (
              <div key={emp.id} className="flex items-center gap-3 bg-slate-800/40 border border-slate-700/70 rounded-xl p-2.5" data-testid={`send-row-${emp.id}`}>
                <Avatar className="h-9 w-9 border border-slate-700">
                  <AvatarImage src={emp.avatar_url} />
                  <AvatarFallback className="bg-blue-600/80 text-white text-xs">{(emp.name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-medium truncate">{emp.name}</p>
                  <p className="text-slate-500 text-xs truncate">{emp.email}{emp.department ? ` · ${emp.department}` : ""}</p>
                </div>
                <Button onClick={() => sendOne(emp)} disabled={sendingId === emp.id} data-testid={`button-send-${emp.id}`} size="sm" variant="outline" className="border-slate-700 bg-slate-800/50 text-slate-200 hover:bg-slate-700 hover:text-white shrink-0">
                  {sendingId === emp.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-1.5" /> Envoyer</>}
                </Button>
              </div>
            ))}
            {!employees.length && <p className="text-slate-600 text-sm text-center py-6">Aucun employé.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
