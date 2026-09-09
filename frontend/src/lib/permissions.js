// Sections d'administration pouvant être accordées individuellement (doit rester aligné avec SECTION_PERMS côté backend).
export const SECTIONS = [
  { key: "setup", label: "Assistant" },
  { key: "brand", label: "Charte graphique" },
  { key: "gif", label: "Bannières & GIF" },
  { key: "employees", label: "Employés" },
  { key: "email", label: "Envois courriel" },
  { key: "m365", label: "Microsoft 365" },
  { key: "deploy", label: "Déploiement M365" },
  { key: "hosting", label: "Hébergement images" },
  { key: "analytics", label: "Statistiques" },
  { key: "install", label: "Installation" },
  { key: "system", label: "Système" },
];

export const SECTION_LABELS = Object.fromEntries(SECTIONS.map((s) => [s.key, s.label]));

// Vrai si l'utilisateur est admin ou possède la permission demandée.
export const can = (user, perm) => user?.role === "admin" || (user?.permissions || []).includes(perm);
