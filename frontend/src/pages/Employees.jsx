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
import { UserPlus, Trash2, Loader2, ShieldCheck } from "lucide-react";

const empty = { email: "", password: "", name: "", title: "", phone_ext: "", direct_line: "", department: "" };

export default function Employees() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/employees").then((r) => setList(r.data));
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

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
                </TableCell>
                <TableCell className="text-right">
                  {emp.role !== "admin" && (
                    <button onClick={() => remove(emp.id)} data-testid={`button-delete-employee-${emp.id}`} className="p-2 text-slate-400 hover:text-red-400 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
