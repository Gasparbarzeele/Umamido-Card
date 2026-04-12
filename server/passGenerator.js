// server/passGenerator.js — Génération des passes Apple Wallet
const { PKPass } = require('passkit-generator');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const STAMPS_FOR_REWARD = 10;

// Template de base du pass Apple Wallet
function getPassJSON(customer, card) {
  const stamps = card.stamps || 0;
  const remaining = STAMPS_FOR_REWARD - stamps;

  return {
    formatVersion: 1,
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
    serialNumber: card.id,
    teamIdentifier: process.env.APPLE_TEAM_ID,
    webServiceURL: `${process.env.BASE_URL}/api/wallet/`,
    authenticationToken: card.id,

    organizationName: 'Umamido',
    description: 'Carte de Fidélité Umamido',
    logoText: 'UMAMIDO',

    foregroundColor: 'rgb(255, 255, 255)',
    backgroundColor: 'rgb(26, 30, 90)',
    labelColor: 'rgb(232, 70, 30)',

    // Type: Stamp Card (on utilise storeCard)
    storeCard: {
      headerFields: [
        {
          key: 'stamps',
          label: '判子 TAMPONS',
          value: `${stamps} / ${STAMPS_FOR_REWARD}`,
          textAlignment: 'PKTextAlignmentRight'
        }
      ],
      primaryFields: [
        {
          key: 'member',
          label: 'MEMBRE',
          value: customer.name || 'Client Umamido'
        }
      ],
      secondaryFields: [
        {
          key: 'reward',
          label: 'RÉCOMPENSE',
          value: stamps >= STAMPS_FOR_REWARD
            ? '🍜 1 RAMEN OFFERT !'
            : `Encore ${remaining} tampon${remaining > 1 ? 's' : ''}`
        }
      ],
      auxiliaryFields: [
        {
          key: 'loyalty',
          label: 'PROGRAMME',
          value: 'うまみ道 Fidélité'
        },
        {
          key: 'total',
          label: 'TOTAL VISITES',
          value: `${card.total_stamps || 0}`
        }
      ],
      backFields: [
        {
          key: 'info',
          label: 'Comment ça marche ?',
          value: 'À chaque visite, montre ta carte à la caisse. Après 10 tampons, tu reçois 1 ramen offert !'
        },
        {
          key: 'contact',
          label: 'Contact',
          value: 'contact@umamido.fr'
        },
        {
          key: 'address',
          label: 'Adresse',
          value: 'Umamido — Paris'
        }
      ]
    },

    barcode: {
      message: card.id,
      format: 'PKBarcodeFormatQR',
      messageEncoding: 'iso-8859-1',
      altText: card.id.substring(0, 8).toUpperCase()
    },

    barcodes: [
      {
        message: card.id,
        format: 'PKBarcodeFormatQR',
        messageEncoding: 'iso-8859-1'
      }
    ]
  };
}

async function generatePass(customer, card) {
  try {
    const certPath = path.resolve(process.env.APPLE_CERT_PATH);
    const keyPath = path.resolve(process.env.APPLE_KEY_PATH);
    const wwdrPath = path.resolve(process.env.APPLE_WWDR_PATH);

    // Vérifier que les certs existent
    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath) || !fs.existsSync(wwdrPath)) {
      throw new Error('Certificats Apple manquants. Voir le guide SETUP.md');
    }

    const pass = await PKPass.from(
      {
        model: path.resolve('./passes/umamido.pass'),
        certificates: {
          wwdr: wwdrPath,
          signerCert: certPath,
          signerKey: keyPath,
          signerKeyPassphrase: process.env.APPLE_KEY_PASSPHRASE
        }
      },
      getPassJSON(customer, card)
    );

    return pass.getAsBuffer();
  } catch (err) {
    console.error('Erreur génération pass:', err.message);
    throw err;
  }
}

module.exports = { generatePass, getPassJSON };
