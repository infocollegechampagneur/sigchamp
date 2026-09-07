import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { SignaturePreview } from "@/components/SignaturePreview";
import { RichTextEditor } from "@/components/RichTextEditor";
import { DEFAULT_DISCLAIMER, buildSignatureHtml } from "@/lib/signature";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Upload, Save, Loader2, Linkedin, Twitter, Facebook, Instagram, Youtube, Music2 } from "lucide-react";

const SAMPLE_EMPLOYEE = {
  name: "Sophie Roy", title: "Responsable Marketing", department: "Marketing",
  email: "sophie.roy@entreprise.com", phone_ext: "212", direct_line: "514 555-0143", avatar_url: "",
};

export default function BrandAssets() {
  const { user } = useAuth();
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [rteRev, setRteRev] = useState(0);

  useEffect(() => { api.get("/settings").then((r) => setS(r.data)); }, []);

  const set = (k) => (e) => setS((prev) => ({ ...prev, [k]: e.target.value }));
  const setSocial = (k) => (e) => setS((prev) => ({ ...prev, social: { ...prev.social, [k]: e.target.value } }));

  const uploadLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/upload", fd);
      setS((prev) => ({ ...prev, logo_url: data.url }));
      toast.success("Logo téléversé.");
    } catch {
      toast.error("Échec du téléversement.");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put("/settings", s);
      setS(data);
      toast.success("Charte graphique enregistrée pour toute l'entreprise.");
    } catch {
      toast.error("Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  if (!s) return <div className="p-8 text-slate-400">Chargement…</div>;

  const socials = [
    { key: "linkedin", icon: Linkedin, ph: "linkedin.com/company/…" },
    { key: "twitter", icon: Twitter, ph: "x.com/…" },
    { key: "facebook", icon: Facebook, ph: "facebook.com/…" },
    { key: "instagram", icon: Instagram, ph: "instagram.com/…" },
    { key: "youtube", icon: Youtube, ph: "youtube.com/@…" },
    { key: "tiktok", icon: Music2, ph: "tiktok.com/@…" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-5 lg:px-8 py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-blue-400">Administration</p>
          <h1 className="font-display text-3xl lg:text-4xl font-extrabold text-white mt-1">Charte graphique</h1>
          <p className="text-slate-400 mt-2">Éléments partagés appliqués à la signature de tous les employés.</p>
        </div>
        <Button onClick={save} disabled={saving} data-testid="button-save-brand-assets" className="h-11 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Enregistrer pour tous
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-5 sf-fade-up">
          {/* Company + logo */}
          <div className="rounded-2xl bg-[#111827] border border-slate-800 p-6">
            <h3 className="font-semibold text-white mb-5">Entreprise & logo</h3>
            <div className="flex items-center gap-4 mb-5">
              <div className="h-16 w-16 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center">
                {s.logo_url ? <img src={s.logo_url} alt="logo" className="h-full w-full object-cover" /> : <span className="text-slate-600 text-xs">Logo</span>}
              </div>
              <div>
                <input id="logo-input" type="file" accept="image/*" className="hidden" onChange={uploadLogo} data-testid="button-upload-logo" />
                <Button variant="outline" onClick={() => document.getElementById("logo-input").click()} disabled={uploading} className="border-slate-700 bg-slate-800/50 text-slate-200 hover:bg-slate-700 hover:text-white">
                  {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />} Téléverser le logo
                </Button>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Nom de l'entreprise</Label>
                <Input data-testid="input-company-name" value={s.company_name} onChange={set("company_name")} className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
              </div>
              <div>
                <Label className="text-slate-300">Site web</Label>
                <Input data-testid="input-company-website" value={s.website} onChange={set("website")} placeholder="entreprise.com" className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
              </div>
              <div>
                <Label className="text-slate-300">Téléphone principal</Label>
                <Input data-testid="input-company-phone" value={s.phone_main} onChange={set("phone_main")} placeholder="514 555-0100" className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
              </div>
              <div>
                <Label className="text-slate-300">Couleur d'accent</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <input type="color" value={s.primary_color} onChange={set("primary_color")} data-testid="input-primary-color" className="h-10 w-14 rounded-lg bg-slate-800/60 border border-slate-700 cursor-pointer" />
                  <Input value={s.primary_color} onChange={set("primary_color")} className="bg-slate-800/60 border-slate-700 text-white font-mono" />
                </div>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              <div>
                <div className="flex justify-between"><Label className="text-slate-300">Taille du logo</Label><span className="text-xs font-mono text-blue-400">{s.logo_width || 86}px</span></div>
                <Slider value={[s.logo_width || 86]} min={40} max={160} step={2} onValueChange={(v) => setS((p) => ({ ...p, logo_width: v[0] }))} className="mt-3" data-testid="slider-logo-width" />
              </div>
              <div>
                <div className="flex justify-between"><Label className="text-slate-300">Largeur de la bannière</Label><span className="text-xs font-mono text-blue-400">{s.banner_width || 600}px</span></div>
                <Slider value={[s.banner_width || 600]} min={200} max={600} step={10} onValueChange={(v) => setS((p) => ({ ...p, banner_width: v[0] }))} className="mt-3" data-testid="slider-banner-width" />
              </div>
            </div>
            <div className="mt-4">
              <Label className="text-slate-300">Mise en page de la signature (par défaut)</Label>
              <select
                data-testid="select-signature-layout"
                value={s.signature_layout || "classic"}
                onChange={set("signature_layout")}
                className="mt-1.5 w-full h-10 rounded-md bg-slate-800/60 border border-slate-700 text-white px-3 text-sm"
              >
                <option value="classic">Classique — logo à gauche, filet coloré</option>
                <option value="modern">Moderne — bloc à bordure, coordonnées en ligne</option>
              </select>
              <p className="text-xs text-slate-500 mt-1.5">Chaque département peut avoir sa propre mise en page dans « Bannières &amp; GIF ».</p>

              {/* Aperçu comparatif Classique vs Moderne */}
              <div className="grid sm:grid-cols-2 gap-3 mt-4" data-testid="layout-compare">
                {[{ id: "classic", label: "Classique" }, { id: "modern", label: "Moderne" }].map((opt) => {
                  const active = (s.signature_layout || "classic") === opt.id;
                  const previewHtml = buildSignatureHtml(SAMPLE_EMPLOYEE, { ...s, signature_layout: opt.id, department_banners: [] });
                  return (
                    <div key={opt.id} className={`rounded-xl border overflow-hidden ${active ? "border-blue-500 ring-1 ring-blue-500/40" : "border-slate-700"}`} data-testid={`layout-card-${opt.id}`}>
                      <div className={`flex items-center justify-between px-3 py-2 text-xs font-semibold ${active ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"}`}>
                        <span>{opt.label}</span>
                        {active ? <span className="text-[10px]">Sélectionné</span> : (
                          <button onClick={() => setS((p) => ({ ...p, signature_layout: opt.id }))} data-testid={`choose-layout-${opt.id}`} className="text-[10px] underline hover:no-underline">Choisir</button>
                        )}
                      </div>
                      <div className="bg-white p-2 overflow-hidden" style={{ height: 150 }}>
                        <div style={{ zoom: 0.42 }} dangerouslySetInnerHTML={{ __html: previewHtml }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-4">
              <Label className="text-slate-300">Adresse de l'entreprise</Label>
              <Input data-testid="input-company-address" value={s.address} onChange={set("address")} placeholder="123 rue Principale, Montréal, QC H2X 1Y6" className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
            </div>
          </div>

          {/* Social */}
          <div className="rounded-2xl bg-[#111827] border border-slate-800 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-white">Réseaux sociaux</h3>
              <div className="flex items-center gap-1 bg-slate-800/60 border border-slate-700 rounded-lg p-0.5" data-testid="social-style-toggle">
                <button
                  onClick={() => setS((p) => ({ ...p, social_style: "icons" }))}
                  data-testid="social-style-icons"
                  className={`text-xs px-3 py-1.5 rounded-md transition-colors ${(s.social_style || "icons") === "icons" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
                >
                  Logos
                </button>
                <button
                  onClick={() => setS((p) => ({ ...p, social_style: "names" }))}
                  data-testid="social-style-names"
                  className={`text-xs px-3 py-1.5 rounded-md transition-colors ${(s.social_style || "icons") === "names" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
                >
                  Noms
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {socials.map(({ key, icon: Icon, ph }) => (
                <div key={key} className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-slate-400 shrink-0" />
                  <Input data-testid={`input-social-${key}`} value={s.social?.[key] || ""} onChange={setSocial(key)} placeholder={ph} className="bg-slate-800/60 border-slate-700 text-white" />
                </div>
              ))}
            </div>
          </div>

          {/* Promo banner link + disclaimer */}
          <div className="rounded-2xl bg-[#111827] border border-slate-800 p-6">
            <h3 className="font-semibold text-white mb-5">Bannière & mention légale</h3>
            <div>
              <Label className="text-slate-300">Lien de la bannière cliquable</Label>
              <Input data-testid="input-promo-banner-url" value={s.banner_link} onChange={set("banner_link")} placeholder="https://entreprise.com/promo" className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
              <p className="text-xs text-slate-500 mt-1.5">La bannière animée (GIF) se configure dans « Composeur GIF ».</p>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <Label className="text-slate-300">Mention de confidentialité</Label>
                <button onClick={() => { setS((p) => ({ ...p, disclaimer: DEFAULT_DISCLAIMER })); setRteRev((r) => r + 1); }} className="text-xs text-blue-400 hover:text-blue-300">Insérer le modèle</button>
              </div>
              <RichTextEditor
                value={s.disclaimer}
                revision={rteRev}
                onChange={(html) => setS((p) => ({ ...p, disclaimer: html }))}
                testId="input-disclaimer-text"
              />
              <p className="text-xs text-slate-500 mt-1.5">Utilisez <b>gras</b>, <i>italique</i>, souligné et sauts de ligne pour la mise en forme.</p>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="lg:sticky lg:top-8 self-start">
          <SignaturePreview user={SAMPLE_EMPLOYEE} settings={s} />
        </div>
      </div>
    </div>
  );
}
