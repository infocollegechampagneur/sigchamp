import React, { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Upload, Loader2, ArrowUp, ArrowDown, Trash2, Wand2, Images, PlayCircle, Plus, Building2, Star } from "lucide-react";

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const urlFor = (p) => `${BACKEND}/api/files/${p}`;

export default function GifComposer() {
  const [banners, setBanners] = useState([]); // {key,id,name,slides,interval,gif_url,banner_link}
  const [selectedKey, setSelectedKey] = useState("default");
  const [newDept, setNewDept] = useState("");
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const buildFromSettings = useCallback((d) => {
    const def = {
      key: "default", id: null, name: "Bannière par défaut",
      slides: (d.gif_images || []).map((p) => ({ path: p, url: urlFor(p) })),
      interval: d.gif_interval_ms || 2500, gif_url: d.gif_url || "", banner_link: d.banner_link || "",
      layout: d.signature_layout || "classic",
    };
    const depts = (d.department_banners || []).map((b) => ({
      key: b.id, id: b.id, name: b.name,
      slides: (b.gif_images || []).map((p) => ({ path: p, url: urlFor(p) })),
      interval: b.gif_interval_ms || 2500, gif_url: b.gif_url || "", banner_link: b.banner_link || "",
      layout: b.layout || d.signature_layout || "classic",
    }));
    return [def, ...depts];
  }, []);

  const load = useCallback(() => {
    api.get("/settings").then((r) => setBanners(buildFromSettings(r.data)));
  }, [buildFromSettings]);

  useEffect(() => { load(); }, [load]);

  const current = banners.find((b) => b.key === selectedKey) || banners[0];

  const patch = (fields) =>
    setBanners((prev) => prev.map((b) => (b.key === selectedKey ? { ...b, ...fields } : b)));

  const uploadSlides = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const added = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const { data } = await api.post("/upload", fd);
        added.push({ path: data.path, url: data.url });
      }
      patch({ slides: [...(current.slides || []), ...added] });
      toast.success(`${files.length} image(s) ajoutée(s).`);
    } catch {
      toast.error("Échec du téléversement.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const move = (i, dir) => {
    const arr = [...current.slides];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    patch({ slides: arr });
  };
  const remove = (i) => patch({ slides: current.slides.filter((_, idx) => idx !== i) });

  const addDept = async () => {
    if (!newDept.trim()) return;
    try {
      const { data } = await api.post("/departments", { name: newDept.trim() });
      setNewDept("");
      await load();
      setSelectedKey(data.id);
      toast.success(`Département « ${data.name} » ajouté.`);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const deleteDept = async (id) => {
    try {
      await api.delete(`/departments/${id}`);
      if (selectedKey === id) setSelectedKey("default");
      await load();
      toast.success("Département supprimé.");
    } catch {
      toast.error("Échec de la suppression.");
    }
  };

  const generate = async () => {
    if (!current.slides?.length) { toast.error("Ajoutez au moins une image."); return; }
    setGenerating(true);
    try {
      const { data } = await api.post("/gif/generate", {
        images: current.slides.map((s) => s.path),
        interval_ms: current.interval,
        department_id: current.id,
        banner_link: current.banner_link,
        layout: current.layout,
      });
      patch({ gif_url: data.gif_url });
      toast.success(`Bannière « ${current.name} » générée (${data.frames} image(s)). Appliquée à tous.`);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Échec de la génération.");
    } finally {
      setGenerating(false);
    }
  };

  if (!current) return <div className="p-8 text-slate-400">Chargement…</div>;

  return (
    <div className="max-w-6xl mx-auto px-5 lg:px-8 py-8">
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-400">Administration</p>
        <h1 className="font-display text-3xl lg:text-4xl font-extrabold text-white mt-1">Bannières & GIF</h1>
        <p className="text-slate-400 mt-2">Créez la bannière d'images défilantes. Définissez une bannière par défaut, ou une bannière propre à chaque département.</p>
      </div>

      {/* Banner selector */}
      <div className="flex flex-wrap gap-2 mb-6" data-testid="banner-selector">
        {banners.map((b) => (
          <button
            key={b.key}
            onClick={() => setSelectedKey(b.key)}
            data-testid={`banner-tab-${b.key}`}
            className={`group flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
              selectedKey === b.key
                ? "bg-blue-600 border-blue-500 text-white"
                : "bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-800"
            }`}
          >
            {b.id === null ? <Star className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
            {b.name}
            {b.gif_url && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" title="Générée" />}
            {b.id !== null && (
              <span
                onClick={(e) => { e.stopPropagation(); deleteDept(b.id); }}
                data-testid={`banner-delete-${b.id}`}
                className="ml-1 opacity-50 hover:opacity-100 hover:text-red-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </span>
            )}
          </button>
        ))}
        <div className="flex items-center gap-2">
          <Input
            value={newDept}
            onChange={(e) => setNewDept(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addDept()}
            placeholder="Nom du département"
            data-testid="input-new-department"
            className="h-9 w-44 bg-slate-800/60 border-slate-700 text-white text-sm"
          />
          <Button onClick={addDept} data-testid="button-add-department" size="sm" variant="outline" className="h-9 border-slate-700 bg-slate-800/50 text-slate-200 hover:bg-slate-700 hover:text-white">
            <Plus className="h-4 w-4 mr-1" /> Département
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-5 sf-fade-up" key={selectedKey}>
          {/* Upload */}
          <div className="rounded-2xl bg-[#111827] border border-slate-800 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-white">Images — {current.name}</h3>
              <span className="text-xs text-slate-500">{current.slides?.length || 0} image(s)</span>
            </div>

            <input id="gif-input" type="file" accept="image/*" multiple className="hidden" onChange={uploadSlides} data-testid="button-upload-gif-slide" />
            <button
              onClick={() => document.getElementById("gif-input").click()}
              disabled={uploading}
              className="w-full border-2 border-dashed border-slate-700 rounded-xl py-8 flex flex-col items-center gap-2 text-slate-400 hover:border-blue-500 hover:text-blue-400 transition-colors"
            >
              {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
              <span className="text-sm font-medium">Téléverser une ou plusieurs images</span>
              <span className="text-xs text-slate-600">Recadrées en bannière 600 × 170 px</span>
            </button>

            <div className="mt-4 space-y-2">
              {(current.slides || []).map((slide, i) => (
                <div key={slide.path} className="flex items-center gap-3 bg-slate-800/50 border border-slate-700 rounded-xl p-2" data-testid={`gif-slide-${i}`}>
                  <span className="text-xs font-mono text-slate-500 w-5 text-center">{i + 1}</span>
                  <img src={slide.url} alt="" className="h-12 w-24 object-cover rounded-lg" />
                  <div className="flex-1" />
                  <button onClick={() => move(i, -1)} className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30" disabled={i === 0} data-testid={`gif-move-up-${i}`}><ArrowUp className="h-4 w-4" /></button>
                  <button onClick={() => move(i, 1)} className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30" disabled={i === current.slides.length - 1} data-testid={`gif-move-down-${i}`}><ArrowDown className="h-4 w-4" /></button>
                  <button onClick={() => remove(i)} className="p-1.5 text-slate-400 hover:text-red-400" data-testid={`gif-remove-${i}`}><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              {!(current.slides || []).length && (
                <div className="text-center py-6 text-slate-600 text-sm flex flex-col items-center gap-2">
                  <Images className="h-8 w-8" /> Aucune image pour l'instant.
                </div>
              )}
            </div>
          </div>

          {/* Interval + link + generate */}
          <div className="rounded-2xl bg-[#111827] border border-slate-800 p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-white">Vitesse de défilement</h3>
              <span className="text-sm font-mono text-blue-400">{((current.interval || 2500) / 1000).toFixed(1)}s / image</span>
            </div>
            <Slider
              value={[current.interval || 2500]}
              min={500} max={6000} step={250}
              onValueChange={(v) => patch({ interval: v[0] })}
              className="my-5" data-testid="slider-gif-interval"
            />
            <div className="flex justify-between text-xs text-slate-600 mb-5"><span>Rapide (0.5s)</span><span>Lent (6s)</span></div>

            <Label className="text-slate-300">Lien cliquable de la bannière</Label>
            <Input
              value={current.banner_link || ""}
              onChange={(e) => patch({ banner_link: e.target.value })}
              placeholder="https://entreprise.com/promo"
              data-testid="input-banner-link"
              className="mt-1.5 mb-4 bg-slate-800/60 border-slate-700 text-white"
            />

            <Label className="text-slate-300">Mise en page de cette bannière</Label>
            <select
              value={current.layout || "classic"}
              onChange={(e) => patch({ layout: e.target.value })}
              data-testid="select-banner-layout"
              className="mt-1.5 mb-5 w-full h-10 rounded-md bg-slate-800/60 border border-slate-700 text-white px-3 text-sm"
            >
              <option value="classic">Classique</option>
              <option value="modern">Moderne</option>
            </select>

            <Button onClick={generate} disabled={generating || !current.slides?.length} data-testid="button-generate-gif" className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-base">
              {generating ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Wand2 className="h-5 w-5 mr-2" />}
              Générer la bannière animée
            </Button>
          </div>
        </div>

        {/* Preview */}
        <div className="lg:sticky lg:top-8 self-start">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-4">
            <PlayCircle className="h-4 w-4 text-blue-400" />
            <span className="font-medium">Bannière animée — {current.name}</span>
          </div>
          <div className="rounded-2xl bg-[#111827] border border-slate-800 p-6">
            {current.gif_url ? (
              <div className="bg-white rounded-xl p-4">
                <img src={current.gif_url} alt="Bannière animée" className="w-full rounded-lg" data-testid="gif-slider-preview" />
              </div>
            ) : (
              <div className="text-center py-16 text-slate-600 text-sm flex flex-col items-center gap-3" data-testid="gif-slider-preview">
                <Images className="h-10 w-10" /> Générez la bannière pour voir l'aperçu animé.
              </div>
            )}
            {current.gif_url && (
              <div className="mt-4">
                <p className="text-xs text-slate-500 mb-1.5">URL hébergée (stable — se met à jour pour tous) :</p>
                <code className="block text-xs text-blue-300 bg-slate-900 rounded-lg p-2.5 break-all font-mono">{current.gif_url}</code>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-4">
            Les employés dont le champ « Département » correspond au nom d'une bannière reçoivent
            automatiquement celle-ci ; sinon la bannière par défaut s'applique.
          </p>
        </div>
      </div>
    </div>
  );
}
