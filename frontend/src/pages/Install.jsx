import React, { useState } from "react";
import { toast } from "sonner";
import { Boxes, MonitorCog, Terminal, Cloud, Copy, Check, CircleDot } from "lucide-react";

function CodeBlock({ code, id }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Commande copiée.");
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative group my-2">
      <pre className="text-xs sm:text-[13px] text-blue-200 bg-slate-950 border border-slate-800 rounded-lg p-3.5 pr-11 overflow-x-auto font-mono leading-relaxed whitespace-pre" data-testid={`code-${id}`}>{code}</pre>
      <button onClick={copy} data-testid={`copy-code-${id}`} className="absolute top-2.5 right-2.5 p-1.5 rounded-md bg-slate-800 text-slate-400 hover:text-white transition-colors">
        {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

const METHODS = [
  {
    id: "docker",
    name: "Docker",
    badge: "Recommandé",
    icon: Boxes,
    intro: "Fonctionne à l'identique sur Windows Server (Docker Desktop/WSL2), Ubuntu et la plupart des hébergeurs. La méthode la plus simple et la plus fiable.",
    prereqs: [
      "Docker Engine + Docker Compose installés (https://docs.docker.com/get-docker/)",
      "Le code du projet SigFlow copié sur le serveur (git clone ou envoi des fichiers)",
      "Un nom de domaine + certificat HTTPS recommandés en production",
    ],
    steps: [
      { title: "Récupérer le projet", desc: "Placez le code sur le serveur.", code: "git clone <URL_DE_VOTRE_DEPOT> sigflow\ncd sigflow" },
      { title: "Créer le fichier .env", desc: "Copiez le modèle et générez les secrets.", code: "cp .env.example .env\n# Générer des secrets aléatoires :\nopenssl rand -hex 32     # -> JWT_SECRET\nopenssl rand -base64 24  # -> DEPLOY_API_TOKEN" },
      { title: "Remplir .env", desc: "Ouvrez .env et renseignez au minimum :", code: "PUBLIC_URL=https://signatures.monentreprise.com\nJWT_SECRET=<collez_le_hex_32>\nADMIN_EMAIL=admin@monentreprise.com\nADMIN_PASSWORD=<mot_de_passe_fort>\nDEPLOY_API_TOKEN=<collez_le_base64_24>\nSTORAGE_BACKEND=local" },
      { title: "Démarrer", desc: "Construit et lance MongoDB + backend + frontend.", code: "docker compose up -d --build" },
      { title: "Vérifier", desc: "Les 3 conteneurs doivent tourner ; le backend répond.", code: "docker compose ps\ncurl http://localhost:8001/api/" },
      { title: "Accéder à l'application", desc: "Frontend sur le port 8080, backend sur 8001.", code: "# Frontend : http://VOTRE_SERVEUR:8080\n# Backend  : http://VOTRE_SERVEUR:8001\n# Connexion : ADMIN_EMAIL / ADMIN_PASSWORD" },
      { title: "HTTPS (production)", desc: "Placez un reverse proxy (Caddy/nginx/Traefik) devant, avec certificat. PUBLIC_URL doit être l'URL HTTPS publique du backend (les images des signatures sont chargées depuis là par Outlook). Reconstruisez après changement d'URL :", code: "docker compose up -d --build" },
    ],
    notes: [
      "Les images (logos/GIF) sont conservées dans le volume Docker persistant « storage_data ».",
      "Mise à jour : git pull && docker compose up -d --build",
    ],
  },
  {
    id: "windows",
    name: "Windows Server",
    icon: MonitorCog,
    intro: "Installation manuelle sur Windows Server (2019/2022) sans Docker : MongoDB + backend Python (service NSSM) + frontend servi par IIS.",
    prereqs: [
      "MongoDB Community Server (installé en service) — https://www.mongodb.com/try/download/community",
      "Python 3.11+ (cochez « Add to PATH ») — https://www.python.org/downloads/windows/",
      "Node.js 20 LTS puis Yarn — https://nodejs.org",
      "NSSM pour exécuter le backend en service — https://nssm.cc",
      "IIS avec le module « URL Rewrite » — https://www.iis.net/downloads/microsoft/url-rewrite",
    ],
    steps: [
      { title: "Installer Yarn", desc: "Dans PowerShell (admin), après Node.js :", code: "npm install -g yarn" },
      { title: "Copier le projet", desc: "Par exemple dans C:\\SigFlow (dossiers backend et frontend).", code: "# C:\\SigFlow\\backend\n# C:\\SigFlow\\frontend" },
      { title: "Préparer le backend", desc: "Environnement virtuel + dépendances.", code: "cd C:\\SigFlow\\backend\npython -m venv venv\n.\\venv\\Scripts\\Activate.ps1\npip install -r requirements.txt" },
      { title: "Créer C:\\SigFlow\\backend\\.env", desc: "Renseignez la configuration :", code: "MONGO_URL=mongodb://localhost:27017\nDB_NAME=sigflow\nCORS_ORIGINS=*\nJWT_SECRET=<chaine_aleatoire_64_hex>\nADMIN_EMAIL=admin@monentreprise.com\nADMIN_PASSWORD=<mot_de_passe_fort>\nSTORAGE_BACKEND=local\nLOCAL_STORAGE_DIR=C:\\SigFlow\\backend\\storage\nDEPLOY_API_TOKEN=<chaine_aleatoire>\nREACT_APP_BACKEND_URL=https://signatures.monentreprise.com" },
      { title: "Tester le backend", desc: "Vérifiez qu'il démarre, puis Ctrl+C.", code: "uvicorn server:app --host 0.0.0.0 --port 8001\n# Testez http://localhost:8001/api/" },
      { title: "Installer le backend en service (NSSM)", desc: "Pour un démarrage automatique et permanent :", code: "nssm install SigFlowBackend \"C:\\SigFlow\\backend\\venv\\Scripts\\python.exe\" \"-m uvicorn server:app --host 0.0.0.0 --port 8001\"\nnssm set SigFlowBackend AppDirectory C:\\SigFlow\\backend\nnssm start SigFlowBackend" },
      { title: "Construire le frontend", desc: "Créez d'abord C:\\SigFlow\\frontend\\.env avec l'URL du backend, puis build :", code: "cd C:\\SigFlow\\frontend\n# .env :\n#   REACT_APP_BACKEND_URL=https://signatures.monentreprise.com\nyarn install\nyarn build" },
      { title: "Publier sur IIS", desc: "Créez un site pointant vers C:\\SigFlow\\frontend\\build. Ajoutez ce web.config à la racine du build pour React Router :", code: "<configuration>\n  <system.webServer>\n    <rewrite><rules>\n      <rule name=\"SPA\" stopProcessing=\"true\">\n        <match url=\".*\" />\n        <conditions logicalGrouping=\"MatchAll\">\n          <add input=\"{REQUEST_FILENAME}\" matchType=\"IsFile\" negate=\"true\" />\n          <add input=\"{REQUEST_FILENAME}\" matchType=\"IsDirectory\" negate=\"true\" />\n        </conditions>\n        <action type=\"Rewrite\" url=\"/index.html\" />\n      </rule>\n    </rules></rewrite>\n  </system.webServer>\n</configuration>" },
      { title: "Ouvrir le pare-feu", desc: "Autorisez les ports nécessaires.", code: "New-NetFirewallRule -DisplayName \"SigFlow API\" -Direction Inbound -LocalPort 8001 -Protocol TCP -Action Allow\nNew-NetFirewallRule -DisplayName \"HTTP/HTTPS\" -Direction Inbound -LocalPort 80,443 -Protocol TCP -Action Allow" },
    ],
    notes: [
      "MongoDB écoute par défaut sur localhost:27017 (service Windows « MongoDB »).",
      "Ajoutez HTTPS sur IIS (certificat) — REACT_APP_BACKEND_URL doit être en https.",
    ],
  },
  {
    id: "linux",
    name: "Linux (Ubuntu)",
    icon: Terminal,
    intro: "Installation manuelle sur Ubuntu Server 22.04+ : MongoDB + backend (systemd) + frontend servi par nginx + HTTPS Let's Encrypt.",
    prereqs: [
      "Accès sudo à un serveur Ubuntu",
      "Un nom de domaine pointant vers le serveur (pour HTTPS)",
    ],
    steps: [
      { title: "Paquets de base", desc: "Python, Node, nginx, git.", code: "sudo apt update\nsudo apt install -y python3.11 python3.11-venv python3-pip nginx git curl" },
      { title: "Installer Node 20 + Yarn", desc: "", code: "curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -\nsudo apt install -y nodejs\nsudo npm install -g yarn" },
      { title: "Installer MongoDB", desc: "Dépôt officiel MongoDB 7.", code: "curl -fsSL https://pgp.mongodb.com/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor\necho \"deb [signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse\" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list\nsudo apt update && sudo apt install -y mongodb-org\nsudo systemctl enable --now mongod" },
      { title: "Récupérer le projet", desc: "", code: "sudo mkdir -p /opt/sigflow && sudo chown $USER /opt/sigflow\ngit clone <URL_DE_VOTRE_DEPOT> /opt/sigflow\ncd /opt/sigflow" },
      { title: "Préparer le backend", desc: "", code: "cd /opt/sigflow/backend\npython3.11 -m venv venv\nsource venv/bin/activate\npip install -r requirements.txt" },
      { title: "Créer /opt/sigflow/backend/.env", desc: "", code: "MONGO_URL=mongodb://localhost:27017\nDB_NAME=sigflow\nCORS_ORIGINS=*\nJWT_SECRET=$(openssl rand -hex 32)\nADMIN_EMAIL=admin@monentreprise.com\nADMIN_PASSWORD=<mot_de_passe_fort>\nSTORAGE_BACKEND=local\nLOCAL_STORAGE_DIR=/opt/sigflow/backend/storage\nDEPLOY_API_TOKEN=$(openssl rand -base64 24)\nREACT_APP_BACKEND_URL=https://signatures.monentreprise.com" },
      { title: "Service systemd du backend", desc: "Créez /etc/systemd/system/sigflow.service :", code: "[Unit]\nDescription=SigFlow Backend\nAfter=network.target mongod.service\n\n[Service]\nWorkingDirectory=/opt/sigflow/backend\nEnvironmentFile=/opt/sigflow/backend/.env\nExecStart=/opt/sigflow/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001\nRestart=always\n\n[Install]\nWantedBy=multi-user.target" },
      { title: "Activer le service", desc: "", code: "sudo systemctl daemon-reload\nsudo systemctl enable --now sigflow\ncurl http://localhost:8001/api/" },
      { title: "Construire le frontend", desc: "", code: "cd /opt/sigflow/frontend\necho 'REACT_APP_BACKEND_URL=https://signatures.monentreprise.com' > .env\nyarn install\nyarn build\nsudo mkdir -p /var/www/sigflow\nsudo cp -r build/* /var/www/sigflow/" },
      { title: "Configurer nginx", desc: "Créez /etc/nginx/sites-available/sigflow puis activez :", code: "server {\n    listen 80;\n    server_name signatures.monentreprise.com;\n    root /var/www/sigflow;\n    index index.html;\n    location / { try_files $uri $uri/ /index.html; }\n    location /api/ {\n        proxy_pass http://127.0.0.1:8001;\n        proxy_set_header Host $host;\n        proxy_set_header X-Forwarded-Proto $scheme;\n    }\n}" },
      { title: "Activer le site + HTTPS", desc: "", code: "sudo ln -s /etc/nginx/sites-available/sigflow /etc/nginx/sites-enabled/\nsudo nginx -t && sudo systemctl reload nginx\nsudo apt install -y certbot python3-certbot-nginx\nsudo certbot --nginx -d signatures.monentreprise.com" },
    ],
    notes: [
      "Sauvegardez /opt/sigflow/backend/storage (logos + banner.gif).",
      "Mise à jour : git pull, puis yarn build + cp, et sudo systemctl restart sigflow.",
    ],
  },
  {
    id: "render",
    name: "GitHub + Render",
    icon: Cloud,
    intro: "Hébergement infogéré via Render (Docker) + base de données MongoDB Atlas. Idéal si vous ne voulez pas gérer de serveur.",
    prereqs: [
      "Un compte GitHub avec le code du projet poussé",
      "Un compte Render (https://render.com)",
      "Un compte MongoDB Atlas (offre gratuite) — https://www.mongodb.com/atlas",
    ],
    steps: [
      { title: "Pousser le code sur GitHub", desc: "", code: "git init\ngit add .\ngit commit -m \"SigFlow\"\ngit branch -M main\ngit remote add origin git@github.com:VOUS/sigflow.git\ngit push -u origin main" },
      { title: "Créer la base MongoDB Atlas", desc: "Créez un cluster gratuit, un utilisateur DB, autorisez l'accès réseau (0.0.0.0/0), et copiez la chaîne de connexion.", code: "mongodb+srv://USER:MOTDEPASSE@cluster0.xxxx.mongodb.net/?retryWrites=true&w=majority" },
      { title: "Déployer sur Render (Blueprint)", desc: "Render → New → Blueprint → sélectionnez votre dépôt. Il lit render.yaml et crée 2 services web (backend + frontend).", code: "# render.yaml est déjà inclus dans le projet" },
      { title: "Variables du backend", desc: "Renseignez les variables marquées « sync:false » du service backend :", code: "MONGO_URL=<chaine_Atlas>\nDB_NAME=sigflow\nADMIN_PASSWORD=<mot_de_passe_fort>\nDEPLOY_API_TOKEN=<chaine_aleatoire>\nSTORAGE_BACKEND=local\nLOCAL_STORAGE_DIR=/data/storage\nREACT_APP_BACKEND_URL=<URL_publique_du_backend_Render>" },
      { title: "Disque persistant (important)", desc: "Le disque Render est éphémère : ajoutez un « Disk » au service backend (Settings → Disks) monté sur /data/storage pour conserver logos/GIF. (Sinon vos images seraient perdues à chaque redéploiement.)", code: "# Mount path : /data/storage\n# Size : 1 GB (suffisant pour des images)" },
      { title: "Variable du frontend", desc: "Sur le service frontend, définissez l'URL publique du backend :", code: "REACT_APP_BACKEND_URL=<URL_publique_du_backend_Render>" },
      { title: "Récupérer l'URL du backend puis redéployer", desc: "L'URL du backend n'est connue qu'après sa 1re création. Copiez-la, mettez-la dans REACT_APP_BACKEND_URL (backend ET frontend), puis redéployez le frontend.", code: "# Backend : https://sigflow-backend.onrender.com\n# Manual Deploy → Deploy latest commit (frontend)" },
    ],
    notes: [
      "Connexion : ADMIN_EMAIL / ADMIN_PASSWORD une fois les services « Live ».",
      "Alternative au disque : utiliser un stockage objet S3 (adaptation du code de stockage requise).",
    ],
  },
];

export default function Install() {
  const [active, setActive] = useState("docker");
  const method = METHODS.find((m) => m.id === active);

  return (
    <div className="max-w-5xl mx-auto px-5 lg:px-8 py-8">
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-400">Mise en place</p>
        <h1 className="font-display text-3xl lg:text-4xl font-extrabold text-white mt-1">Installation</h1>
        <p className="text-slate-400 mt-2">Choisissez votre environnement — le guide détaillé étape par étape s'affiche ci-dessous.</p>
      </div>

      {/* Choice selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8" data-testid="install-method-selector">
        {METHODS.map((m) => {
          const Icon = m.icon;
          const on = active === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setActive(m.id)}
              data-testid={`install-method-${m.id}`}
              className={`relative text-left p-4 rounded-2xl border transition-all ${on ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20" : "bg-[#111827] border-slate-800 text-slate-300 hover:border-slate-600"}`}
            >
              {m.badge && <span className={`absolute top-2.5 right-2.5 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${on ? "bg-white/20 text-white" : "bg-emerald-500/15 text-emerald-400"}`}>{m.badge}</span>}
              <Icon className={`h-6 w-6 mb-2 ${on ? "text-white" : "text-blue-400"}`} />
              <p className="font-semibold text-sm">{m.name}</p>
            </button>
          );
        })}
      </div>

      {/* Detailed guide */}
      <div className="space-y-6 sf-fade-up" key={active}>
        <p className="text-slate-300 bg-[#111827] border border-slate-800 rounded-2xl p-5">{method.intro}</p>

        <div className="rounded-2xl bg-[#111827] border border-slate-800 p-6">
          <h3 className="font-semibold text-white mb-4">Prérequis</h3>
          <ul className="space-y-2">
            {method.prereqs.map((p, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-slate-300"><CircleDot className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />{p}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl bg-[#111827] border border-slate-800 p-6">
          <h3 className="font-semibold text-white mb-5">Étapes</h3>
          <ol className="space-y-6">
            {method.steps.map((s, i) => (
              <li key={i} className="flex gap-4" data-testid={`install-step-${active}-${i}`}>
                <span className="shrink-0 h-8 w-8 rounded-full bg-blue-600/20 text-blue-300 font-bold text-sm flex items-center justify-center">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white text-sm">{s.title}</p>
                  {s.desc && <p className="text-sm text-slate-400 mt-0.5">{s.desc}</p>}
                  {s.code && <CodeBlock code={s.code} id={`${active}-${i}`} />}
                </div>
              </li>
            ))}
          </ol>
        </div>

        {method.notes?.length > 0 && (
          <div className="rounded-2xl bg-blue-600/10 border border-blue-500/20 p-5">
            <h3 className="font-semibold text-white mb-3">À retenir</h3>
            <ul className="space-y-1.5">
              {method.notes.map((n, i) => (
                <li key={i} className="text-sm text-slate-300">💡 {n}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-2xl bg-[#111827] border border-slate-800 p-6">
          <h3 className="font-semibold text-white mb-3">Après l'installation</h3>
          <ol className="text-sm text-slate-300 space-y-1.5 list-decimal list-inside">
            <li>Connectez-vous avec ADMIN_EMAIL / ADMIN_PASSWORD.</li>
            <li>Renseignez <b>Charte graphique</b> (logo, adresse, réseaux, mention légale).</li>
            <li>Créez vos bannières dans <b>Bannières &amp; GIF</b>.</li>
            <li>Configurez le <b>SMTP</b> (SMTP2Go : <code className="text-blue-300">mail.smtp2go.com:587</code>, ou Office 365) dans <b>Envois courriel</b>.</li>
            <li>Ajoutez les <b>Employés</b>, puis déployez via <b>Déploiement M365</b>.</li>
          </ol>
          <p className="text-xs text-slate-500 mt-4">Guides complets à la racine du projet : <code className="text-blue-300">DEPLOYMENT.md</code> et <code className="text-blue-300">SELF_HOSTING_M365_GUIDE.md</code>.</p>
        </div>
      </div>
    </div>
  );
}
