const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { attachMessageAck } = require('./whatsappAck');

let client = null;
let readyPromise = null;
let currentStatus = 'DISCONNECTED';
let currentQr = null;

function getWhatsAppClient() {
  if (client) return client;

  currentStatus = 'INITIALIZING';
  currentQr = null;

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  attachMessageAck(client);

  client.on('qr', (qr) => {
    currentStatus = 'QR_READY';
    currentQr = qr;
    console.log('\n[WhatsApp] Scan QR code dengan aplikasi WhatsApp di HP:\n');
    qrcode.generate(qr, { small: true });
  });

  client.on('ready', () => {
    currentStatus = 'READY';
    currentQr = null;
    console.log('[WhatsApp] Client siap mengirim pesan.');
  });

  client.on('authenticated', () => {
    currentStatus = 'AUTHENTICATED';
    currentQr = null;
    console.log('[WhatsApp] Autentikasi berhasil.');
  });

  client.on('auth_failure', (m) => {
    currentStatus = 'DISCONNECTED';
    currentQr = null;
    console.error('[WhatsApp] Gagal autentikasi:', m);
  });

  client.on('disconnected', (reason) => {
    currentStatus = 'DISCONNECTED';
    currentQr = null;
    console.warn('[WhatsApp] Terputus:', reason);
    client = null;
    readyPromise = null;
  });

  return client;
}

function resetClient() {
  client = null;
  readyPromise = null;
}

function normalizeWaId(raw) {
  let n = String(raw).replace(/\D/g, '');
  if (n.startsWith('0')) n = '62' + n.slice(1);
  if (!n.startsWith('62')) n = '62' + n;
  return `${n}@c.us`;
}

async function ensureReady() {
  const c = getWhatsAppClient();
  if (!readyPromise) {
    // Tunggu event 'ready', bukan hanya resolve initialize() —
    // initialize() bisa resolve sebelum client benar-benar siap kirim pesan.
    readyPromise = new Promise((resolve, reject) => {
      if (currentStatus === 'READY') {
        resolve(c);
        return;
      }
      function onReady() {
        c.off('auth_failure', onFail);
        resolve(c);
      }
      function onFail(msg) {
        c.off('ready', onReady);
        reject(new Error(`WhatsApp auth gagal: ${msg}. Scan ulang QR di menu WhatsApp.`));
      }
      c.once('ready', onReady);
      c.once('auth_failure', onFail);
      c.initialize().catch((err) => {
        c.off('ready', onReady);
        c.off('auth_failure', onFail);
        reject(err);
      });
    });
  }
  await readyPromise;
  return c;
}

/**
 * Kirim pesan teks ke nomor WA (format bebas, akan dinormalisasi ke 62...)
 */
async function sendText(toWaNumber, message) {
  if (currentStatus === 'DISCONNECTED' || currentStatus === 'QR_READY') {
    throw new Error(
      `WhatsApp belum terhubung (status: ${currentStatus}). ` +
      `Scan QR terlebih dahulu di menu WhatsApp.`
    );
  }

  const chatId = normalizeWaId(toWaNumber);

  // Retry sekali jika puppeteer/WA session sempat putus (mis. detached Frame)
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const c = await ensureReady();
      return await c.sendMessage(chatId, message);
    } catch (e) {
      console.error('[WhatsApp] sendText error (attempt ' + attempt + '):', e?.message || e);
      // Hanya retry jika error adalah detached Frame (puppeteer crash sementara)
      if (attempt === 1 && (e?.message?.includes('detached') || e?.message?.includes('Session'))) {
        resetClient();
        continue;
      }
      throw e;
    }
  }
}

function getStatus() {
  return { status: currentStatus, qr: currentQr };
}

async function logout() {
  if (client) {
    await client.logout().catch(() => {});
    resetClient();
  }
}

module.exports = {
  getWhatsAppClient,
  ensureReady,
  sendText,
  getStatus,
  logout,
};
