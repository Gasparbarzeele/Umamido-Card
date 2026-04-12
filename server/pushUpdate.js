const http2 = require('http2');
const fs = require('fs');
const path = require('path');
const { db } = require('./database');

const CERTS_DIR = path.join(__dirname, '../certs');

/**
 * Envoie une notification push à Apple
 * Apple va ensuite appeler notre endpoint GET /passes/:passTypeId/:serialNumber
 * pour récupérer le pass mis à jour
 */
async function sendPushUpdate(customerId) {
  const tokens = db.getPushTokens(customerId);
  if (!tokens.length) {
    console.log(`Pas de device enregistré pour ${customerId}`);
    return;
  }

  for (const { push_token } of tokens) {
    try {
      await apnsPush(push_token);
      console.log(`✅ Push envoyé pour ${customerId} → ${push_token}`);
    } catch (err) {
      console.error(`❌ Push échoué pour ${customerId}:`, err.message);
    }
  }
}

/**
 * Envoie une notification APNS (Apple Push Notification Service)
 * Pour les passes Wallet, le payload est vide {} — Apple sait quoi faire
 */
function apnsPush(pushToken) {
  return new Promise((resolve, reject) => {
    // Certificat pour APNS
    const cert = fs.readFileSync(path.join(CERTS_DIR, 'signerCert.pem'));
    const key = fs.readFileSync(path.join(CERTS_DIR, 'signerKey.pem'));

    const client = http2.connect('https://api.push.apple.com', { cert, key });

    client.on('error', reject);

    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${pushToken}`,
      'apns-topic': process.env.PASS_TYPE_ID, // ex: pass.com.umamido.loyalty
      'apns-push-type': 'background',
      'content-type': 'application/json',
    });

    req.write(JSON.stringify({})); // Payload vide pour les Wallet passes
    req.end();

    req.on('response', (headers) => {
      const status = headers[':status'];
      client.close();
      if (status === 200) {
        resolve();
      } else {
        reject(new Error(`APNS status: ${status}`));
      }
    });

    req.on('error', reject);
  });
}

module.exports = { sendPushUpdate };
