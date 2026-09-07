import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { UserPlus, Trash2, Loader2, ShieldCheck, Upload, Download, FileUp, Pencil } from "lucide-react";

const empty = { email: "", password: "", name: "", title: "", phone_ext: "", direct_line: "", department: "" };
const emptyEdit = { name: "", title: "", department: "", phone_ext: "", direct_line: "", booking_url: "" };

export default function Employees() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(emptyEdit);
  const [editId, setEditId] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editSig, setEditSig] = useState("");

  const load = () => api.get("/employees").then((r) => setList(r.data));
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setEdit = (k) => (e) => setEditForm((f) => ({ ...f, [k]: e.target.value }));

  const openEdit = (emp) => {
    setEditId(emp.id);
    setEditForm({
      name: emp.name || "", title: emp.title || "", department: emp.department || "",
      phone_ext: emp.phone_ext || "", direct_line: emp.direct_line || "", booking_url: emp.booking_url || "",
    });
    setEditSig(emp.m365_signature_html || "");
    setEditOpen(true);
  };

  const saveEdit = async () => {
    setSavingEdit(true);
    try {
      await api.put(`/employees/${editId}`, editForm);
      toast.success("Fiche mise à jour.");
      setEditOpen(false);
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setSavingEdit(false);
    }
  };

  const downloadTemplate = () => {
    const csv = "name,email,password,title,department,phone_ext,direct_line\nMarie Tremblay,marie@entreprise.com,,Directrice,Direction,201,514 555-0101\nPaul Roy,paul@entreprise.com,,Vendeur,Ventes,202,\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "modele-employes.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const doImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setResult(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/employees/import", fd);
      setResult(data);
      toast.success(`${data.created_count} créé(s), ${data.skipped_count} ignoré(s), ${data.errors.length} erreur(s).`);
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const copyCredentials = () => {
    const lines = ["email,password", ...result.created.map((c) => `${c.email},${c.password}`)].join("\n");
    navigator.clipboard.writeText(lines);
    toast.success("Identifiants copiés (email,mot de passe).");
  };

  const create = async () => {
    setError("");
    setSaving(true);
    try {
      await api.post("/employees", form);
      toast.success("Employé créé.");
      setOpen(false);
      setForm(empty);
      load();
    } catch (e) {
      setError(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/employees/${id}`);
      toast.success("Employé supprimé.");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-5 lg:px-8 py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-blue-400">Administration</p>
          <h1 className="font-display text-3xl lg:text-4xl font-extrabold text-white mt-1">Employés</h1>
          <p className="text-slate-400 mt-2">Créez des comptes. Chaque employé gère ensuite ses coordonnées.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) setResult(null); }}>
            <DialogTrigger asChild>
              <Button data-testid="button-import-employees" variant="outline" className="h-11 border-slate-700 bg-slate-800/50 text-slate-200 hover:bg-slate-700 hover:text-white font-semibold px-5">
                <FileUp className="h-4 w-4 mr-2" /> Importer
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#111827] border-slate-700 text-slate-100 max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">Importer des employés</DialogTitle>
                <DialogDescription className="text-slate-400">Fichier CSV ou Excel (.xlsx). Colonnes : name, email, password (optionnel), title, department, phone_ext, direct_line.</DialogDescription>
              </DialogHeader>
              <div className="mt-2 space-y-4">
                <button onClick={downloadTemplate} data-testid="button-download-template" className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300">
                  <Download className="h-4 w-4" /> Télécharger le modèle CSV
                </button>
                <input id="import-input" type="file" accept=".csv,.xlsx,.xlsm" className="hidden" onChange={doImport} data-testid="input-import-file" />
                <button
                  onClick={() => document.getElementById("import-input").click()}
                  disabled={importing}
                  className="w-full border-2 border-dashed border-slate-700 rounded-xl py-8 flex flex-col items-center gap-2 text-slate-400 hover:border-blue-500 hover:text-blue-400 transition-colors"
                >
                  {importing ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
                  <span className="text-sm font-medium">Cliquez pour choisir un fichier CSV / Excel</span>
                  <span className="text-xs text-slate-600">Les mots de passe vides sont générés automatiquement</span>
                </button>

                {result && (
                  <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-4" data-testid="import-result">
                    <div className="flex gap-4 text-sm mb-3">
                      <span className="text-emerald-400">{result.created_count} créé(s)</span>
                      <span className="text-slate-400">{result.skipped_count} ignoré(s)</span>
                      <span className="text-red-400">{result.errors.length} erreur(s)</span>
                    </div>
                    {result.created.length > 0 && (
                      <>
                        <div className="max-h-40 overflow-y-auto space-y-1 mb-3">
                          {result.created.map((c) => (
                            <div key={c.email} className="flex justify-between text-xs font-mono">
                              <span className="text-slate-300 truncate">{c.email}</span>
                              <span className="text-blue-300 ml-2">{c.password}</span>
                            </div>
                          ))}
                        </div>
                        <Button onClick={copyCredentials} data-testid="button-copy-credentials" size="sm" variant="outline" className="border-slate-700 bg-slate-800/50 text-slate-200 hover:bg-slate-700 hover:text-white">
                          <Download className="h-4 w-4 mr-2" /> Copier les identifiants
                        </Button>
                      </>
                    )}
                    {result.errors.length > 0 && (
                      <div className="mt-3 text-xs text-red-400/80 space-y-0.5">
                        {result.errors.slice(0, 8).map((er, i) => <div key={i}>Ligne {er.row} : {er.error}</div>)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-employee" className="h-11 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6">
                <UserPlus className="h-4 w-4 mr-2" /> Nouvel employé
              </Button>
            </DialogTrigger>
          <DialogContent className="bg-[#111827] border-slate-700 text-slate-100 max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Nouvel employé</DialogTitle>
              <DialogDescription className="text-slate-400">Créez un compte. L'employé pourra ensuite gérer ses coordonnées.</DialogDescription>
            </DialogHeader>
            <div className="grid sm:grid-cols-2 gap-4 mt-2">
              <div className="sm:col-span-2">
                <Label className="text-slate-300">Nom complet</Label>
                <Input data-testid="new-emp-name" value={form.name} onChange={set("name")} className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
              </div>
              <div>
                <Label className="text-slate-300">Courriel</Label>
                <Input data-testid="new-emp-email" type="email" value={form.email} onChange={set("email")} className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
              </div>
              <div>
                <Label className="text-slate-300">Mot de passe</Label>
                <Input data-testid="new-emp-password" type="text" value={form.password} onChange={set("password")} className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
              </div>
              <div>
                <Label className="text-slate-300">Poste / Titre</Label>
                <Input data-testid="new-emp-title" value={form.title} onChange={set("title")} className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
              </div>
              <div>
                <Label className="text-slate-300">Département</Label>
                <Input data-testid="new-emp-department" value={form.department} onChange={set("department")} className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
              </div>
              <div>
                <Label className="text-slate-300">Poste téléphonique</Label>
                <Input data-testid="new-emp-ext" value={form.phone_ext} onChange={set("phone_ext")} className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
              </div>
              <div>
                <Label className="text-slate-300">Ligne directe</Label>
                <Input data-testid="new-emp-direct" value={form.direct_line} onChange={set("direct_line")} className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
              </div>
            </div>
            {error && <p data-testid="new-emp-error" className="text-sm text-red-400 mt-2">{error}</p>}
            <DialogFooter className="mt-4">
              <Button onClick={create} disabled={saving} data-testid="button-create-employee" className="bg-blue-600 hover:bg-blue-500 text-white font-semibold">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />} Créer le compte
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="rounded-2xl bg-[#111827] border border-slate-800 overflow-hidden sf-fade-up">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead className="text-slate-400">Employé</TableHead>
              <TableHead className="text-slate-400">Poste</TableHead>
              <TableHead className="text-slate-400">Poste tél.</TableHead>
              <TableHead className="text-slate-400">Rôle</TableHead>
              <TableHead className="text-slate-400 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((emp) => (
              <TableRow key={emp.id} className="border-slate-800 hover:bg-slate-800/40" data-testid={`employee-row-${emp.id}`}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 border border-slate-700">
                      <AvatarImage src={emp.avatar_url} />
                      <AvatarFallback className="bg-blue-600/80 text-white text-xs">{(emp.name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-white font-medium text-sm">{emp.name}</p>
                      <p className="text-slate-500 text-xs">{emp.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-slate-300 text-sm">{emp.title || "—"}<span className="text-slate-600">{emp.department ? ` · ${emp.department}` : ""}</span></TableCell>
                <TableCell className="text-slate-300 text-sm font-mono">{emp.phone_ext || "—"}</TableCell>
                <TableCell>
                  {emp.role === "admin" ? (
                    <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/15"><ShieldCheck className="h-3 w-3 mr-1" />Admin</Badge>
                  ) : (
                    <Badge className="bg-slate-700/50 text-slate-300 border-slate-600 hover:bg-slate-700/50">Employé</Badge>
                  )}
                  {emp.m365_linked && <Badge className="ml-1 bg-blue-500/15 text-blue-300 border-blue-500/30 hover:bg-blue-500/15">M365</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(emp)} data-testid={`button-edit-employee-${emp.id}`} className="p-2 text-slate-400 hover:text-blue-400 transition-colors">
                      <Pencil className="h-4 w-4" />
                    </button>
                    {emp.role !== "admin" && (
                      <button onClick={() => remove(emp.id)} data-testid={`button-delete-employee-${emp.id}`} className="p-2 text-slate-400 hover:text-red-400 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-[#111827] border-slate-700 text-slate-100 max-w-lg" data-testid="edit-employee-dialog">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Modifier la fiche</DialogTitle>
            <DialogDescription className="text-slate-400">Ces valeurs sont prioritaires sur Microsoft 365 lors du push.</DialogDescription>
          </DialogHeader>
          <div className="grid sm:grid-cols-2 gap-4 mt-2">
            <div className="sm:col-span-2">
              <Label className="text-slate-300">Nom complet</Label>
              <Input data-testid="edit-emp-name" value={editForm.name} onChange={setEdit("name")} className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
            </div>
            <div>
              <Label className="text-slate-300">Poste / Titre</Label>
              <Input data-testid="edit-emp-title" value={editForm.title} onChange={setEdit("title")} className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
            </div>
            <div>
              <Label className="text-slate-300">Département</Label>
              <Input data-testid="edit-emp-department" value={editForm.department} onChange={setEdit("department")} className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
            </div>
            <div>
              <Label className="text-slate-300">Poste téléphonique</Label>
              <Input data-testid="edit-emp-ext" value={editForm.phone_ext} onChange={setEdit("phone_ext")} className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
            </div>
            <div>
              <Label className="text-slate-300">Ligne directe</Label>
              <Input data-testid="edit-emp-direct" value={editForm.direct_line} onChange={setEdit("direct_line")} className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-slate-300">Lien « Réserver une réunion » (Bookings)</Label>
              <Input data-testid="edit-emp-booking" value={editForm.booking_url} onChange={setEdit("booking_url")} placeholder="https://outlook.office.com/bookwithme/user/…" className="mt-1.5 bg-slate-800/60 border-slate-700 text-white" />
            </div>
            {editSig && (
              <div className="sm:col-span-2">
                <Label className="text-slate-300">Signature actuelle dans Outlook (importée de M365)</Label>
                <div data-testid="edit-emp-m365-signature" className="mt-1.5 rounded-lg border border-slate-700 bg-white p-3 max-h-52 overflow-auto" dangerouslySetInnerHTML={{ __html: editSig }} />
                <p className="text-xs text-slate-500 mt-1.5">Ceci est la signature que l'employé a définie lui-même dans Outlook (lecture seule). Cliquez « Synchroniser » sur la page Microsoft 365 pour la rafraîchir.</p>
              </div>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button onClick={saveEdit} disabled={savingEdit} data-testid="button-save-employee-edit" className="bg-blue-600 hover:bg-blue-500 text-white font-semibold">
              {savingEdit ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Pencil className="h-4 w-4 mr-2" />} Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
