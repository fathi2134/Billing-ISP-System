/**
 * Generate baris tagihan periode (bulan/tahun) dari subscription terakhir + billing_profiles.final_price.
 *
 * Contoh alur: "April 2026 untuk customer X" → bulan=4, tahun=2026, customerId=X (opsional).
 */

const { pool } = require('../config/database');

const BASE_SQL = `
  SELECT c.id, c.full_name AS nama, bp.final_price AS nominal
  FROM customer c
  INNER JOIN (
    SELECT s.customer_id, s.billing_profile_id
    FROM subscriptions s
    INNER JOIN (
      SELECT customer_id, MAX(id) AS max_id
      FROM subscriptions
      GROUP BY customer_id
    ) sm ON sm.customer_id = s.customer_id AND sm.max_id = s.id
  ) ls ON ls.customer_id = c.id
  INNER JOIN billing_profiles bp ON bp.id = ls.billing_profile_id
  WHERE bp.final_price > 0
`;

/**
 * @param {{ customerId?: number }} [opts]
 * @returns {Promise<Array<{id:number,nama:string,nominal:string}>>}
 */
async function listCustomersWithTarif(opts = {}) {
  const customerId = opts.customerId;
  let sql = BASE_SQL;
  const params = [];
  if (customerId != null && Number.isFinite(Number(customerId))) {
    sql += ' AND c.id = ?';
    params.push(Number(customerId));
  }
  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * Insert tagihan untuk setiap customer (atau satu customer) untuk periode bulan/tahun.
 * @param {{ bulan: number, tahun: number, customerId?: number }} period
 * @returns {Promise<{ created: number, skipped: number, details: Array<{nama:string,status:string}> }>}
 */
async function generateTagihanForPeriod(period) {
  const bulan = Number(period.bulan);
  const tahun = Number(period.tahun);
  if (bulan < 1 || bulan > 12) {
    throw new Error('bulan harus 1-12');
  }
  if (!Number.isFinite(tahun) || tahun < 2000 || tahun > 2100) {
    throw new Error('tahun tidak valid');
  }

  const rows = await listCustomersWithTarif(
    period.customerId != null ? { customerId: period.customerId } : {}
  );

  let created = 0;
  let skipped = 0;
  const details = [];

  for (const p of rows) {
    try {
      await pool.query(
        `INSERT INTO tagihan (customer_id, bulan, tahun, nominal, status_bayar)
         VALUES (?, ?, ?, ?, 'belum')`,
        [p.id, bulan, tahun, p.nominal]
      );
      created++;
      details.push({ customer_id: p.id, nama: p.nama, status: 'created', nominal: p.nominal });
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') {
        skipped++;
        details.push({ customer_id: p.id, nama: p.nama, status: 'duplicate' });
      } else {
        throw e;
      }
    }
  }

  return { created, skipped, details };
}

module.exports = {
  listCustomersWithTarif,
  generateTagihanForPeriod,
};
