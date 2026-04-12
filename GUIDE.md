# 🦊 UMAMIDO — Guide de déploiement complet

## Ce que tu vas avoir à la fin
- Une carte Apple Wallet aux couleurs d'Umamido
- Un serveur qui gère les tampons en temps réel
- Une interface iPad pour les employés à la caisse

---

## ÉTAPE 1 — Apple Developer (30 min)

### 1.1 Créer ton compte
→ Aller sur https://developer.apple.com
→ S'inscrire pour 99€/an
→ Attendre la validation (quelques heures)

### 1.2 Créer un Pass Type ID
→ developer.apple.com → Certificates, IDs & Profiles
→ Identifiers → "+" → Pass Type IDs
→ Description: "Umamido Loyalty"
→ Identifier: **pass.com.umamido.loyalty**
→ Register

### 1.3 Créer le certificat
→ Toujours dans Identifiers, clique sur ton Pass Type ID
→ "Create Certificate"
→ Ouvre l'app **Keychain Access** sur ton Mac
→ Menu : Keychain Access → Certificate Assistant → Request a Certificate from a Certificate Authority
→ Email, cochez "Save to disk" → Continue → Sauvegarde le fichier .certSigningRequest
→ Uploade ce fichier sur Apple → Download → Double-clic pour l'installer dans Keychain

### 1.4 Exporter les certificats
Dans Keychain Access, cherche "Pass Type ID":

**signerCert.pem :**
```bash
# Exporte depuis Keychain en .p12 d'abord, puis :
openssl pkcs12 -in certificat.p12 -clcerts -nokeys -out certs/signerCert.pem
```

**signerKey.pem :**
```bash
openssl pkcs12 -in certificat.p12 -nocerts -out certs/signerKey.pem
```

**wwdr.pem (Apple Intermediate) :**
→ Télécharge sur : https://www.apple.com/certificateauthority/
→ Cherche "Worldwide Developer Relations - G4"
→ Renomme en wwdr.pem et mets dans /certs/

---

## ÉTAPE 2 — Préparer le projet (10 min)

```bash
# Clone / télécharge le projet
cd umamido

# Installer les dépendances
npm install

# Copier le fichier d'environnement
cp .env.example .env

# Éditer .env avec tes vraies valeurs
nano .env
```

Mets dans .env :
- PASS_TYPE_ID = pass.com.umamido.loyalty
- TEAM_ID = (visible sur developer.apple.com, en haut à droite)
- CERT_PASSPHRASE = (le mot de passe choisi à l'export)
- AUTH_SECRET = (invente une longue chaîne random)

---

## ÉTAPE 3 — Déployer sur Railway (15 min)

Railway = hébergement simple, ~5€/mois

```bash
# Installer Railway CLI
npm install -g @railway/cli

# Se connecter
railway login

# Créer le projet
railway init

# Déployer
railway up
```

→ Railway te donne une URL genre https://umamido-xyz.railway.app
→ Mets cette URL dans .env comme SERVER_URL
→ Re-déploie : railway up

**Uploader les certificats sur Railway :**
→ Dashboard Railway → Variables
→ Ajoute toutes les variables de ton .env
→ Pour les certificats, utilise Railway Volumes ou encode-les en base64

---

## ÉTAPE 4 — Ajouter les images du pass (5 min)

Dans le dossier /passes/umamido.pass/, ajoute ces fichiers PNG :
- **icon.png** (29x29px) — logo Umamido petit
- **icon@2x.png** (58x58px)
- **logo.png** (160x50px) — logo texte Umamido
- **logo@2x.png** (320x100px)
- **strip.png** (320x123px) — image de fond du pass (optionnel)
- **strip@2x.png** (640x246px)

---

## ÉTAPE 5 — Tester (5 min)

```bash
# Lancer en local d'abord
npm run dev

# Aller sur http://localhost:3000/ipad
# Créer un client test
# Le .pkpass va se télécharger
# L'ouvrir sur iPhone → il s'ajoute à Wallet
# Ajouter un tampon depuis l'iPad → la carte se met à jour !
```

---

## ÉTAPE 6 — Configurer les iPads en caisse

→ Ouvrir Safari sur l'iPad
→ Aller sur https://ton-app.railway.app/ipad
→ Partager → "Ajouter à l'écran d'accueil"
→ L'app apparaît comme une vraie app sur l'iPad
→ Rester connecté en permanence

---

## Structure des fichiers

```
umamido/
├── server/
│   ├── index.js          ← Serveur principal
│   ├── passGenerator.js  ← Génère les .pkpass
│   ├── database.js       ← Base de données SQLite
│   └── pushUpdate.js     ← Notifications Apple
├── passes/
│   └── umamido.pass/
│       ├── pass.json     ← Template du pass
│       ├── icon.png      ← À ajouter
│       └── logo.png      ← À ajouter
├── public/
│   └── ipad/
│       └── index.html    ← Interface caisse iPad
├── certs/                ← Tes certificats Apple
│   ├── signerCert.pem
│   ├── signerKey.pem
│   └── wwdr.pem
├── .env.example          ← Variables à configurer
└── package.json
```

---

## FAQ

**Le client reçoit comment sa carte ?**
→ À l'inscription, le .pkpass se télécharge. Sur iPhone, ça ouvre automatiquement Wallet.
→ Tu peux aussi envoyer le lien par SMS : https://ton-app.railway.app/api/register?name=Sophie

**Ça marche sur Android ?**
→ Pas Apple Wallet, mais tu peux ajouter Google Wallet en V2 avec la Google Wallet API.

**L'iPad n'a pas accès à internet ?**
→ Il faut une connexion. Un hotspot suffit.

**Peut-on avoir plusieurs caisses ?**
→ Oui ! Ouvre juste l'interface /ipad sur chaque iPad. Tout est centralisé.
