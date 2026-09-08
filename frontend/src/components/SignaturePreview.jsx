import React, { useState } from "react";
import { toast } from "sonner";
import { Copy, Code2, Download, Monitor, Smartphone, Sun, Moon, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildSignatureHtml } from "@/lib/signature";
import OutlookGuideModal from "@/components/OutlookGuideModal";

export function SignaturePreview({ user, settings }) {
  const [dark, setDark] = useState(false);
  const [device, setDevice] = useState("desktop");
  const [guideOpen, setGuideOpen] = useState(false);
  const html = buildSignatureHtml(user, settings);
  const previewHtml = buildSignatureHtml(user, settings, { preview: true });

  const copyRich = async () => {
    try {
      const blobHtml = new Blob([html], { type: "text/html" });
      const blobText = new Blob([html], { type: "text/plain" });
      await navigator.clipboard.write([
        new window.ClipboardItem({ "text/html": blobHtml, "text/plain": blobText }),
      ]);
      toast.success("Signature copiée ! Collez-la dans Outlook (Ctrl+V).");
    } catch (e) {
      await navigator.clipboard.writeText(html);
      toast.success("Signature copiée (texte HTML).");
    }
  };

  const copySource = async () => {
    await navigator.clipboard.writeText(html);
    toast.success("Code source HTML copié.");
  };

  const downloadFile = () => {
    const full = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
    const blob = new Blob([full], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `signature-${(user?.name || "outlook").replace(/\s+/g, "-").toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Fichier .html téléchargé.");
  };

  return (
    <div className="space-y-4" data-testid="signature-live-preview-container">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 bg-slate-800/60 border border-slate-700 rounded-lg p-0.5">
          <button
            onClick={() => setDevice("desktop")}
            data-testid="preview-device-desktop"
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-colors ${device === "desktop" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
          >
            <Monitor className="h-3.5 w-3.5" /> Bureau
          </button>
          <button
            onClick={() => setDevice("mobile")}
            data-testid="preview-device-mobile"
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-colors ${device === "mobile" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
          >
            <Smartphone className="h-3.5 w-3.5" /> Mobile
          </button>
        </div>
        <button
          onClick={() => setDark((d) => !d)}
          data-testid="preview-theme-toggle"
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 transition-colors"
        >
          {dark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
          {dark ? "Sombre" : "Clair"}
        </button>
      </div>

      {device === "mobile" ? (
        /* Mobile Outlook phone mockup */
        <div className="flex justify-center py-2" data-testid="mobile-preview-frame">
          <div className="w-[330px] rounded-[2.2rem] border-[6px] border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
            <div className="h-6 bg-slate-900 flex items-center justify-center">
              <div className="h-1.5 w-16 rounded-full bg-slate-700" />
            </div>
            <div className="bg-[#0F6CBD] px-3 py-2 flex items-center gap-2">
              <span className="text-white/90 text-[11px] font-semibold">Outlook</span>
            </div>
            <div className={dark ? "bg-[#1b1a19] text-slate-200" : "bg-white text-slate-800"}>
              <div className={`px-3 py-2 text-[10px] border-b ${dark ? "border-slate-700 text-slate-400" : "border-slate-200 text-slate-500"}`}>
                <div className="py-0.5"><b>À</b> client@exemple.com</div>
                <div className="py-0.5"><b>Objet</b> Suivi</div>
              </div>
              <div className="px-3 py-3">
                <p className={`text-[11px] mb-3 ${dark ? "text-slate-300" : "text-slate-600"}`}>Bonjour,<br />Merci de votre temps. Cordialement,</p>
                <div className={`signature-render${dark ? " sf-dark" : ""}`} style={{ zoom: 0.5 }} dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </div>
            </div>
            <div className="h-6 bg-slate-900 flex items-center justify-center">
              <div className="h-1 w-24 rounded-full bg-slate-700" />
            </div>
          </div>
        </div>
      ) : (
        /* Simulated desktop Outlook email window */
        <div className="rounded-xl overflow-hidden border border-slate-700 shadow-2xl">
          <div className="bg-[#0F6CBD] px-4 py-2.5 flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="h-3 w-3 rounded-full bg-white/30" />
              <span className="h-3 w-3 rounded-full bg-white/30" />
              <span className="h-3 w-3 rounded-full bg-white/30" />
            </div>
            <span className="text-white/90 text-xs font-semibold ml-2">Nouveau message — Outlook</span>
          </div>
          <div className={dark ? "bg-[#1b1a19] text-slate-200" : "bg-white text-slate-800"}>
            <div className={`px-5 py-2.5 text-xs border-b ${dark ? "border-slate-700 text-slate-400" : "border-slate-200 text-slate-500"}`}>
              <div className="py-0.5"><span className="inline-block w-12 font-semibold">À</span> client@exemple.com</div>
              <div className="py-0.5"><span className="inline-block w-12 font-semibold">Objet</span> Suivi de notre conversation</div>
            </div>
            <div className="px-5 py-5">
              <p className={`text-sm mb-6 ${dark ? "text-slate-300" : "text-slate-600"}`}>
                Bonjour,<br />Merci de votre temps aujourd'hui. Cordialement,
              </p>
              <div className={`signature-render${dark ? " sf-dark" : ""}`} dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <Button
          onClick={copyRich}
          data-testid="button-copy-html-signature"
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold col-span-2 h-11"
        >
          <Copy className="h-4 w-4 mr-2" /> Copier la signature
        </Button>
        <Button
          onClick={copySource}
          data-testid="button-copy-source-code"
          variant="outline"
          className="border-slate-700 bg-slate-800/50 text-slate-200 hover:bg-slate-700 hover:text-white"
        >
          <Code2 className="h-4 w-4 mr-2" /> Code source
        </Button>
        <Button
          onClick={downloadFile}
          data-testid="button-download-signature-file"
          variant="outline"
          className="border-slate-700 bg-slate-800/50 text-slate-200 hover:bg-slate-700 hover:text-white"
        >
          <Download className="h-4 w-4 mr-2" /> Fichier .html
        </Button>
        <button
          onClick={() => setGuideOpen(true)}
          data-testid="button-open-outlook-guide"
          className="col-span-2 flex items-center justify-center gap-2 text-sm text-blue-400 hover:text-blue-300 py-2 transition-colors"
        >
          <HelpCircle className="h-4 w-4" /> Comment l'installer dans Outlook ?
        </button>
      </div>

      <OutlookGuideModal open={guideOpen} onOpenChange={setGuideOpen} />
    </div>
  );
}

export default SignaturePreview;
