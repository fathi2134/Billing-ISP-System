#!/usr/bin/env node
/**
 * Generate tagihan bulanan = satu baris per customer per periode (bulan + tahun).
 *
 * Alur: "setiap bulan generate tagihan April 2026 untuk semua customer"
 *   → default bulan/tahun = sekarang, atau: --bulan=4 --tahun=2026
 *
 * Hanya untuk customer yang punya subscription terakhir + billing_profiles.final_price > 0.
 *
 * Usage:
 *   npm run generate-tagihan
 *   node scripts/generate-tagihan.js --bulan=4 --tahun=2026
 *   node scripts/generate-tagihan.js --bulan=4 --tahun=2026 --customer_id=1
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { generateTagihanForPeriod } = require('../src/services/tagihanGenerator');
const { pool } = require('../src/config/database');

function parseArgs() {
  const out = {};
  for (const a of process.argv.slice(2)) {
    const m = /^--([^=]+)=(.*)$/.exec(a);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function main() {
  const args = parseArgs();
  const now = new Date();
  const bulan = args.bulan != null ? parseInt(args.bulan, 10) : now.getMonth() + 1;
  const tahun = args.tahun != null ? parseInt(args.tahun, 10) : now.getFullYear();
  const customerId =
    args.customer_id != null && args.customer_id !== ''
      ? parseInt(args.customer_id, 10)
      : undefined;

  if (!Number.isFinite(bulan) || bulan < 1 || bulan > 12) {
    console.error('Bulan harus 1-12');
    process.exit(1);
  }
  if (!Number.isFinite(tahun)) {
    console.error('Tahun tidak valid');
    process.exit(1);
  }
  if (customerId !== undefined && !Number.isFinite(customerId)) {
    console.error('customer_id tidak valid');
    process.exit(1);
  }

  const result = await generateTagihanForPeriod({
    bulan,
    tahun,
    customerId: Number.isFinite(customerId) ? customerId : undefined,
  });

  for (const d of result.details) {
    if (d.status === 'created') {
      console.log(`+ Tagihan ${d.nama} (${bulan}/${tahun}) Rp ${d.nominal}`);
    } else {
      console.log(`= Skip (sudah ada) ${d.nama} (${bulan}/${tahun})`);
    }
  }

  console.log(`\nSelesai. Dibuat: ${result.created}, dilewati (duplikat): ${result.skipped}`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
