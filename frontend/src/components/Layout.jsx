import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { PenLine, Palette, Images, Users, LogOut, Sparkles, Mail, BarChart3, Cloud, Server, Rocket, CloudCog } from "lucide-react";

const navItems = [
  { to: "/app/signature", label: "Ma signature", icon: PenLine, testid: "nav-employee-portal", roles: ["admin", "employee"] },
  { to: "/app/setup", label: "Assistant", icon: Rocket, testid: "nav-setup", roles: ["admin"] },
  { to: "/app/brand", label: "Charte graphique", icon: Palette, testid: "nav-brand-assets", roles: ["admin"] },
  { to: "/app/gif", label: "Bannières & GIF", icon: Images, testid: "nav-gif-composer", roles: ["admin"] },
  { to: "/app/employees", label: "Employés", icon: Users, testid: "nav-employees", roles: ["admin"] },
  { to: "/app/email", label: "Envois courriel", icon: Mail, testid: "nav-email", roles: ["admin"] },
  { to: "/app/m365", label: "Microsoft 365", icon: CloudCog, testid: "nav-m365", roles: ["admin"] },
  { to: "/app/deploy", label: "Déploiement M365", icon: Cloud, testid: "nav-deploy", roles: ["admin"] },
  { to: "/app/analytics", label: "Statistiques", icon: BarChart3, testid: "nav-analytics", roles: ["admin"] },
  { to: "/app/install", label: "Installation", icon: Server, testid: "nav-install", roles: ["admin"] },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = navItems.filter((i) => i.roles.includes(user?.role));

  return (
    <div className="min-h-screen flex bg-[#0B0F17]">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-slate-800 bg-[#0d1119] fixed inset-y-0">
        <div className="px-6 py-6 flex items-center gap-2.5 border-b border-slate-800">
          <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="font-display text-xl font-extrabold text-white">SigChamp</span>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                data-testid={item.testid}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`
                }
              >
                <Icon className="h-4.5 w-4.5" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-slate-800">
          <div className="px-3.5 py-2 mb-1">
            <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 capitalize">{user?.role === "admin" ? "Administrateur" : "Employé"}</p>
          </div>
          <button
            data-testid="button-logout"
            onClick={() => { logout(); navigate("/login"); }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all"
          >
            <LogOut className="h-4.5 w-4.5" /> Déconnexion
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-20 bg-[#0d1119] border-b border-slate-800 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="font-display text-lg font-extrabold text-white">SigChamp</span>
        </div>
        <button data-testid="button-logout-mobile" onClick={() => { logout(); navigate("/login"); }} className="text-slate-400">
          <LogOut className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-[#0d1119] border-t border-slate-800 flex justify-start overflow-x-auto py-2 no-scrollbar">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] shrink-0 min-w-[64px] ${isActive ? "text-blue-400" : "text-slate-500"}`
              }
            >
              <Icon className="h-5 w-5" />
              {item.label.split(" ")[0]}
            </NavLink>
          );
        })}
      </div>

      <main className="flex-1 md:ml-64 pt-16 md:pt-0 pb-20 md:pb-0">{children}</main>
    </div>
  );
}
