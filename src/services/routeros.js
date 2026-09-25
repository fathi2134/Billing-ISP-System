const { RouterOSAPI } = require('node-routeros');
require('dotenv').config();

function createApi() {
  return new RouterOSAPI({
    host: process.env.MIKROTIK_HOST || '192.168.88.1',
    user: process.env.MIKROTIK_USER || 'api',
    password: process.env.MIKROTIK_PASSWORD || '',
    port: Number(process.env.MIKROTIK_PORT) || 8728,
  });
}

/**
 * Set profile PPPoE secret berdasarkan username (name di /ppp/secret).
 */
async function setPppoeProfile(username, profileName) {
  const conn = createApi();
  await conn.connect();
  try {
    const rows = await conn.write('/ppp/secret/print', [`?name=${username}`]);
    if (!rows || !rows.length) {
      throw new Error(`PPPoE secret tidak ditemukan: ${username}`);
    }
    const id = rows[0]['.id'];
    await conn.write('/ppp/secret/set', [`=.id=${id}`, `=profile=${profileName}`]);
  } finally {
    conn.close();
  }
}

/**
 * Set profile user Hotspot berdasarkan username (/ip/hotspot/user).
 */
async function setHotspotUserProfile(username, profileName) {
  const conn = createApi();
  await conn.connect();
  try {
    const rows = await conn.write('/ip/hotspot/user/print', [`?name=${username}`]);
    if (!rows || !rows.length) {
      throw new Error(`Hotspot user tidak ditemukan: ${username}`);
    }
    const id = rows[0]['.id'];
    await conn.write('/ip/hotspot/user/set', [`=.id=${id}`, `=profile=${profileName}`]);
  } finally {
    conn.close();
  }
}

/**
 * Ganti profile di MikroTik sesuai tipe pelanggan.
 */
async function applyProfile({ tipe, username_mikrotik, profile }) {
  if (tipe === 'PPPoE') {
    await setPppoeProfile(username_mikrotik, profile);
  } else if (tipe === 'Hotspot') {
    await setHotspotUserProfile(username_mikrotik, profile);
  } else {
    throw new Error(`Tipe tidak dikenal: ${tipe}`);
  }
}

module.exports = {
  setPppoeProfile,
  setHotspotUserProfile,
  applyProfile,
};
