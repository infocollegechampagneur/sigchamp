# PRD — SigFlow Office (Gestionnaire de signatures Outlook)

## Problème (énoncé original)
"J'aimerais faire un système de signature courriels avec images qui défilent afin d'intégrer dans Outlook office."

Choix utilisateur : GIF animé pour les images défilantes ; plusieurs employés + un admin ; signature = nom, titre, téléphone, courriel, logo, réseaux sociaux, bannière promo cliquable, adresse, mention de confidentialité ; intégration Outlook via HTML copier-coller + URL hébergée ; téléversement d'images. Règle clé : quand l'admin change les images/éléments partagés, cela s'applique à TOUS ; seuls nom/poste/courriel/poste téléphonique changent par employé.

## Architecture
- Frontend : React (CRA + Craco), Tailwind, shadcn/ui, framer-motion, sonner. Thème dashboard sombre.
- Backend : FastAPI, JWT (Bearer, token localStorage `sf_token`), bcrypt, Pillow (génération GIF).
- Base de données : MongoDB (collections `users`, `settings`).
- Stockage : Emergent Object Storage (logos, images de bannière, GIF, avatars) servis publiquement via `/api/files/{path}` pour intégration email.

## Personas
- Admin (Gestionnaire de marque) : gère la charte graphique partagée + composeur GIF + employés.
- Employé : renseigne uniquement ses coordonnées, copie sa signature.

## Fonctionnalités implémentées (2026-06)
- Auth JWT (login/register), rôles admin/employee, seed admin au démarrage.
- Charte graphique globale : nom entreprise, site, téléphone, adresse, couleur d'accent, logo (upload), 5 réseaux sociaux, lien bannière, mention légale (modèle inséré en 1 clic).
- Composeur GIF : upload multiple, réordonnancement, suppression, vitesse (slider), génération d'un GIF animé stable (`sigflow/brand/banner.gif?v=N`) appliqué à tous.
- Ma signature : formulaire perso + avatar optionnel, aperçu Outlook en direct (mode clair/sombre).
- Génération HTML signature table-based inline-CSS (compatible Outlook), boutons Copier / Code source / Télécharger .html, modal guide d'installation Outlook (FR).
- Gestion des employés (table, création via dialog, suppression ; admin protégé).
- Éléments partagés (settings globaux) propagés à la signature de chaque employé.

## Statut
Testé end-to-end : 100% backend (40/40 pytest) + 100% frontend (e2e). Aucun bug bloquant.

## Itération 2 — Nouvelles fonctionnalités (2026-06)
- **Envoi automatique par courriel (SMTP entreprise)** : page « Envois courriel », config SMTP (hôte/port/utilisateur/mot de passe masqué/from), test d'envoi, envoi individuel + « Envoyer à tous ». Le courriel contient la signature dans le corps + fichier .html en pièce jointe + instructions + lien vers l'espace SigFlow. (aiosmtplib)
- **Bannières par département** : l'admin crée une liste libre de départements, chacun avec son propre GIF animé (onglets dans « Bannières & GIF »). La signature d'un employé utilise la bannière dont le nom = son champ « Département », sinon la bannière par défaut.
- **Suivi des clics** : les liens de bannière passent par `/api/track/click` (302 + journalisation, protection open-redirect). Page « Statistiques » : total, détail par bannière et par employé.

## Déploiement (2026-06)
Fichiers ajoutés : `Dockerfile.backend`, `Dockerfile.frontend`, `nginx.conf`, `docker-compose.yml`, `.env.example`, `render.yaml`, et guide `DEPLOYMENT.md` (Docker, Windows Server, Ubuntu, hébergement web, GitHub+Render).

## Itération 3 — Autonomie & déploiement réseau (2026-06)
- **Stockage local autonome** : `STORAGE_BACKEND=local` (défaut) stocke logos/GIF/avatars sur disque (`LOCAL_STORAGE_DIR`), servis via `/api/files` — plus de dépendance à Emergent (fallback lecture Emergent pour anciens fichiers).
- **Déploiement M365 (page « Déploiement M365 »)** : génération de 2 scripts PowerShell pré-remplis téléchargeables — (a) règles de flux Exchange Online **par employé** (signature ajoutée côté serveur à tous les courriels sortants), (b) script GPO définissant la signature par défaut d'Outlook.
- **Journal d'envois** : collection `send_log`, page « Envois courriel » affiche statut (Envoyée/Échec + erreur), destinataire, horodatage ; chaque envoi met à jour `last_send_status`/`last_sent_at`.
- **Marquage « installée » manuel + relance manuelle** : bascule `signature_installed` par employé ; bouton « Relancer les non-installés » (`/api/email/send-reminders`) qui ne cible que les employés non marqués installés.

## Itération 4 — Régénération auto & guide autonomie (2026-06)
- **Régénération automatique** : les endpoints `/api/deploy/exchange-script` et `/gpo-script` acceptent désormais un `?token=DEPLOY_API_TOKEN` (en plus du JWT admin) → récupérables sans connexion par une tâche planifiée/cron. Endpoint `/api/deploy/info` (admin) + carte « Régénération automatique » dans la page Déploiement M365 (URLs copiables).
- **Guide `SELF_HOSTING_M365_GUIDE.md`** (FR) : indépendance Emergent (stockage local), hébergement Windows/Linux/Render, **SMTP2Go** (`mail.smtp2go.com:587`), régénération auto (Task Scheduler/cron + connexion Exchange non-interactive cert-based), et déploiement M365 pas-à-pas (Exchange transport rules + GPO). Rappel : l'employé ne modifie que nom/poste/courriel/poste téléphonique.
- `.env.example`, `docker-compose.yml` (volume storage persistant + `DEPLOY_API_TOKEN`) mis à jour.

## Itération 5 — Photo employé + logo, retrait, taille, logos réseaux & mise en forme (2026-06)
- **Photo + logo ensemble** : quand un employé ajoute sa photo, la signature affiche la photo à gauche (avec la barre verticale d'accent) ET le logo de l'entreprise au-dessus du nom. Sans photo, comportement inchangé. Mode Moderne : photo placée à gauche de la barre verticale. Appliqué aux 2 générateurs (`frontend/src/lib/signature.js` classic+modern et `backend/server.py build_signature_html`).
- **Bouton « Retirer »** (page « Ma signature ») : enlève la photo sans toucher au reste des infos.
- **Taille de photo ajustable** : champ `avatar_width` par employé + curseur « Taille de la photo » (60–280px) dans « Ma signature » pour aligner la photo sur la hauteur de la barre.
- **TikTok** ajouté aux réseaux sociaux (modèle `SocialLinks`, `_SOCIAL`, `SOCIAL_META`, champ dans « Charte graphique »).
- **Logos vs Noms des réseaux** : bascule `social_style` ("icons"/"names", défaut icons) dans « Charte graphique ». En mode logos, la signature affiche des icônes PNG (24px) servies par le backend depuis `/api/social-icons/{réseau}.png` (icônes empaquetées dans `backend/assets/social/`, indépendantes = compatibles Outlook/self-hosting).
- **Mention légale enrichie** : éditeur de texte riche (`components/RichTextEditor.jsx`, contentEditable) avec gras / italique / souligné / saut de ligne. Le disclaimer est stocké en HTML, **assaini côté serveur avec `bleach`** (balises autorisées : b, strong, i, em, u, br, p, div, span ; scripts/styles retirés) et rendu tel quel dans la signature.
- Testé : backend (curl/python) + frontend testing agent (5/5 flux OK). Note mineure : execCommand peut perdre le gras si on continue à taper après une sélection mise en gras (quirk contentEditable, pas une régression).
- **Adaptation auto thème clair/sombre** : la signature s'adapte au fond. Classes CSS (`sf-name`, `sf-text`, `sf-accent`, `sf-muted`, `sf-disc`, `sf-bar`, `sf-bar-left`, `sf-social`) + bloc `<style>` injecté contenant `@media (prefers-color-scheme:dark)` (clients compatibles : Apple Mail, Outlook.com, iOS/Gmail app) ET une copie scopée `.sf-dark` pour l'aperçu in-app (bouton Clair/Sombre). En sombre : texte éclairci, et l'accent (barre verticale + libellés) est éclairci automatiquement quand la couleur d'accent est trop foncée (`darkAccentFor`/`_dark_accent_for`, lum < 0.55). Vérifié visuellement en clair et en sombre.

## Itération 6 — Renommage SigChamp & remplacement propre M365 (2026-06)
- **Renommage complet en « SigChamp »** partout (Layout, Login, Install, textes backend, message API racine, en-têtes de courriels, commentaires/scripts PowerShell, titre navigateur). Nouveau slogan de connexion : « Des signatures Outlook cohérentes, pilotées pour le Collège Champagneur. » (Note : `APP_NAME="sigflow"` conservé côté stockage pour ne pas casser les chemins des fichiers déjà téléversés ; invisible pour l'utilisateur.)
- **Push M365 — remplacement propre** : lors du push direct (`/api/m365/push`), la règle de flux existante (`SigChamp - {email}`) est d'abord **supprimée** (Remove-TransportRule, erreur ignorée si absente) puis recréée, garantissant que l'ancienne signature active est retirée et remplacée par la nouvelle sans doublon ni ancien contenu. Le préfixe de règle est cohérent entre push, remove et scripts (« SigChamp - »).

## Itération 7 — Diagnostic échec push M365 (401) (2026-06)
- **Bug** : push signature vers M365 échouait sans raison visible (toast « échec », backend renvoyait des octets nuls). **Cause racine** : Exchange Online (InvokeCommand REST) renvoie **401** — le jeton app-only est valide mais l'application Azure n'a **pas** la permission d'exécuter des commandes Exchange (manque `Office 365 Exchange Online → Exchange.ManageAsApp` + rôle « Exchange Administrator »). Problème côté tenant, rendu non diagnosticable par l'app.
- **Correctifs** : `_exo_error()` décode les réponses Exchange (401/403/autre) en message FR clair et actionnable ; `/api/m365/test` exécute réellement une commande Exchange (`Get-OrganizationConfig`) → le test reflète la vraie capacité de push ; le frontend affiche le motif exact par utilisateur (panneau rouge `m365-push-errors` + toast long). De-dup de la liste d'utilisateurs Graph. Vérifié par testing agent (100% backend + frontend).

## Itération 8 — Section Système / Maintenance (2026-06)
- Nouvelle page admin **« Système »** (`/app/system`, `SystemMaintenance.jsx`, réservée aux admins) avec :
  - **État des services** (backend/frontend/mongodb, badges RUNNING) via `GET /api/system/status` (services internes plateforme masqués).
  - **Rechargement léger** (`POST /api/system/reload`) : relit `.env` + vérifie MongoDB, **sans interruption**.
  - **Redémarrage complet** backend + frontend (`POST /api/system/restart`) : exécution détachée via `RESTART_COMMAND` (défaut `sudo supervisorctl restart frontend backend`), configurable pour l'auto-hébergé (ex. `docker compose restart`). **Confirmation** obligatoire (AlertDialog).
- Tous les endpoints `require_admin`. Vérifié par testing agent (100 %) + curl (restart réel confirmé : services relancés).

## Itération 9 — Correctif push M365 (domaine vanité → GUID) (2026-06)
- **Bug** : push Exchange bloqué en 401 malgré permissions correctes (Exchange.ManageAsApp + consentement + rôle Exchange Administrator). **Cause racine confirmée en direct** : l'appel adminapi InvokeCommand ciblait le tenant par son **domaine vanité** (`champagneur.qc.ca`) dans l'URL et l'en-tête `X-AnchorMailbox`, ce que l'API refuse (401). Le token contenait pourtant bien les rôles.
- **Correctif** (`_exo_invoke`) : cibler le tenant par son **GUID (`tenant_id`)** dans l'URL et l'ancre (le domaine `.onmicrosoft.com` fonctionne aussi ; le GUID est le plus robuste). Vérifié par testing agent (100 %) : `/api/m365/test` → graph_ok + exchange_ok=true ; `/api/m365/push` vers s.lynch → applied_count=1 (règle réelle créée), idempotent ; UI « Exchange (pousser) : OK ».

## Itération 10 — Signature M365 visible dans Outlook (2026-06)
- **Bug** : le push « réussissait » mais la signature n'apparaissait pas dans le compte Outlook. **Cause** : le push créait une **règle de flux Exchange** (ajout serveur au moment de l'envoi) = invisible dans l'interface Outlook.
- **Correctif** : le push définit désormais la **vraie signature du compte** via `Set-MailboxMessageConfiguration` (`SignatureHtml` + `AutoAddSignature` + `AutoAddSignatureOnReply` + `AutoAddSignatureOnMobile` = true) → visible et ajoutée automatiquement dans **Outlook Web / Nouveau Outlook / Mobile**. Nettoyage automatique de l'ancienne règle de flux pour éviter les doublons. `m365_remove` efface la signature du compte + retire toute ancienne règle. Pour **Outlook classique de bureau** (signatures locales), utiliser le script GPO de « Déploiement M365 ». Vérifié par testing agent (100 %) et en réel sur s.lynch (AutoAddSignature=True, SignatureHtml défini, règle de flux supprimée 404).

## Itération 11 — Enrichissement M365 (nom/poste/téléphone) + lien Bookings (2026-06)
- **Nom / poste / téléphone depuis M365** : le push enrichit la signature via Microsoft Graph (`_graph_get_user`) — `displayName` (vrai nom affiché), `jobTitle` (poste), `department`, `businessPhones` (poste téléphonique, nettoyé du préfixe « x »), `mobilePhone`. Les valeurs d'une fiche employé existante restent prioritaires. ⚠️ Le poste (jobTitle) n'apparaît que s'il est **renseigné dans le profil M365/Azure** de l'utilisateur (vide chez s.lynch actuellement). Nom + poste téléphonique fonctionnent automatiquement.
- **Lien Bookings** : nouveau champ optionnel `booking_url` (profil / « Ma signature »). Si renseigné, un bouton **« Réservez une heure pour me rencontrer »** s'affiche **en bas** de la signature (2 générateurs). Persisté via `PUT /auth/me`.
- Vérifié par testing agent (100 %) + en réel : signature live de s.lynch = « Simon Lynch » + 247.

## Itération 12 — Fiches liées M365 : import + synchronisation + édition admin (2026-06)
- **Ajouter comme fiches** (`POST /api/m365/import`) : depuis la page Microsoft 365, l'admin coche des comptes → création/upsert de fiches employé peuplées depuis Graph (nom, poste, poste téléphonique), marquées `m365_linked`.
- **Synchroniser** (`POST /api/m365/sync`, bouton manuel) : pour chaque fiche liée, relit depuis M365 le **profil** (nom/poste/téléphone) ET la **signature personnelle** que l'employé a définie dans Outlook (`Get-MailboxMessageConfiguration.SignatureHtml`) → stockée dans `m365_signature_html`.
- **Édition admin des fiches** : bouton crayon sur la page Employés → dialogue (nom, poste, département, poste tél., ligne directe, **lien Bookings**). Badge « M365 » sur les fiches liées + aperçu (lecture seule) de la signature Outlook importée. `PUT /api/employees/{id}` (ProfileUpdate inclut `booking_url`).
- **Lien Bookings** rendu en bas de la signature générée (2 générateurs). Vérifié : testing agent frontend 100 % + curl backend (s.lynch importé/synchronisé, sig ~3000 car., tél 247). SSO Microsoft abandonné à la demande de l'utilisateur.

## Backlog / prochaines pistes
- P1 : envoi automatique de la signature par courriel à chaque employé.
- P1 : plusieurs modèles/mises en page de signature au choix.
- P2 : rôles/départements avec bannières spécifiques par équipe.
- P2 : statistiques de clics sur la bannière (tracking pixel).

## Comptes de test

## Itération 13 — Push M365 via règle de flux Exchange (signature serveur) (2026-06)
- **Contexte** : après enquête directe sur le tenant, la boîte s.lynch est **déjà inscrite aux signatures itinérantes (roaming)** (signatures « Supportpluri »/« Ma signature » visibles dans OWA). Microsoft **n'expose aucune API** (PowerShell ni Graph) pour écrire une signature roaming, et `PostponeRoamingSignaturesUntilLater=$true` **ne fait pas revenir** une boîte déjà migrée. Donc `Set-MailboxMessageConfiguration` (SignatureHtml/SignatureName/DefaultSignature) est **ignoré** par le client → la signature n'apparaissait jamais.
- **Décision utilisateur (option a)** : revenir à l'ajout **côté serveur** via **règle de flux Exchange** (disclaimer). 100 % fiable, tous clients (OWA, Nouveau Outlook, Classique, mobile), indépendant du roaming. La signature apparaît sur le courriel **livré/envoyé** (pas dans la fenêtre de rédaction).
- **Correctif** (`/api/m365/push`) : crée/met à jour `New-TransportRule`/`Set-TransportRule` « SigChamp - {email} » avec `-ApplyHtmlDisclaimerLocation Append -ApplyHtmlDisclaimerText {html} -ApplyHtmlDisclaimerFallbackAction {Wrap|Ignore|Reject}`. Nettoie la signature de compte (AutoAddSignature=False, DefaultSignature="", DeleteSignatureName) pour éviter tout doublon. `/api/m365/remove` : `Remove-TransportRule` prioritaire + nettoyage compte.
- **Limite de taille des disclaimers (~5000 car.)** : `build_signature_html(..., include_style=False)` génère une version **compacte sans bloc `<style>`** (le CSS dark-mode `<style>` est de toute façon supprimé par les règles de flux). Passe de 5258 → 4301 car. (New-TransportRule échouait avec « Invalid Operation » à cause du dépassement).
- **Vérifié en réel sur s.lynch** : `applied_count=1` ; `Get-TransportRule` → règle **Enabled/Enforce**, action Append disclaimer ; signature de compte nettoyée (AutoAddSignature=False). Push idempotent (branche Set-TransportRule). ⚠️ Test final (envoi réel) à faire par l'utilisateur — une règle de flux met généralement quelques minutes à s'activer.

## Itération 14 — Poste affiché + aperçu live + re-push auto (2026-06)
- **Symptôme utilisateur** : après avoir ajouté le poste (« Technicien en informatique ») dans la fiche s.lynch, il n'apparaissait « ni dans l'aperçu ni dans le courriel ».
- **Diagnostic** : le poste **était** bien enregistré (DB) et **présent** dans la signature générée ET dans la règle de flux. Deux causes de confusion : (1) la vignette du dialogue montrait la signature **importée** de M365 (lecture seule, ancienne, sans poste) ; (2) **modifier la fiche ne re-poussait pas** la règle de flux → le courriel gardait l'ancienne version tant qu'on ne re-poussait pas.
- **Correctifs frontend** (`Employees.jsx`) :
  - Ajout d'un **aperçu SigChamp en direct** (« ce qui sera poussé », composant `SignaturePreview` + `/settings`) qui reflète les modifications en temps réel (poste visible immédiatement). L'ancienne vignette importée est conservée en dessous, clairement libellée.
  - **Re-push automatique** après « Enregistrer » si la fiche avait déjà été poussée (`m365_pushed_at`) → le courriel reste synchronisé sans action supplémentaire (toast dédié).
  - Dialogue rendu défilable (`max-h-[88vh] overflow-y-auto`).
- Vérifié : aperçu live affiche « Technicien en informatique » (desktop + mobile 390px OK).


## Itération 15 — Saut de ligne + déploiement autonome Render/GitHub (2026-06)
- **Saut de ligne** : le push (règle de flux) préfixe désormais la signature d'un espace (`<div style="height:18px">`) pour que le texte du message ne colle pas à la signature. Re-poussé/vérifié.
- **Déploiement autonome (sans Emergent)** : `STORAGE_BACKEND` par défaut = `emergent` dans le code → **il faut `STORAGE_BACKEND=local`** pour un hébergement sans Emergent (stockage disque via `LOCAL_STORAGE_DIR`, servi par `/api/files`). Aucune fonction n'appelle Emergent en mode local ; `EMERGENT_LLM_KEY`/`INTEGRATION_PROXY_URL` inutiles.
- `render.yaml` **réécrit** : services `sigchamp-backend`/`sigchamp-frontend`, `STORAGE_BACKEND=local` + `LOCAL_STORAGE_DIR=/data/storage` + **disque persistant 1 Go** (plan starter), `JWT_SECRET`/`DEPLOY_API_TOKEN` auto-générés, plus de variables Emergent.
- `DEPLOYMENT.md` mis à jour (tableau env, note stockage autonome, Option D Render pas-à-pas, section « Ajouter manuellement dans GitHub »).
- **Sécurité** : `.gitignore` protège désormais `.env`/`*/.env` (garde `.env.example`) ; `backend/.env` **retiré du suivi Git** (`git rm --cached`, fichier conservé sur disque) pour éviter toute fuite de secrets au push.


## Itération 16 — Fix signature invisible sur fond clair (OS en mode sombre) (2026-06)
- **Bug** : sur fond clair, la signature (aperçu in-app) devenait illisible ; en sombre, OK. **Cause racine** : `buildSignatureHtml` (frontend) injectait un bloc `<style>` avec une règle **globale** `@media (prefers-color-scheme:dark){ .sf-name{color:#f8fafc!important} … }`. Quand le **navigateur/OS de l'utilisateur est en mode sombre**, cette règle non scopée blanchissait TOUT le texte `.sf-*` de la page, y compris l'aperçu « Clair » sur fond blanc → texte blanc invisible. Indépendant des changements récents (dépend du thème système).
- **Correctif** (`frontend/src/lib/signature.js`) : `darkStyleBlock(accent, previewOnly)` + `buildSignatureHtml(user, s, opts)` ; en mode `preview` on n'émet QUE les règles scopées `.sf-dark` (pilotées par le bouton Clair/Sombre), sans le `@media` global. `SignaturePreview.jsx` rend `previewHtml` (preview) mais garde `html` complet pour copier/code source/télécharger (vrai Outlook conserve le dark-mode `@media`). `BrandAssets.jsx` (vignettes) passe aussi `{ preview: true }`.
- **Vérifié** : navigateur émulé en dark → aperçu « Clair » affiche `.sf-name` en `rgb(15,23,42)` (foncé, lisible sur blanc).


## Itération 17 — Hébergement externe des images (FTP/SiteGround, autonomie + toujours actif) (2026-06)
- **Besoin** : solution gratuite où les images des signatures restent accessibles 24/7 même quand le backend dort. **Approche** : découpler les images vers l'hébergement du client (SiteGround, sous-domaine `sig.champagneur.qc.ca` HTTPS, toujours actif).
- **Backend** (`server.py`) : couche de publication **FTP/FTPS** (`ftplib.FTP_TLS`) ; `put_object` publie automatiquement chaque fichier sur le FTP si activé ; `_rewrite_asset_urls()` remplace `{BACKEND}/api/files/` → `{public_url}/` et `{BACKEND}/api/social-icons/` → `{public_url}/social/` à la génération de la signature. Config en DB (`config.key="assets"`, mot de passe non exposé), cache module `_assets_cache` rafraîchi au démarrage + à chaque sauvegarde. Endpoints : `GET/PUT /api/assets/config`, `POST /api/assets/test`, `POST /api/assets/publish-all` (mirroir stockage local + icônes sociales vers le FTP).
- **Frontend** : nouvelle page admin **« Hébergement images »** (`AssetHosting.jsx`, route `/app/hosting`, nav) : toggle, URL publique, hôte/port/user/pass FTP, dossier distant, FTPS, boutons Enregistrer / Tester / Publier. Vérifié (rendu OK, endpoints OK, réécriture d'URLs OK). Par défaut désactivé → comportement inchangé.
- **Reco d'archi gratuite** : images → SiteGround (toujours actif) ; app → hébergement gratuit qui peut dormir ; MongoDB → Atlas gratuit. Total 0 $.


## Comptes de test
- Admin : admin@sigflow.com / admin123
- Employé exemple : employe@sigflow.com / employe123
