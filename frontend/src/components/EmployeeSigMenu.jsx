import React, { useState } from "react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/apiClient";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Copy, Code2, Download, Link2, ExternalLink, UserRound, Loader2 } from "lucide-react";

async function copyRich(html) {
  try {
    await navigator.clipboard.write([new window.ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([html], { type: "text/plain" }),
    })]);
  } catch {
    await navigator.clipboard.writeText(html);
  }
}

export function EmployeeSigMenu({ emp }) {
  const [loading, setLoading] = useState(false);

  const run = (fn) => async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/employees/${emp.id}/signature`);
      await fn(data);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  const download = (d) => {
    const full = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${d.html}</body></html>`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([full], { type: "text/html" }));
    a.download = d.filename;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Fichier .html téléchargé.");
  };

  const item = "text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button data-testid={`button-sig-menu-${emp.id}`} title="Signature : copier, lien, télécharger" className="p-2 text-slate-400 hover:text-blue-400 transition-colors">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-[#111827] border-slate-700 w-64" data-testid={`sig-menu-${emp.id}`}>
        <DropdownMenuLabel className="text-slate-400 text-xs">Signature de {emp.name || emp.email}</DropdownMenuLabel>
        <DropdownMenuItem className={item} data-testid={`sig-copy-${emp.id}`} onClick={run(async (d) => { await copyRich(d.html); toast.success("Signature copiée ! Collez-la dans Outlook (Ctrl+V)."); })}>
          <Copy className="h-4 w-4 mr-2" /> Copier la signature
        </DropdownMenuItem>
        <DropdownMenuItem className={item} data-testid={`sig-source-${emp.id}`} onClick={run(async (d) => { await navigator.clipboard.writeText(d.html); toast.success("Code source HTML copié."); })}>
          <Code2 className="h-4 w-4 mr-2" /> Copier le code source
        </DropdownMenuItem>
        <DropdownMenuItem className={item} data-testid={`sig-download-${emp.id}`} onClick={run(download)}>
          <Download className="h-4 w-4 mr-2" /> Télécharger .html
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-slate-800" />
        <DropdownMenuItem className={item} data-testid={`sig-public-link-${emp.id}`} onClick={run(async (d) => { await navigator.clipboard.writeText(d.public_url); toast.success("Lien public copié (aucune connexion requise)."); })}>
          <Link2 className="h-4 w-4 mr-2" /> Copier le lien public
        </DropdownMenuItem>
        <DropdownMenuItem className={item} data-testid={`sig-open-public-${emp.id}`} onClick={run(async (d) => { window.open(d.public_url, "_blank", "noopener"); })}>
          <ExternalLink className="h-4 w-4 mr-2" /> Ouvrir la page publique
        </DropdownMenuItem>
        <DropdownMenuItem className={item} data-testid={`sig-app-link-${emp.id}`} onClick={run(async (d) => { await navigator.clipboard.writeText(d.app_url); toast.success("Lien de l'espace employé copié (connexion requise)."); })}>
          <UserRound className="h-4 w-4 mr-2" /> Copier le lien « Ma signature »
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
