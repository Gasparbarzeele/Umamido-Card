# 🦊 UMAMIDO LOYALTY — Guide de Setup

## Ce que tu as dans ce projet

```
umamido/
├── server/
│   ├── index.js          ← Serveur principal (API + routes)
│   ├── db.js             ← Base de données (clients, tampons)
│   └── passGenerator.js  ← Génération cartes Apple Wallet
├── public/
│   ├── client/
│   │   ├── index.html    ← Page inscription client
│   │   └── card.html     ← Vue carte client
│   └── ipad/
│       └── index.html    ← Interface caisse iPad
├── passes/               ← Template Apple Wallet (à créer)
├── certs/                ← Certificats Apple (à obtenir)
├── package.json
└── .env.example
```

---

## ÉTAPE 1 — Installer Node.js

1. Va sur **nodejs.org**
2. Télécharge la version LTS (la verte)
3. Installe-la normalement

Pour vérifier : ouvre Terminal et tape :
```bash
node --version
```
Tu dois voir quelque chose comme `v20.x.x`

---

## ÉTAPE 2 — Installer le projet

Ouvre Terminal dans le dossier `umamido` et tape :
```bash
npm install
```
Ça télécharge toutes les dépendances. Patiente 1-2 minutes.

---

## ÉTAPE 3 — Configurer le .env

1. Copie le fichier `.env.example` et renomme-le `.env`
2. Pour l'instant laisse tout par défaut
3. Change juste `SECRET_KEY` par n'importe quelle phrase

---

## ÉTAPE 4 — Lancer le serveur (mode bêta)

```bash
npm start
```

Tu vas voir :
```
🦊 ================================
   UMAMIDO LOYALTY SERVER
   http://localhost:3000
================================
```

---

## ÉTAPE 5 — Tester

Ouvre ton navigateur et va sur :

- **http://localhost:3000/join** → Page inscription client
- **http://localhost:3000/ipad** → Interface caisse (PIN: 1234)

---

## ÉTAPE 6 — Apple Wallet (quand t'as le compte Developer)

### 6.1 — Acheter le compte
- Va sur developer.apple.com
- 99€/an
- Attends 24-48h l'activation

### 6.2 — Créer le Pass Type ID
1. Dans ton dashboard Apple Developer
2. Va dans "Certificates, IDs & Profiles"
3. Clique "Identifiers" → "+"
4. Choisis "Pass Type IDs"
5. Nom : `pass.com.umamido.loyalty`
6. Clique Register

### 6.3 — Générer le certificat
1. Sur ton Mac, ouvre "Troussseau d'accès"
2. Menu : Troussseau d'accès → Aide au certificat → Demander un certificat...
3. Entre ton email, coche "Enregistré sur le disque"
4. Ça crée un fichier `.certSigningRequest`
5. Dans Apple Developer, va sur ton Pass Type ID
6. Clique "Create Certificate"
7. Upload ton `.certSigningRequest`
8. Télécharge le `.cer` généré
9. Double-clique pour l'installer dans le Trousseau

### 6.4 — Exporter les certs
Dans Trousseau d'accès :
1. Trouve "Pass Type ID: pass.com.umamido.loyalty"
2. Clic droit → Exporter → format .p12
3. Mets un mot de passe

Puis en Terminal :
```bash
# Convertir en .pem
openssl pkcs12 -in pass.p12 -clcerts -nokeys -out certs/pass.pem -passin pass:TON_MOT_DE_PASSE
openssl pkcs12 -in pass.p12 -nocerts -nodes -out certs/pass.key -passin pass:TON_MOT_DE_PASSE

# Télécharger le WWDR d'Apple
curl https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer -o certs/wwdr.cer
openssl x509 -inform DER -in certs/wwdr.cer -out certs/wwdr.pem
```

### 6.5 — Créer le template du pass
Crée le dossier `passes/umamido.pass/` avec ces fichiers :
- `pass.json` (généré automatiquement par le serveur)
- `icon.png` (le logo Umamido, 29x29px)
- `icon@2x.png` (58x58px)
- `logo.png` (le logo, 160x50px)
- `logo@2x.png` (320x100px)
- `strip.png` (320x123px, image de fond optionnelle)

### 6.6 — Mettre à jour le .env
```
APPLE_TEAM_ID=TONTEAMID
APPLE_PASS_TYPE_ID=pass.com.umamido.loyalty
APPLE_CERT_PATH=./certs/pass.pem
APPLE_KEY_PATH=./certs/pass.key
APPLE_KEY_PASSPHRASE=ton-mot-de-passe
APPLE_WWDR_PATH=./certs/wwdr.pem
```

---

## ÉTAPE 7 — Déployer sur Railway

1. Va sur **railway.app** et crée un compte
2. "New Project" → "Deploy from GitHub"
3. Upload ton projet sur GitHub d'abord (ou utilise Railway CLI)
4. Dans Railway, configure les variables d'environnement (copie ton .env)
5. Railway te donne une URL publique genre `umamido.railway.app`
6. Mets cette URL dans `BASE_URL` de ton .env

---

## PINS PAR DÉFAUT

| Staff | PIN |
|-------|-----|
| Caisse 1 | 1234 |
| Caisse 2 | 5678 |
| Manager | 0000 |

---

## Questions ?

Reviens voir Claude avec les erreurs exactes, il pourra t'aider étape par étape 🦊
