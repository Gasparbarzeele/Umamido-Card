require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const db = require('./db');
const { createLoyaltyClass, createLoyaltyObject, updateLoyaltyObject, generateWalletLink } = require('./googleWallet');

const app = express();
const PORT = process.env.PORT || 3000;
const STAMPS_FOR_REWARD = 10;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Init Google Wallet class on startup
if (process.env.GOOGLE_ISSUER_ID) {
  createLoyaltyClass().catch(err => console.error('Wallet class error:', err.message));
}

// ── Pages ────────────────────────────────────────────────────────────────────
app.get('/join',       (req, res) => res.sendFile(path.join(__dirname, '../public/client/index.html')));
app.get('/card/:id',   (req, res) => res.sendFile(path.join(__dirname, '../public/client/card.html')));
app.get('/ipad',       (req, res) => res.sendFile(path.join(__dirname, '../public/ipad/index.html')));

// ── Inscription client ───────────────────────────────────────────────────────
app.post('/api/join', async (req, res) => {
  const { name, email, phone } = req.body;
  if (!name || (!email && !phone)) return res.status(400).json({ error: 'Nom et contact requis' });

  try {
    let customer = email ? await db.get_('SELECT * FROM customers WHERE email = ?', [email]) : null;
    if (!customer) {
      const customerId = uuidv4();
      await db.run_('INSERT INTO customers (id, name, email, phone) VALUES (?, ?, ?, ?)', [customerId, name, email||null, phone||null]);
      customer = await db.get_('SELECT * FROM customers WHERE id = ?', [customerId]);
      const cardId = uuidv4();
      await db.run_('INSERT INTO cards (id, customer_id) VALUES (?, ?)', [cardId, customerId]);
    }

    const card = await db.get_('SELECT * FROM cards WHERE customer_id = ?', [customer.id]);

    // Créer l'objet Google Wallet
    let walletUrl = `${BASE_URL}/card/${card.id}`;
    if (process.env.GOOGLE_ISSUER_ID) {
      try {
        await createLoyaltyObject(card, customer);
        walletUrl = await generateWalletLink(card, customer);
      } catch(e) {
        console.error('Google Wallet error:', e.message);
      }
    }

    res.json({
      success: true,
      customer: { id: customer.id, name: customer.name },
      card: { id: card.id, stamps: card.stamps },
      walletUrl,
      dashboardUrl: `${BASE_URL}/card/${card.id}`
    });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── Données carte ────────────────────────────────────────────────────────────
app.get('/api/card/:cardId', async (req, res) => {
  const card = await db.get_('SELECT * FROM cards WHERE id = ?', [req.params.cardId]);
  if (!card) return res.status(404).json({ error: 'Carte introuvable' });
  const customer = await db.get_('SELECT * FROM customers WHERE id = ?', [card.customer_id]);
  const transactions = await db.all_('SELECT * FROM transactions WHERE card_id = ? ORDER BY created_at DESC LIMIT 20', [card.id]);
  res.json({ card, customer, transactions });
});

// ── NFC Stamp — déclenché par le tag NFC caisse ───────────────────────────────
app.get('/api/nfc/stamp/:cardId', async (req, res) => {
  const card = await db.get_('SELECT * FROM cards WHERE id = ?', [req.params.cardId]);
  if (!card) return res.redirect(`${BASE_URL}/join`);

  const customer = await db.get_('SELECT * FROM customers WHERE id = ?', [card.customer_id]);

  // Limite 1 tampon par jour
  const today = new Date().toISOString().split('T')[0];
  const lastStamp = await db.get_(
    `SELECT * FROM transactions WHERE card_id = ? AND action = 'stamp' AND date(created_at) = ? LIMIT 1`,
    [card.id, today]
  );

  if (lastStamp) {
    return res.redirect(`${BASE_URL}/card/${card.id}?msg=already_stamped`);
  }

  // Carte pleine → récompense
  if (card.stamps >= STAMPS_FOR_REWARD) {
    return res.redirect(`${BASE_URL}/card/${card.id}?msg=redeem`);
  }

  // Ajouter le tampon
  const newStamps = card.stamps + 1;
  const newTotal = (card.total_stamps || 0) + 1;
  await db.run_('UPDATE cards SET stamps = ?, total_stamps = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStamps, newTotal, card.id]);
  await db.run_('INSERT INTO transactions (card_id, action, staff_id) VALUES (?, ?, ?)', [card.id, 'stamp', 'nfc']);

  // Mettre à jour Google Wallet
  const updatedCard = await db.get_('SELECT * FROM cards WHERE id = ?', [card.id]);
  if (process.env.GOOGLE_ISSUER_ID) {
    updateLoyaltyObject(updatedCard, customer).catch(console.error);
  }

  console.log(`🦊 NFC Tampon: ${customer.name} — ${newStamps}/${STAMPS_FOR_REWARD}`);
  res.redirect(`${BASE_URL}/card/${card.id}?msg=stamped&count=${newStamps}`);
});

// ── Login staff ───────────────────────────────────────────────────────────────
app.post('/api/staff/login', async (req, res) => {
  const staff = await db.get_('SELECT * FROM staff WHERE pin = ? AND active = 1', [req.body.pin]);
  if (!staff) return res.status(401).json({ error: 'PIN incorrect' });
  res.json({ success: true, staff: { id: staff.id, name: staff.name, role: staff.role } });
});

// ── Scan carte ────────────────────────────────────────────────────────────────
app.get('/api/staff/scan/:cardId', async (req, res) => {
  const card = await db.get_('SELECT * FROM cards WHERE id = ?', [req.params.cardId]);
  if (!card) return res.status(404).json({ error: 'Carte introuvable' });
  const customer = await db.get_('SELECT * FROM customers WHERE id = ?', [card.customer_id]);
  res.json({
    card: { id: card.id, stamps: card.stamps, total_stamps: card.total_stamps, rewards_earned: card.rewards_earned },
    customer: { name: customer.name, member_since: customer.created_at },
    can_redeem: card.stamps >= STAMPS_FOR_REWARD
  });
});

// ── Ajouter tampon (iPad) ─────────────────────────────────────────────────────
app.post('/api/staff/stamp/:cardId', async (req, res) => {
  const card = await db.get_('SELECT * FROM cards WHERE id = ?', [req.params.cardId]);
  if (!card) return res.status(404).json({ error: 'Carte introuvable' });
  if (card.stamps >= STAMPS_FOR_REWARD) return res.status(400).json({ error: 'Carte pleine' });

  const newStamps = card.stamps + 1;
  const newTotal = (card.total_stamps || 0) + 1;
  await db.run_('UPDATE cards SET stamps = ?, total_stamps = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStamps, newTotal, card.id]);
  await db.run_('INSERT INTO transactions (card_id, action, staff_id) VALUES (?, ?, ?)', [card.id, 'stamp', req.body.staffId||'staff']);

  const customer = await db.get_('SELECT * FROM customers WHERE id = ?', [card.customer_id]);
  const updatedCard = await db.get_('SELECT * FROM cards WHERE id = ?', [card.id]);
  if (process.env.GOOGLE_ISSUER_ID) {
    updateLoyaltyObject(updatedCard, customer).catch(console.error);
  }

  res.json({
    success: true, stamps: newStamps, total: newTotal,
    reward: newStamps >= STAMPS_FOR_REWARD,
    message: newStamps >= STAMPS_FOR_REWARD ? '🎉 Récompense débloquée !' : `${newStamps}/${STAMPS_FOR_REWARD} tampons`
  });
});

// ── Valider récompense ────────────────────────────────────────────────────────
app.post('/api/staff/redeem/:cardId', async (req, res) => {
  const card = await db.get_('SELECT * FROM cards WHERE id = ?', [req.params.cardId]);
  if (!card) return res.status(404).json({ error: 'Carte introuvable' });
  if (card.stamps < STAMPS_FOR_REWARD) return res.status(400).json({ error: 'Pas assez de tampons' });

  await db.run_('UPDATE cards SET stamps = 0, rewards_earned = rewards_earned + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [card.id]);
  await db.run_('INSERT INTO transactions (card_id, action, staff_id) VALUES (?, ?, ?)', [card.id, 'redeem', req.body.staffId||'staff']);

  const customer = await db.get_('SELECT * FROM customers WHERE id = ?', [card.customer_id]);
  const updatedCard = await db.get_('SELECT * FROM cards WHERE id = ?', [card.id]);
  if (process.env.GOOGLE_ISSUER_ID) {
    updateLoyaltyObject(updatedCard, customer).catch(console.error);
  }

  res.json({ success: true, message: '🍜 Ramen offert validé !' });
});

// ── Stats ─────────────────────────────────────────────────────────────────────
app.get('/api/admin/stats', async (req, res) => {
  const totalCustomers = (await db.get_('SELECT COUNT(*) as count FROM customers', [])).count;
  const totalStamps    = (await db.get_('SELECT SUM(total_stamps) as total FROM cards', [])).total || 0;
  const totalRewards   = (await db.get_('SELECT SUM(rewards_earned) as total FROM cards', [])).total || 0;
  const recentActivity = await db.all_(`
    SELECT t.*, cu.name as customer_name FROM transactions t
    JOIN cards ca ON t.card_id = ca.id
    JOIN customers cu ON ca.customer_id = cu.id
    ORDER BY t.created_at DESC LIMIT 10`, []);
  res.json({ totalCustomers, totalStamps, totalRewards, recentActivity });
});

app.listen(PORT, () => {
  console.log(`
🦊 ================================
   UMAMIDO LOYALTY SERVER
   ${BASE_URL}
================================
   /join      → Inscription client
   /card/:id  → Carte client
   /ipad      → Interface caisse
   /api/nfc/stamp/:id → NFC tag
================================
  `);
});

// ── Dynamic card image ────────────────────────────────────────────────────────
app.get('/api/card-image/:cardId', async (req, res) => {
  try {
    const card = await db.get_('SELECT * FROM cards WHERE id = ?', [req.params.cardId]);
    if (!card) return res.status(404).send();
    const { generateCardSVG } = require('./cardImage');
    const svg = generateCardSVG(card.stamps || 0, card.id);
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(svg);
  } catch(e) {
    console.error('Card image error:', e.message);
    res.status(500).send();
  }
});
