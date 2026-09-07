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

## Backlog / prochaines pistes
- P1 : envoi automatique de la signature par courriel à chaque employé.
- P1 : plusieurs modèles/mises en page de signature au choix.
- P2 : rôles/départements avec bannières spécifiques par équipe.
- P2 : statistiques de clics sur la bannière (tracking pixel).

## Comptes de test
- Admin : admin@sigflow.com / admin123
- Employé exemple : employe@sigflow.com / employe123
