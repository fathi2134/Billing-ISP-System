const express = require('express');
const { getStatus, ensureReady, logout } = require('../services/whatsapp');

const router = express.Router();

router.get('/status', async (req, res) => {
  let st = getStatus();
  if (st.status === 'DISCONNECTED') {
    // Trigger WhatsApp client initialization in the background
    ensureReady().catch(console.error);
    st.status = 'INITIALIZING';
  }
  res.json(st);
});

router.post('/logout', async (req, res) => {
  try {
    await logout();
    res.json({ message: 'WhatsApp session reset' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;