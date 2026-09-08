# Guide de déploiement — SigFlow Office

SigFlow est une application **3 services** :
- **Frontend** : React (build statique servi par nginx)
- **Backend** : FastAPI (Python) sur le port `8001`
- **Base de données** : MongoDB

L'appli fonctionne partout : **Docker** (recommandé, identique sur Windows Server, Ubuntu, hébergement web, Render) ou **installation manuelle**.

---

## Variables d'environnement

**Backend** (`backend/.env`) :
| Variable | Description |
|---|---|
| `MONGO_URL` | Connexion MongoDB (ex. `mongodb://mongo:27017` ou une URL Atlas) |
| `DB_NAME` | Nom de la base (ex. `sigflow`) |
| `CORS_ORIGINS` | Origines autorisées (`*` ou l'URL du frontend) |
| `JWT_SECRET` | Chaîne aléatoire (64 caractères hex) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Compte admin créé au démarrage |
| `STORAGE_BACKEND` | `local` (recommandé, **autonome**, stockage sur disque) ou `emergent`. Par défaut `emergent` — **mettez `local` pour un hébergement sans Emergent**. |
| `LOCAL_STORAGE_DIR` | Dossier disque où sont stockés logos/GIF/avatars (ex. `/data/storage`). À placer sur un **disque persistant**. |
| `EMERGENT_LLM_KEY` + `INTEGRATION_PROXY_URL` | **Optionnels** — nécessaires uniquement si `STORAGE_BACKEND=emergent`. Laissez vides pour un hébergement autonome. |
| `REACT_APP_BACKEND_URL` | URL **publique** du backend — utilisée pour les URLs d'images intégrées dans les signatures. **Indispensable** pour que les images s'affichent dans Outlook. |

**Frontend** (`frontend/.env`) :
| Variable | Description |
|---|---|
| `REACT_APP_BACKEND_URL` | URL publique du backend (ex. `https://signatures.mon-entreprise.com`) |

> ✅ **Hébergement 100 % autonome (sans Emergent)** : mettez `STORAGE_BACKEND=local`. Logos, GIF et avatars sont alors stockés sur le disque du serveur (`LOCAL_STORAGE_DIR`) et servis via `/api/files/...`. Aucune clé Emergent n'est requise et aucune fonction n'appelle Emergent. Placez `LOCAL_STORAGE_DIR` sur un **disque/volume persistant** pour que les images survivent aux redémarrages.

---

## Option A — Docker (recommandé)

Fonctionne à l'identique sur **Windows Server** (Docker Desktop / WSL2), **Ubuntu Server**, et la plupart des hébergeurs.

1. Installez Docker + Docker Compose.
2. À la racine du projet, copiez `.env.example` en `.env` et remplissez les valeurs (surtout `PUBLIC_URL`, `JWT_SECRET`, `ADMIN_PASSWORD`, `EMERGENT_LLM_KEY`, `INTEGRATION_PROXY_URL`).
3. Lancez :
   ```bash
   docker compose up -d --build
   ```
4. Accès :
   - Frontend : `http://VOTRE_SERVEUR:8080`
   - Backend  : `http://VOTRE_SERVEUR:8001`

`PUBLIC_URL` doit être l'URL par laquelle le **backend** est joignable depuis Internet (car Outlook charge les images via cette URL). Derrière un reverse proxy HTTPS, mettez l'URL HTTPS publique.

### Mise à jour
```bash
git pull
docker compose up -d --build
```

---

## Option B — Windows Server (installation manuelle)

1. **MongoDB** : installez MongoDB Community Server (service Windows) — https://www.mongodb.com/try/download/community
2. **Python 3.11+** :
   ```powershell
   cd backend
   python -m venv venv
   venv\Scripts\activate
   pip install -r requirements.txt
   ```
   Créez `backend\.env` (voir tableau ci-dessus), puis démarrez :
   ```powershell
   uvicorn server:app --host 0.0.0.0 --port 8001
   ```
   Pour un service permanent, utilisez **NSSM** (`nssm install SigFlowBackend`).
3. **Frontend** : installez Node.js 20+ puis :
   ```powershell
   cd frontend
   yarn install
   yarn build
   ```
   Servez le dossier `frontend\build` avec **IIS** ou nginx pour Windows. Configurez une règle de réécriture pour renvoyer `index.html` (React Router).
4. Ouvrez les ports dans le pare-feu Windows (8001, 80/443).

---

## Option C — Ubuntu Server (installation manuelle)

```bash
# MongoDB
sudo apt update && sudo apt install -y mongodb-org   # ou paquet mongodb
sudo systemctl enable --now mongod

# Backend
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
# créez backend/.env, puis (service via systemd recommandé) :
uvicorn server:app --host 0.0.0.0 --port 8001

# Frontend
cd ../frontend
yarn install && yarn build
sudo cp -r build/* /var/www/sigflow/
```
Servez le build avec **nginx** (voir `nginx.conf` fourni) et gérez le backend via **systemd** (`/etc/systemd/system/sigflow.service`). Ajoutez HTTPS avec **Certbot / Let's Encrypt**.

Exemple de service systemd :
```ini
[Unit]
Description=SigFlow Backend
After=network.target mongod.service

[Service]
WorkingDirectory=/opt/sigflow/backend
ExecStart=/opt/sigflow/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001
EnvironmentFile=/opt/sigflow/backend/.env
Restart=always

[Install]
WantedBy=multi-user.target
```

---

## Option D — GitHub + Render (autonome, sans Emergent)

Le fichier `render.yaml` fourni est déjà configuré pour un déploiement **autonome** : `STORAGE_BACKEND=local` + disque persistant, **aucune clé Emergent**.

1. Poussez le projet sur GitHub (voir « Ajouter manuellement dans GitHub » plus bas).
2. **Base de données** : créez un cluster gratuit **MongoDB Atlas**, créez un utilisateur, autorisez l'accès réseau (`0.0.0.0/0`), et copiez la chaîne `MONGO_URL` (format `mongodb+srv://user:pass@cluster.xxx.mongodb.net/`).
3. Sur Render → **New → Blueprint**, sélectionnez votre dépôt GitHub. Render lit `render.yaml` et crée 2 services (`sigchamp-backend` + `sigchamp-frontend`) et un disque persistant de 1 Go.
4. Renseignez les variables marquées `sync: false` :
   - **Backend** : `MONGO_URL` (Atlas), `ADMIN_EMAIL`, `ADMIN_PASSWORD`. `JWT_SECRET` et `DEPLOY_API_TOKEN` sont générés automatiquement.
   - Laissez `REACT_APP_BACKEND_URL` vide au premier déploiement (voir étape 6).
5. Lancez le déploiement du **backend** d'abord. Une fois en ligne, copiez son URL publique (ex. `https://sigchamp-backend.onrender.com`).
6. Renseignez `REACT_APP_BACKEND_URL` = cette URL **dans les DEUX services** (backend et frontend), puis **redéployez** le backend et le frontend (le frontend fige cette URL au build).
7. Ouvrez l'URL du frontend et connectez-vous avec `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

> ℹ️ Le **disque persistant** nécessite un plan payant Render (Starter) sur le backend. Sans disque (plan free), les logos/GIF téléversés sont perdus à chaque redéploiement. La base MongoDB (Atlas) et les configurations restent, elles, intactes.

> ℹ️ Aucune variable `EMERGENT_LLM_KEY` / `INTEGRATION_PROXY_URL` n'est nécessaire : l'application n'appelle jamais Emergent quand `STORAGE_BACKEND=local`.

---

## Ajouter manuellement dans GitHub

Poussez **tout le dépôt tel quel**. Fichiers/dossiers indispensables présents à la racine :
- `Dockerfile.backend`, `Dockerfile.frontend`, `nginx.conf`, `docker-compose.yml`, `render.yaml`, `.env.example`
- `backend/` (dont `requirements.txt`, `server.py`, `assets/social/`) et `frontend/` (dont `package.json`, `yarn.lock`, `src/`)

À faire manuellement :
1. **Ne poussez PAS vos secrets** : vérifiez que `backend/.env` et `frontend/.env` sont ignorés (ajoutez-les au `.gitignore`). Les vraies valeurs se renseignent dans Render (variables d'environnement), pas dans Git.
2. Commandes (depuis la racine du projet) :
   ```bash
   git init
   git add .
   git commit -m "SigChamp - déploiement initial"
   git branch -M main
   git remote add origin https://github.com/VOTRE_COMPTE/sigchamp.git
   git push -u origin main
   ```
   > Sur la plateforme Emergent, utilisez plutôt le bouton **« Save to GitHub »** du chat pour pousser automatiquement.
3. Sur GitHub, aucune configuration supplémentaire n'est requise : c'est Render qui lit `render.yaml`.

---

## Option E — Hébergement web classique (cPanel, etc.)

- Frontend : uploadez le contenu de `frontend/build` dans le dossier public (`public_html`). Ajoutez une règle `.htaccess` pour renvoyer vers `index.html`.
- Backend : nécessite Python (Passenger/WSGI) + accès MongoDB. Si l'hébergeur ne supporte pas Python en continu, préférez Render/Docker pour le backend et gardez seulement le frontend sur l'hébergement web.

Exemple `.htaccess` (frontend) :
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

---

## Après déploiement

1. Connectez-vous avec `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
2. **Charte graphique** : logo, coordonnées, réseaux sociaux, adresse, mention légale.
3. **Bannières & GIF** : bannière par défaut + bannières par département.
4. **Envois courriel** : configurez votre SMTP (Office 365 : `smtp.office365.com`, port `587`).
5. **Employés** : créez les comptes ; chacun complète ses coordonnées puis reçoit sa signature.

⚠️ **Sécurité** : changez `ADMIN_PASSWORD`, utilisez un `JWT_SECRET` aléatoire, et servez l'application en **HTTPS** en production.
