import React, { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { MousePointerClick, BarChart3, Users, Image as ImageIcon, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Analytics() {
  const [data, setData] = useState(null);

  const load = () => api.get("/analytics/clicks").then((r) => setData(r.data));
  useEffect(() => { load(); }, []);

  const maxBanner = Math.max(1, ...(data?.by_banner || []).map((b) => b.count));
  const maxEmp = Math.max(1, ...(data?.by_employee || []).map((b) => b.count));

  return (
    <div className="max-w-6xl mx-auto px-5 lg:px-8 py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-blue-400">Administration</p>
          <h1 className="font-display text-3xl lg:text-4xl font-extrabold text-white mt-1">Statistiques des clics</h1>
          <p className="text-slate-400 mt-2">Nombre de clics sur les bannières promo depuis les signatures.</p>
        </div>
        <Button onClick={load} data-testid="button-refresh-analytics" variant="outline" className="border-slate-700 bg-slate-800/50 text-slate-200 hover:bg-slate-700 hover:text-white">
          <RefreshCw className="h-4 w-4 mr-2" /> Rafraîchir
        </Button>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-6 mb-8 sf-fade-up" data-testid="total-clicks-card">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center"><MousePointerClick className="h-6 w-6 text-white" /></div>
          <div>
            <p className="text-blue-100 text-sm font-medium">Clics totaux</p>
            <p className="text-white font-display text-4xl font-extrabold">{data?.total ?? "…"}</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* By banner */}
        <div className="rounded-2xl bg-[#111827] border border-slate-800 p-6 sf-fade-up">
          <div className="flex items-center gap-2 mb-5"><BarChart3 className="h-5 w-5 text-blue-400" /><h3 className="font-semibold text-white">Par bannière (total)</h3></div>
          <div className="space-y-4">
            {(data?.by_banner || []).map((b) => (
              <div key={b.banner} data-testid={`banner-stat-${b.banner}`}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-300 flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5 text-slate-500" />{b.banner}</span>
                  <span className="text-white font-mono font-semibold">{b.count}</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${(b.count / maxBanner) * 100}%` }} />
                </div>
              </div>
            ))}
            {!(data?.by_banner || []).length && <p className="text-slate-600 text-sm text-center py-8">Aucun clic enregistré pour l'instant.</p>}
          </div>
        </div>

        {/* By employee */}
        <div className="rounded-2xl bg-[#111827] border border-slate-800 p-6 sf-fade-up">
          <div className="flex items-center gap-2 mb-5"><Users className="h-5 w-5 text-blue-400" /><h3 className="font-semibold text-white">Par employé (détail)</h3></div>
          <div className="space-y-4">
            {(data?.by_employee || []).map((e) => (
              <div key={e.user_id} data-testid={`employee-stat-${e.user_id}`}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-300">{e.name}</span>
                  <span className="text-white font-mono font-semibold">{e.count}</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(e.count / maxEmp) * 100}%` }} />
                </div>
              </div>
            ))}
            {!(data?.by_employee || []).length && <p className="text-slate-600 text-sm text-center py-8">Aucun clic par employé pour l'instant.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
