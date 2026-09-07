# Guide complet — Indépendance Emergent, SMTP2Go, Régénération auto & Déploiement Microsoft 365

Ce guide vous rend **100 % autonome vis-à-vis d'Emergent** et explique, étape par étape, comment déployer les signatures à vos utilisateurs Microsoft 365.

Sommaire :
1. Rendre SigFlow indépendant d'Emergent (stockage, LLM, clés)
2. Héberger sur Windows Server / Linux / GitHub+Render
3. Configurer l'envoi de courriels avec **SMTP2Go** (ou Office 365)
4. **Régénération automatique** des scripts (tâche planifiée / cron)
5. **Déployer la signature dans l'admin Microsoft 365** (pas-à-pas)
6. Ce que l'utilisateur peut modifier lui-même

---

## 1) Rendre SigFlow indépendant d'Emergent

SigFlow n'a besoin d'Emergent pour **rien** en production si vous configurez ces variables (`backend/.env`) :

```
STORAGE_BACKEND=local              # stockage des logos/GIF sur le disque du serveur
LOCAL_STORAGE_DIR=/app/backend/storage
# EMERGENT_LLM_KEY et INTEGRATION_PROXY_URL ne sont PAS nécessaires en mode local
```

- **Images/GIF** : en `STORAGE_BACKEND=local`, tout est stocké sur votre disque et servi par `GET /api/files/...`. Aucune dépendance externe.
- **Aucune IA n'est utilisée** dans l'application → la clé LLM Emergent est inutile.
- Pensez à sauvegarder le dossier `LOCAL_STORAGE_DIR` (contient logos + `banner.gif`).

> Les images sont référencées dans les signatures via `REACT_APP_BACKEND_URL`. Cette URL doit être **l'adresse publique de votre backend** (celle joignable par Outlook/Internet), en **HTTPS** de préférence.

---

## 2) Hébergement

Le détail complet (commandes) est dans **`DEPLOYMENT.md`**. Résumé :

### Option Docker (recommandée — identique Windows/Linux)
```bash
cp .env.example .env      # remplir PUBLIC_URL, JWT_SECRET, ADMIN_PASSWORD, DEPLOY_API_TOKEN...
docker compose up -d --build
```
- Frontend : `http://VOTRE_SERVEUR:8080`  • Backend : `http://VOTRE_SERVEUR:8001`
- Le `docker-compose.yml` inclut MongoDB + un volume `storage_data` persistant pour vos images.

### Windows Server (sans Docker)
- MongoDB Community (service Windows) + Python 3.11 (backend via **NSSM**) + build React servi par **IIS**. Voir `DEPLOYMENT.md`.

### Ubuntu Server (sans Docker)
- MongoDB + backend via **systemd** + build React servi par **nginx** (`nginx.conf` fourni) + HTTPS via **Certbot**. Voir `DEPLOYMENT.md`.

### GitHub + Render
- Poussez le repo, créez un cluster **MongoDB Atlas**, puis **New → Blueprint** sur Render (lit `render.yaml`). Renseignez `MONGO_URL`, `ADMIN_PASSWORD`, `DEPLOY_API_TOKEN`, et `REACT_APP_BACKEND_URL` (URL publique du backend). Voir `DEPLOYMENT.md`.

---

## 3) Envoi de courriels — SMTP2Go (ou Office 365)

SigFlow fonctionne avec **n'importe quel serveur SMTP**. Dans l'app : **Envois courriel → Serveur SMTP**.

### SMTP2Go (idéal si vous n'avez pas de courriel Office)
1. Créez un compte sur https://www.smtp2go.com et vérifiez votre domaine d'envoi (SPF/DKIM).
2. Dans SMTP2Go : **Settings → Users (SMTP)** → créez un utilisateur SMTP (login + mot de passe).
3. Dans SigFlow, saisissez :
   | Champ | Valeur SMTP2Go |
   |---|---|
   | Hôte SMTP | `mail.smtp2go.com` |
   | Port | `587` (STARTTLS) — ou `465` (SSL), ou `2525`/`8025` si 587 est bloqué |
   | Utilisateur | votre login SMTP2Go |
   | Mot de passe | votre mot de passe SMTP2Go |
   | Adresse d'expéditeur | une adresse de votre domaine vérifié (ex. `signatures@monentreprise.com`) |
   | Nom d'expéditeur | `Mon Entreprise` |
4. **Enregistrer SMTP**, puis **Envoyer un courriel de test**.

> Note technique : SigFlow choisit automatiquement SSL implicite pour le port `465`, sinon STARTTLS. Les ports `2525`/`8025` de SMTP2Go passent en STARTTLS.

### Office 365
| Champ | Valeur |
|---|---|
| Hôte | `smtp.office365.com` |
| Port | `587` |
| Utilisateur / Mot de passe | un compte autorisé (SMTP AUTH activé) |

> Rappel : l'onglet **Envois courriel** sert à **envoyer aux employés** leur signature (corps + fichier `.html`) et à **relancer** les non-installés. Pour appliquer la signature **automatiquement sur les courriels sortants**, utilisez le déploiement Microsoft 365 (section 5).

---

## 4) Régénération automatique des scripts M365

Les scripts sont **générés à la volée** : chaque appel renvoie la version la plus récente (signatures + employés du moment). Il suffit donc de **re-télécharger et ré-appliquer** régulièrement, ou après un changement.

Dans **Déploiement M365 → Régénération automatique**, vous obtenez 2 URL protégées par un jeton (`DEPLOY_API_TOKEN`) :
```
https://VOTRE_BACKEND/api/deploy/exchange-script?token=VOTRE_TOKEN
https://VOTRE_BACKEND/api/deploy/gpo-script?token=VOTRE_TOKEN
```

### 4.a — Windows (Tâche planifiée) pour Exchange Online

Créez `C:\SigFlow\update-signatures.ps1` :
```powershell
# 1) Récupère le dernier script Exchange
$token = "VOTRE_TOKEN"
$url   = "https://VOTRE_BACKEND/api/deploy/exchange-script?token=$token"
$ps1   = "C:\SigFlow\sigflow-exchange.ps1"
Invoke-WebRequest -Uri $url -OutFile $ps1 -UseBasicParsing

# 2) Connexion NON-INTERACTIVE à Exchange Online (authentification par application + certificat)
Import-Module ExchangeOnlineManagement
Connect-ExchangeOnline -AppId "APP_ID" -CertificateThumbprint "THUMBPRINT" -Organization "monentreprise.onmicrosoft.com"

# 3) Applique
& $ps1

Disconnect-ExchangeOnline -Confirm:$false
```
Planifiez-le : **Planificateur de tâches → Créer une tâche → Déclencheur quotidien → Action : `powershell.exe -File C:\SigFlow\update-signatures.ps1`** (exécuter que l'utilisateur soit connecté ou non).

> La connexion **non-interactive** à Exchange Online exige une **app Entra ID + certificat** (voir 5.d). Pour un usage simple/manuel, vous pouvez aussi lancer le script à la main après chaque changement (l'app affiche « regénérez après modification »).

### 4.b — Linux (cron) — utile pour archiver/distribuer le script
```bash
# /etc/cron.daily/sigflow-signatures  (chmod +x)
#!/usr/bin/env bash
TOKEN="VOTRE_TOKEN"
curl -s "https://VOTRE_BACKEND/api/deploy/exchange-script?token=$TOKEN" -o /opt/sigflow/sigflow-exchange.ps1
curl -s "https://VOTRE_BACKEND/api/deploy/gpo-script?token=$TOKEN"      -o /opt/sigflow/sigflow-gpo.ps1
# L'application des règles Exchange se fait ensuite depuis un poste Windows/PowerShell.
```

> ⚠️ Le jeton donne accès aux scripts (qui contiennent les signatures HTML). Gardez-le secret ; changez `DEPLOY_API_TOKEN` pour le révoquer.

---

## 5) Déployer la signature dans l'admin Microsoft 365 (pas-à-pas)

Deux méthodes. **La méthode A (Exchange Online) est la plus simple** et applique la signature automatiquement à tous les courriels sortants, sans rien installer sur les postes.

### Méthode A — Signature serveur via Exchange Online (recommandée)

**Objectif** : chaque courriel envoyé par un utilisateur reçoit automatiquement sa signature en bas.

1. **Préparez SigFlow** : dans **Charte graphique** (logo, adresse, réseaux, mention légale) et **Bannières & GIF**, puis créez vos employés dans **Employés** (chacun avec nom, poste, courriel, poste téléphonique).
2. Allez dans **Déploiement M365** → cliquez **Script Exchange (.ps1)** pour télécharger `sigflow-exchange-signatures.ps1` (déjà pré-rempli avec la signature de chaque employé).
3. Sur un poste Windows, ouvrez **PowerShell** et installez le module Exchange (une seule fois) :
   ```powershell
   Install-Module ExchangeOnlineManagement -Scope CurrentUser
   ```
4. Connectez-vous à votre tenant avec un compte **administrateur Exchange** :
   ```powershell
   Connect-ExchangeOnline -UserPrincipalName admin@monentreprise.com
   ```
5. Autorisez l'exécution du script puis lancez-le :
   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   .\sigflow-exchange-signatures.ps1
   ```
6. Le script crée/actualise **une règle de flux de messagerie par employé** (menu **Exchange admin center → Mail flow → Rules**, règles nommées `SigFlow - courriel@...`).
7. **Pour déployer aux utilisateurs choisis seulement** : ne créez dans **Employés** que les personnes concernées → seules leurs règles seront générées. (Alternativement, éditez la règle dans l'EAC pour restreindre le périmètre.)
8. Testez : envoyez un courriel depuis un compte concerné vers une adresse externe → la signature apparaît en bas.

> Limites Exchange : la signature serveur est ajoutée **en bas du fil** (pas juste sous le nouveau message) et n'est pas visible par l'expéditeur au moment de la rédaction. C'est le compromis normal des signatures serveur. Pour une signature visible dans Outlook pendant la rédaction, utilisez la Méthode B.

### Méthode B — Signature Outlook (bureau) via GPO (Active Directory)

**Objectif** : définir la signature par défaut d'Outlook sur les postes.

1. Dans **Déploiement M365** → **Script GPO (.ps1)** → télécharge `sigflow-outlook-gpo.ps1` (pré-rempli).
2. Ouvrez la **Console de gestion des stratégies de groupe** (`gpmc.msc`).
3. Créez/éditez une GPO ciblant les utilisateurs concernés (OU appropriée).
4. **Configuration utilisateur → Stratégies → Paramètres Windows → Scripts → Ouverture de session** → **Ajouter** → pointez le fichier `.ps1` (déposez-le dans le partage `NETLOGON` du domaine).
5. À la prochaine ouverture de session, le script écrit la signature dans `%APPDATA%\Microsoft\Signatures` et la définit par défaut (nouveaux messages + réponses).
6. **Pour cibler seulement certains utilisateurs** : liez la GPO à l'OU voulue, ou utilisez le **filtrage de sécurité** de la GPO (groupe AD).

### 5.c — Méthode « native » 365 sans script (option manuelle)
Vous pouvez aussi créer manuellement une **règle de flux** dans **Exchange admin center → Mail flow → Rules → Add a rule → Apply disclaimers**, et y **coller** la signature (bouton « Code source » de SigFlow, sur la page **Ma signature**). Utile pour une signature générique unique, mais **non personnalisée par employé** — préférez la Méthode A pour du personnalisé.

### 5.d — Connexion non-interactive à Exchange (pour l'automatisation, section 4)
1. **Entra ID (Azure AD) → App registrations → New registration**.
2. **API permissions** → ajoutez `Office 365 Exchange Online → Exchange.ManageAsApp` (permission d'application) → **Grant admin consent**.
3. **Certificates & secrets** → téléversez un **certificat** (créé via `New-SelfSignedCertificate`).
4. **Rôles** : dans Exchange/Entra, assignez le rôle **Exchange Administrator** (ou un rôle personnalisé Transport Rules) à l'application (service principal).
5. Utilisez `Connect-ExchangeOnline -AppId ... -CertificateThumbprint ... -Organization ...` dans votre tâche planifiée (section 4.a).

---

## 6) Ce que l'utilisateur peut modifier lui-même

Par conception, dans **Ma signature**, chaque employé ne peut modifier que :
- **Nom complet**
- **Poste occupé / Titre** (et département)
- **Courriel** (via son compte)
- **Numéro de poste téléphonique** (poste + ligne directe)

Tout le reste — **logo, images défilantes (GIF), bannière promo, réseaux sociaux, adresse, mention de confidentialité, couleurs** — est **verrouillé et géré par l'administrateur** dans **Charte graphique** et **Bannières & GIF**. Toute modification de ces éléments partagés s'applique **à tous les utilisateurs**.

> Après qu'un employé a changé ses infos (ou que l'admin a modifié la charte), **re-téléchargez et ré-appliquez le script** (ou laissez la tâche planifiée le faire, section 4) pour propager la mise à jour. Les images (logo, GIF) se mettent à jour automatiquement car elles sont hébergées à une URL stable.

---

### Récapitulatif express
1. Serveur autonome : `STORAGE_BACKEND=local`, HTTPS, `REACT_APP_BACKEND_URL` public.
2. SMTP : SMTP2Go (`mail.smtp2go.com:587`) ou Office 365.
3. Signatures serveur : **Déploiement M365 → Script Exchange** → `Connect-ExchangeOnline` → exécuter.
4. Automatisation : tâche planifiée qui tire l'URL `...?token=...` et ré-applique.
5. Employés : gèrent seulement nom, poste, courriel, poste téléphonique.
