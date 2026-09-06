import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Upload, Loader2, ArrowUp, ArrowDown, Trash2, Wand2, Images, PlayCircle } from "lucide-react";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

export default function GifComposer() {
  const [slides, setSlides] = useState([]); // {path, url}
  const [interval, setIntervalMs] = useState(2500);
  const [gifUrl, setGifUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    api.get("/settings").then((r) => {
      const paths = r.data.gif_images || [];
      setSlides(paths.map((p) => ({ path: p, url: `${BACKEND}/api/files/${p}` })));
      setIntervalMs(r.data.gif_interval_ms || 2500);
      if (r.data.gif_url) setGifUrl(r.data.gif_url);
    });
  }, []);

  const uploadSlides = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const { data } = await api.post("/upload", fd);
        setSlides((prev) => [...prev, { path: data.path, url: data.url }]);
      }
      toast.success(`${files.length} image(s) ajoutée(s).`);
    } catch {
      toast.error("Échec du téléversement.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const move = (i, dir) => {
    setSlides((prev) => {
      const arr = [...prev];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return prev;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });
  };

  const remove = (i) => setSlides((prev) => prev.filter((_, idx) => idx !== i));

  const generate = async () => {
    if (!slides.length) { toast.error("Ajoutez au moins une image."); return; }
    setGenerating(true);
    try {
      const { data } = await api.post("/gif/generate", {
        images: slides.map((s) => s.path),
        interval_ms: interval,
      });
      setGifUrl(data.gif_url);
      toast.success(`Bannière animée générée (${data.frames} image(s)). Appliquée à tous les employés.`);
    } catch (e) {
      toast.error("Échec de la génération du GIF.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-5 lg:px-8 py-8">
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-400">Administration</p>
        <h1 className="font-display text-3xl lg:text-4xl font-extrabold text-white mt-1">Composeur GIF</h1>
        <p className="text-slate-400 mt-2">Créez la bannière d'images défilantes intégrée dans Outlook. Toute modification s'applique à tous les employés.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-5 sf-fade-up">
          {/* Upload */}
          <div className="rounded-2xl bg-[#111827] border border-slate-800 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-white">Images du carrousel</h3>
              <span className="text-xs text-slate-500">{slides.length} image(s)</span>
            </div>

            <input id="gif-input" type="file" accept="image/*" multiple className="hidden" onChange={uploadSlides} data-testid="button-upload-gif-slide" />
            <button
              onClick={() => document.getElementById("gif-input").click()}
              disabled={uploading}
              className="w-full border-2 border-dashed border-slate-700 rounded-xl py-8 flex flex-col items-center gap-2 text-slate-400 hover:border-blue-500 hover:text-blue-400 transition-colors"
            >
              {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
              <span className="text-sm font-medium">Cliquez pour téléverser une ou plusieurs images</span>
              <span className="text-xs text-slate-600">Recadrées en bannière 600 × 170 px</span>
            </button>

            <div className="mt-4 space-y-2">
              {slides.map((slide, i) => (
                <div key={slide.path} className="flex items-center gap-3 bg-slate-800/50 border border-slate-700 rounded-xl p-2" data-testid={`gif-slide-${i}`}>
                  <span className="text-xs font-mono text-slate-500 w-5 text-center">{i + 1}</span>
                  <img src={slide.url} alt="" className="h-12 w-24 object-cover rounded-lg" />
                  <div className="flex-1" />
                  <button onClick={() => move(i, -1)} className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30" disabled={i === 0} data-testid={`gif-move-up-${i}`}><ArrowUp className="h-4 w-4" /></button>
                  <button onClick={() => move(i, 1)} className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30" disabled={i === slides.length - 1} data-testid={`gif-move-down-${i}`}><ArrowDown className="h-4 w-4" /></button>
                  <button onClick={() => remove(i)} className="p-1.5 text-slate-400 hover:text-red-400" data-testid={`gif-remove-${i}`}><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              {!slides.length && (
                <div className="text-center py-6 text-slate-600 text-sm flex flex-col items-center gap-2">
                  <Images className="h-8 w-8" /> Aucune image pour l'instant.
                </div>
              )}
            </div>
          </div>

          {/* Interval + generate */}
          <div className="rounded-2xl bg-[#111827] border border-slate-800 p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-white">Vitesse de défilement</h3>
              <span className="text-sm font-mono text-blue-400">{(interval / 1000).toFixed(1)}s / image</span>
            </div>
            <Slider
              value={[interval]}
              min={500}
              max={6000}
              step={250}
              onValueChange={(v) => setIntervalMs(v[0])}
              className="my-5"
              data-testid="slider-gif-interval"
            />
            <div className="flex justify-between text-xs text-slate-600 mb-5">
              <span>Rapide (0.5s)</span><span>Lent (6s)</span>
            </div>
            <Button onClick={generate} disabled={generating || !slides.length} data-testid="button-generate-gif" className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-base">
              {generating ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Wand2 className="h-5 w-5 mr-2" />}
              Générer la bannière animée
            </Button>
          </div>
        </div>

        {/* Preview */}
        <div className="lg:sticky lg:top-8 self-start">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-4">
            <PlayCircle className="h-4 w-4 text-blue-400" />
            <span className="font-medium">Bannière animée générée</span>
          </div>
          <div className="rounded-2xl bg-[#111827] border border-slate-800 p-6">
            {gifUrl ? (
              <div className="bg-white rounded-xl p-4">
                <img src={gifUrl} alt="Bannière animée" className="w-full rounded-lg" data-testid="gif-slider-preview" />
              </div>
            ) : (
              <div className="text-center py-16 text-slate-600 text-sm flex flex-col items-center gap-3" data-testid="gif-slider-preview">
                <Images className="h-10 w-10" />
                Générez la bannière pour voir l'aperçu animé.
              </div>
            )}
            {gifUrl && (
              <div className="mt-4">
                <p className="text-xs text-slate-500 mb-1.5">URL hébergée (stable — se met à jour pour tous) :</p>
                <code className="block text-xs text-blue-300 bg-slate-900 rounded-lg p-2.5 break-all font-mono">{gifUrl}</code>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
