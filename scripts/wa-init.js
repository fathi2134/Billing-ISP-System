#!/usr/bin/env node
/**
 * Jalankan sekali untuk scan QR WhatsApp (session disimpan di .wwebjs_auth).
 * Biarkan proses tetap hidup setelah "Client siap" — atau Ctrl+C setelah scan jika sudah login.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { ensureReady } = require('../src/services/whatsapp');

ensureReady()
  .then(() => {
    console.log('\nSession WhatsApp siap. Tutup dengan Ctrl+C jika hanya ingin menyimpan session.');
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
