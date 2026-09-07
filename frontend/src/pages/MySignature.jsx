import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { SignaturePreview } from "@/components/SignaturePreview";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Upload, Save, Loader2, Trash2 } from "lucide-react";

export default function MySignature() {
  const { user, refreshUser } = useAuth();
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({ name: "", title: "", phone_ext: "", direct_line: "", department: "", avatar_url: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api.get("/settings").then((r) => setSettings(r.data));
  }, []);

  useEffect(() => {
    if (user)
      setForm({
        name: user.name || "", title: user.title || "", phone_ext: user.phone_ext || "",
        direct_line: user.direct_line || "", department: user.department || "", avatar_url: user.avatar_url || "",
      });
  }, [user]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/auth/me", form);
      await refreshUser();
      toast.success("Vos informations sont enregistrées.");
    } catch (e) {
      toast.error("Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/upload-avatar", fd);
      setForm((f) => ({ ...f, avatar_url: data.url }));
      await refreshUser();
      toast.success("Photo mise à jour.");
    } catch {
      toast.error("Échec du téléversement.");
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    setForm((f) => ({ ...f, avatar_url: "" }));
    try {
      await api.put("/auth/me", { ...form, avatar_url: "" });
      await refreshUser();
      toast.success("Photo retirée.");
    } catch {
      toast.error("Échec du retrait.");
    }
  };

  const previewUser = { ...user, ...form };

  return (
    <div className="max-w-6xl mx-auto px-5 lg:px-8 py-8">
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-400">Espace employé</p>
        <h1 className="font-display text-3xl lg:text-4xl font-extrabold text-white mt-1">Ma signature</h1>
        <p className="text-slate-400 mt-2">Renseignez vos coordonnées. Le logo, la bannière et les mentions sont gérés par l'administrateur.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Form */}
        <div className="space-y-5 sf-fade-up">
          <div className="rounded-2xl bg-[#111827] border border-slate-800 p-6">
            <h3 className="font-semibold text-white mb-5">Vos informations</h3>

            <div className="flex items-center gap-4 mb-6">
              <Avatar className="h-16 w-16 border-2 border-slate-700">
                <AvatarImage src={form.avatar_url} />
                <AvatarFallback className="bg-blue-600 text-white text-lg">
                  {(form.name || "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <input id="avatar-input" type="file" accept="image/*" className="hidden" onChange={uploadAvatar} data-testid="input-upload-avatar" />
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById("avatar-input").click()}
                    disabled={uploading}
                    className="border-slate-700 bg-slate-800/50 text-slate-200 hover:bg-slate-700 hover:text-white"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    Photo (optionnel)
                  </Button>
                  {form.avatar_url && (
                    <Button
                      variant="outline"
                      onClick={removeAvatar}
                      data-testid="button-remove-avatar"
                      className="border-red-900/60 bg-red-950/30 text-red-300 hover:bg-red-900/40 hover:text-red-200"
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Retirer
                    </Button>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1.5">Votre photo s'affichera avec le logo de l'entreprise.</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label className="text-slate-300">Nom complet</Label>
                <Input data-testid="input-employee-name" value={form.name} onChange={set("name")} className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
              </div>
              <div>
                <Label className="text-slate-300">Poste / Titre</Label>
                <Input data-testid="input-employee-title" value={form.title} onChange={set("title")} placeholder="Directeur des ventes" className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
              </div>
              <div>
                <Label className="text-slate-300">Département</Label>
                <Input data-testid="input-employee-department" value={form.department} onChange={set("department")} placeholder="Ventes" className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
              </div>
              <div>
                <Label className="text-slate-300">Poste téléphonique</Label>
                <Input data-testid="input-employee-phone-ext" value={form.phone_ext} onChange={set("phone_ext")} placeholder="204" className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
              </div>
              <div>
                <Label className="text-slate-300">Ligne directe</Label>
                <Input data-testid="input-employee-direct-line" value={form.direct_line} onChange={set("direct_line")} placeholder="514 555-0199" className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-slate-300">Courriel (compte)</Label>
                <Input value={user?.email || ""} disabled className="mt-1.5 bg-slate-800/30 border-slate-700 text-slate-400" />
              </div>
            </div>

            <Button onClick={save} disabled={saving} data-testid="button-save-profile" className="w-full mt-6 h-11 bg-blue-600 hover:bg-blue-500 text-white font-semibold">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Enregistrer mes informations
            </Button>
          </div>
        </div>

        {/* Preview */}
        <div className="lg:sticky lg:top-8 self-start">
          {settings && <SignaturePreview user={previewUser} settings={settings} />}
        </div>
      </div>
    </div>
  );
}
