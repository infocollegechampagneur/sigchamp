import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Palette, Images, ServerCog, Users, Cloud, Rocket, ArrowRight } from "lucide-react";

export default function SetupWizard() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(null);
  const [smtp, setSmtp] = useState(null);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    api.get("/settings").then((r) => setSettings(r.data));
    api.get("/smtp").then((r) => setSmtp(r.data));
    api.get("/employees").then((r) => setEmployees(r.data));
  }, []);

  const emps = employees.filter((e) => e.role === "employee");
  const anySent = emps.some((e) => e.last_sent_at);

  const steps = [
    {
      icon: Palette, title: "Charte graphique",
      desc: "Ajoutez votre logo, vos coordonnées, réseaux sociaux et la mention de confidentialité.",
      done: !!(settings && settings.logo_url), to: "/app/brand", testid: "setup-step-brand",
    },
    {
      icon: Images, title: "Bannière animée (GIF)",
      desc: "Composez la bannière d'images défilantes (par défaut et/ou par département).",
      done: !!(settings && settings.gif_url), to: "/app/gif", testid: "setup-step-gif",
    },
    {
      icon: ServerCog, title: "Serveur SMTP",
      desc: "Configurez SMTP2Go ou Office 365 pour envoyer les signatures aux employés.",
      done: !!(smtp && smtp.has_password && smtp.host), to: "/app/email", testid: "setup-step-smtp",
    },
    {
      icon: Users, title: "Ajouter des employés",
      desc: "Créez les comptes ; chacun complétera ensuite ses coordonnées.",
      done: emps.length > 0, to: "/app/employees", testid: "setup-step-employees",
    },
    {
      icon: Cloud, title: "Envoyer / Déployer",
      desc: "Envoyez les signatures par courriel ou déployez via Microsoft 365.",
      done: anySent, to: "/app/deploy", testid: "setup-step-deploy",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);
  const allDone = doneCount === steps.length;

  return (
    <div className="max-w-3xl mx-auto px-5 lg:px-8 py-8">
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-400">Bienvenue</p>
        <h1 className="font-display text-3xl lg:text-4xl font-extrabold text-white mt-1">Assistant de configuration</h1>
        <p className="text-slate-400 mt-2">Suivez ces étapes pour mettre en place vos signatures. Chaque étape se coche automatiquement une fois complétée.</p>
      </div>

      {/* Progress */}
      <div className="rounded-2xl bg-[#111827] border border-slate-800 p-6 mb-6 sf-fade-up">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-white">{allDone ? "Configuration terminée 🎉" : `Progression : ${doneCount}/${steps.length}`}</span>
          <span className="text-sm font-mono text-blue-400" data-testid="setup-progress-pct">{pct}%</span>
        </div>
        <div className="h-3 rounded-full bg-slate-800 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500" style={{ width: `${pct}%` }} data-testid="setup-progress-bar" />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <button
              key={i}
              onClick={() => navigate(s.to)}
              data-testid={s.testid}
              className={`w-full text-left flex items-center gap-4 p-4 rounded-2xl border transition-all sf-fade-up ${s.done ? "bg-emerald-500/5 border-emerald-500/20" : "bg-[#111827] border-slate-800 hover:border-blue-500/50"}`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="shrink-0">
                {s.done ? <CheckCircle2 className="h-6 w-6 text-emerald-400" /> : <Circle className="h-6 w-6 text-slate-600" />}
              </div>
              <div className="shrink-0 h-10 w-10 rounded-xl bg-slate-800 flex items-center justify-center">
                <Icon className={`h-5 w-5 ${s.done ? "text-emerald-400" : "text-blue-400"}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white text-sm">{i + 1}. {s.title}</p>
                <p className="text-sm text-slate-400 truncate">{s.desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-500 shrink-0" />
            </button>
          );
        })}
      </div>

      {allDone && (
        <div className="mt-6 rounded-2xl bg-blue-600/10 border border-blue-500/20 p-6 flex items-center gap-4 sf-fade-up">
          <Rocket className="h-7 w-7 text-blue-400 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-white">Tout est prêt !</p>
            <p className="text-sm text-slate-400">Vos signatures sont configurées. Gérez le quotidien depuis les autres onglets.</p>
          </div>
          <Button onClick={() => navigate("/app/deploy")} data-testid="setup-go-deploy" className="bg-blue-600 hover:bg-blue-500 text-white font-semibold shrink-0">
            Déployer <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
