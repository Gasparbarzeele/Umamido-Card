// server/googleWallet.js — Google Wallet API Integration
const { GoogleAuth } = require('google-auth-library');
const axios = require('axios');
require('dotenv').config();

const ISSUER_ID = process.env.GOOGLE_ISSUER_ID;
const CLASS_ID = `${ISSUER_ID}.umamido_loyalty`;
const KEY_FILE = process.env.GOOGLE_KEY_FILE || './certs/google-wallet-key.json';
const STAMPS_FOR_REWARD = 10;

// Auth client
function getAuthClient() {
  return new GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/wallet_object.issuer']
  });
}

async function getAccessToken() {
  const auth = getAuthClient();
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return token.token;
}

// ── Create Loyalty Class (once per setup) ────────────────────────────────────
async function createLoyaltyClass() {
  const token = await getAccessToken();
  const classBody = {
    id: CLASS_ID,
    issuerName: 'Umamido',
    programName: 'うまみ道 Fidélité',
    programLogo: {
      sourceUri: { uri: 'https://umamido-card-test.up.railway.app/logo.png' },
      contentDescription: { defaultValue: { language: 'fr-FR', value: 'Umamido Logo' } }
    },
    rewardsTier: '飲 Tampon',
    rewardsTierLabel: 'Niveau',
    accountNameLabel: 'Membre',
    accountIdLabel: 'Carte',
    hexBackgroundColor: '#1a1e5a',
    heroImage: {
      sourceUri: { uri: 'https://umamido-card-test.up.railway.app/hero.png' },
      contentDescription: { defaultValue: { language: 'fr-FR', value: 'Umamido' } }
    },
    textModulesData: [
      {
        header: 'Récompense',
        body: '1 Ramen offert après 10 tampons',
        id: 'reward_info'
      },
      {
        header: 'Slogan',
        body: 'No Stain, No Gain !!',
        id: 'slogan'
      }
    ],
    linksModuleData: {
      uris: [
        {
          uri: 'https://umamido-card-test.up.railway.app/join',
          description: 'Rejoindre la fidélité',
          id: 'join_link'
        }
      ]
    },
    reviewStatus: 'underReview'
  };

  try {
    const res = await axios.post(
      'https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass',
      classBody,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log('✅ Google Wallet Class créée:', res.data.id);
    return res.data;
  } catch (err) {
    if (err.response?.status === 409) {
      console.log('ℹ️ Class déjà existante');
      return null;
    }
    throw err;
  }
}

// ── Create Loyalty Object (one per customer) ─────────────────────────────────
async function createLoyaltyObject(card, customer) {
  const token = await getAccessToken();
  const stamps = card.stamps || 0;
  const objectId = `${ISSUER_ID}.card_${card.id.replace(/-/g, '_')}`;

  const objectBody = {
    id: objectId,
    classId: CLASS_ID,
    state: 'active',
    accountName: customer.name,
    accountId: card.id.substring(0, 8).toUpperCase(),
    loyaltyPoints: {
      label: '飲 Tampons',
      balance: { int: stamps }
    },
    secondaryLoyaltyPoints: {
      label: 'Ramens offerts',
      balance: { int: card.rewards_earned || 0 }
    },
    textModulesData: [
      {
        header: stamps >= STAMPS_FOR_REWARD ? '🍜 RAMEN OFFERT !' : 'Progression',
        body: stamps >= STAMPS_FOR_REWARD
          ? 'Montre ta carte en caisse'
          : `${stamps} / ${STAMPS_FOR_REWARD} tampons — encore ${STAMPS_FOR_REWARD - stamps}`,
        id: 'progress'
      }
    ],
    barcode: {
      type: 'QR_CODE',
      value: card.id,
      alternateText: card.id.substring(0, 8).toUpperCase()
    },
    hexBackgroundColor: '#1a1e5a'
  };

  try {
    const res = await axios.post(
      'https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject',
      objectBody,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log(`✅ Google Wallet Object créé pour ${customer.name}`);
    return objectId;
  } catch (err) {
    if (err.response?.status === 409) {
      console.log('ℹ️ Object déjà existant');
      return objectId;
    }
    throw err;
  }
}

// ── Update Loyalty Object (after stamp) ──────────────────────────────────────
async function updateLoyaltyObject(card, customer) {
  const token = await getAccessToken();
  const stamps = card.stamps || 0;
  const objectId = `${ISSUER_ID}.card_${card.id.replace(/-/g, '_')}`;

  const patch = {
    loyaltyPoints: {
      label: '飲 Tampons',
      balance: { int: stamps }
    },
    textModulesData: [
      {
        header: stamps >= STAMPS_FOR_REWARD ? '🍜 RAMEN OFFERT !' : 'Progression',
        body: stamps >= STAMPS_FOR_REWARD
          ? 'Montre ta carte en caisse !'
          : `${stamps} / ${STAMPS_FOR_REWARD} tampons — encore ${STAMPS_FOR_REWARD - stamps}`,
        id: 'progress'
      }
    ]
  };

  try {
    await axios.patch(
      `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${objectId}`,
      patch,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log(`✅ Wallet mis à jour: ${customer.name} — ${stamps}/${STAMPS_FOR_REWARD}`);
  } catch (err) {
    console.error('Wallet update error:', err.response?.data || err.message);
  }
}

// ── Generate "Add to Google Wallet" JWT link ──────────────────────────────────
async function generateWalletLink(card, customer) {
  const jwt = require('jsonwebtoken');
  const key = require(require('path').resolve(KEY_FILE));
  const objectId = `${ISSUER_ID}.card_${card.id.replace(/-/g, '_')}`;

  const claims = {
    iss: key.client_email,
    aud: 'google',
    typ: 'savetowallet',
    iat: Math.floor(Date.now() / 1000),
    payload: {
      loyaltyObjects: [{ id: objectId }]
    }
  };

  const token = jwt.sign(claims, key.private_key, { algorithm: 'RS256' });
  return `https://pay.google.com/gp/v/save/${token}`;
}

module.exports = { createLoyaltyClass, createLoyaltyObject, updateLoyaltyObject, generateWalletLink };
