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
| `EMERGENT_LLM_KEY` + `INTEGRATION_PROXY_URL` | Stockage des images/GIF (fournis par Emergent) |
| `REACT_APP_BACKEND_URL` | URL **publique** du backend — utilisée pour les URLs d'images intégrées dans les signatures. **Indispensable** pour que les images s'affichent dans Outlook. |

**Frontend** (`frontend/.env`) :
| Variable | Description |
|---|---|
| `REACT_APP_BACKEND_URL` | URL publique du backend (ex. `https://signatures.mon-entreprise.com`) |

> ⚠️ Le stockage d'images (logos, GIF) utilise le service Emergent. Pour un hébergement 100 % autonome sans Emergent, il faudrait remplacer les fonctions `put_object`/`get_object` de `backend/server.py` par un stockage local ou S3.

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

## Option D — GitHub + Render

1. Poussez le projet sur GitHub.
2. Base de données : créez un cluster gratuit **MongoDB Atlas** et récupérez l'`MONGO_URL`.
3. Sur Render → **New → Blueprint**, sélectionnez le dépôt. Render lit `render.yaml` et crée 2 services web (backend + frontend).
4. Renseignez les variables marquées `sync: false` :
   - Backend : `MONGO_URL` (Atlas), `ADMIN_PASSWORD`, `EMERGENT_LLM_KEY`, `INTEGRATION_PROXY_URL`, et `REACT_APP_BACKEND_URL` = URL publique du backend Render.
   - Frontend : `REACT_APP_BACKEND_URL` = URL publique du backend Render.
5. Déployez. Le frontend sera servi sur son URL Render, le backend sur la sienne.

> Astuce : sur Render, l'URL du backend n'est connue qu'après la première création. Créez le backend, copiez son URL, puis renseignez-la dans `REACT_APP_BACKEND_URL` (backend + frontend) et redéployez le frontend.

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
