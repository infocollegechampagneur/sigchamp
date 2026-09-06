import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Copy, Settings2, ClipboardPaste, CheckCircle2 } from "lucide-react";

const STEPS = [
  {
    icon: Copy,
    title: "1. Copiez la signature",
    text: "Cliquez sur « Copier la signature » pour la placer dans votre presse-papiers (format enrichi).",
  },
  {
    icon: Settings2,
    title: "2. Ouvrez les paramètres Outlook",
    text: "Dans Outlook : Fichier → Options → Courrier → Signatures. Sur le Web : ⚙️ Paramètres → Courrier → Composer et répondre.",
  },
  {
    icon: ClipboardPaste,
    title: "3. Collez la signature",
    text: "Créez une nouvelle signature, cliquez dans la zone d'édition et collez avec Ctrl+V (Cmd+V sur Mac).",
  },
  {
    icon: CheckCircle2,
    title: "4. Enregistrez",
    text: "Choisissez cette signature par défaut pour vos nouveaux messages et vos réponses, puis enregistrez.",
  },
];

export default function OutlookGuideModal({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#111827] border-slate-700 text-slate-100 max-w-lg"
        data-testid="outlook-guide-modal"
      >
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Installer dans Outlook</DialogTitle>
          <DialogDescription className="text-slate-400">Suivez ces 4 étapes pour ajouter votre signature.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="flex gap-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700/70">
                <div className="shrink-0 h-9 w-9 rounded-lg bg-blue-600/20 flex items-center justify-center">
                  <Icon className="h-4.5 w-4.5 text-blue-400" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-white">{s.title}</p>
                  <p className="text-sm text-slate-400 mt-0.5">{s.text}</p>
                </div>
              </div>
            );
          })}
          <p className="text-xs text-slate-500 pt-1">
            💡 Astuce : les images (logo, bannière animée) sont hébergées en ligne. Si l'administrateur
            les met à jour, elles se mettront à jour dans la signature de tous les employés.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
