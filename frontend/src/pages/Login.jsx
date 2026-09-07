import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, User, Sparkles } from "lucide-react";

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password, name);
      navigate("/app/signature");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#0B0F17]">
      {/* Left brand panel */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden border-r border-slate-800">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(37,99,235,0.25),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(139,92,246,0.18),transparent_50%)]" />
        <div className="relative z-10 flex flex-col justify-between p-14">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="font-display text-2xl font-extrabold text-white">SigChamp</span>
          </div>
          <div>
            <h1 className="font-display text-5xl font-extrabold text-white leading-[1.05]">
              Des signatures<br />Outlook cohérentes,<br />
              <span className="text-blue-400">pilotées pour le Collège Champagneur.</span>
            </h1>
            <p className="text-slate-400 mt-6 text-lg max-w-md">
              Bannières animées GIF, logos et mentions légales gérés centralement. Chaque employé
              n'ajuste que ses coordonnées.
            </p>
          </div>
          <div className="text-slate-600 text-sm">© 2026 SigChamp</div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md sf-fade-up">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="font-display text-2xl font-extrabold text-white">SigChamp</span>
          </div>
          <h2 className="font-display text-3xl font-extrabold text-white">
            {mode === "login" ? "Connexion" : "Créer un compte"}
          </h2>
          <p className="text-slate-400 mt-2 mb-8">
            {mode === "login" ? "Accédez à votre espace signature." : "Rejoignez votre équipe."}
          </p>

          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <div>
                <Label className="text-slate-300">Nom complet</Label>
                <div className="relative mt-1.5">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    data-testid="input-auth-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Marie Tremblay"
                    className="pl-10 bg-slate-800/60 border-slate-700 text-white h-12"
                  />
                </div>
              </div>
            )}
            <div>
              <Label className="text-slate-300">Courriel</Label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  data-testid="input-auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="vous@entreprise.com"
                  className="pl-10 bg-slate-800/60 border-slate-700 text-white h-12"
                />
              </div>
            </div>
            <div>
              <Label className="text-slate-300">Mot de passe</Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  data-testid="input-auth-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="pl-10 bg-slate-800/60 border-slate-700 text-white h-12"
                />
              </div>
            </div>

            {error && (
              <p data-testid="auth-error" className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button
              type="submit"
              data-testid="button-auth-submit"
              disabled={loading}
              className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-base"
            >
              {loading ? "Un instant…" : mode === "login" ? "Se connecter" : "Créer mon compte"}
            </Button>
          </form>

          <p className="text-center text-slate-400 mt-6 text-sm">
            {mode === "login" ? "Pas encore de compte ?" : "Déjà inscrit ?"}{" "}
            <button
              data-testid="toggle-auth-mode"
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
              className="text-blue-400 hover:text-blue-300 font-semibold"
            >
              {mode === "login" ? "S'inscrire" : "Se connecter"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
