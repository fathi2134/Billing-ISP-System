/**
 * customerRepository.js
 * Semua query database untuk modul customer detail.
 * Menggunakan mysql2 pool yang sudah ada — tidak perlu Prisma.
 */

const { pool } = require('../config/database');

// ── List semua customers (with pagination) ───────────────────
async function findAllCustomers({ limit, offset, search } = {}) {
  const term = (search || '').trim();
  const hasSearch = term.length > 0;
  const like = `%${term}%`;

  const whereSql = hasSearch
    ? `WHERE c.full_name LIKE ?
          OR c.whatsapp_number LIKE ?
          OR c.customer_code LIKE ?
          OR ia.username LIKE ?`
    : '';
  const whereParams = hasSearch ? [like, like, like, like] : [];

  const countSql = `
    SELECT COUNT(*) AS total
    FROM customer c
    LEFT JOIN internet_accounts ia ON ia.customer_id = c.id
      AND ia.id = (SELECT id FROM internet_accounts WHERE customer_id = c.id ORDER BY FIELD(status,'active','isolated','disabled'), id DESC LIMIT 1)
    ${whereSql}`;
  const [[{ total }]] = await pool.query(countSql, whereParams);

  let sql = `SELECT
       c.id, c.customer_code, c.full_name, c.whatsapp_number, c.email, c.address, c.created_at,
       ia.status AS internet_status, ia.type AS internet_type, ia.username,
       bp.profile_name, bp.final_price
     FROM customer c
     LEFT JOIN internet_accounts ia ON ia.customer_id = c.id
       AND ia.id = (SELECT id FROM internet_accounts WHERE customer_id = c.id ORDER BY FIELD(status,'active','isolated','disabled'), id DESC LIMIT 1)
     LEFT JOIN subscriptions s ON s.customer_id = c.id
       AND s.id = (SELECT id FROM subscriptions WHERE customer_id = c.id ORDER BY id DESC LIMIT 1)
     LEFT JOIN billing_profiles bp ON bp.id = s.billing_profile_id
     ${whereSql}
     ORDER BY c.id DESC`;
  const params = [...whereParams];
  if (limit != null) {
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset || 0);
  }
  const [rows] = await pool.query(sql, params);
  return { data: rows, total };
}

// ── Customer by ID ────────────────────────────────────────────
async function findCustomerById(id) {
  const [rows] = await pool.query(
    'SELECT * FROM customer WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0] ?? null;
}

// ── Create customer ───────────────────────────────────────────
async function createCustomer(data, conn) {
  const db = conn || pool;
  const [result] = await db.query(
    `INSERT INTO customer (customer_code, full_name, whatsapp_number, email, id_card_number, address, map_link)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.customer_code, data.full_name, data.whatsapp_number, data.email || null,
     data.id_card_number || null, data.address || null, data.map_link || null]
  );
  return result.insertId;
}

// ── Create internet account ───────────────────────────────────
async function createInternetAccount(data, conn) {
  const db = conn || pool;
  const [result] = await db.query(
    `INSERT INTO internet_accounts (customer_id, type, username, ip_address, nas_name, service_name, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.customer_id, data.type, data.username, data.ip_address || null,
     data.nas_name || null, data.service_name || null, data.status || 'active']
  );
  return result.insertId;
}

// ── Create subscription ───────────────────────────────────────
async function createSubscription(data, conn) {
  const db = conn || pool;
  const [result] = await db.query(
    `INSERT INTO subscriptions (customer_id, internet_account_id, billing_profile_id, payment_type, billing_cycle, next_invoice_date)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [data.customer_id, data.internet_account_id, data.billing_profile_id,
     data.payment_type, data.billing_cycle, data.next_invoice_date]
  );
  return result.insertId;
}

// ── Update customer ───────────────────────────────────────────
async function updateCustomer(id, data, conn) {
  const db = conn || pool;
  const fields = ['full_name','whatsapp_number','email','id_card_number','address','map_link'];
  const sets = [], vals = [];
  for (const f of fields) {
    if (data[f] !== undefined) { sets.push(`${f} = ?`); vals.push(data[f]); }
  }
  if (!sets.length) return 0;
  vals.push(id);
  const [result] = await db.query(`UPDATE customer SET ${sets.join(', ')} WHERE id = ?`, vals);
  return result.affectedRows;
}

// ── Update internet account ───────────────────────────────────
async function updateInternetAccount(id, data, conn) {
  const db = conn || pool;
  const fields = ['type','username','ip_address','nas_name','service_name','status'];
  const sets = [], vals = [];
  for (const f of fields) {
    if (data[f] !== undefined) { sets.push(`${f} = ?`); vals.push(data[f]); }
  }
  if (!sets.length) return 0;
  vals.push(id);
  const [result] = await db.query(`UPDATE internet_accounts SET ${sets.join(', ')} WHERE id = ?`, vals);
  return result.affectedRows;
}

// ── Update subscription ───────────────────────────────────────
async function updateSubscription(id, data, conn) {
  const db = conn || pool;
  const fields = ['billing_profile_id','payment_type','billing_cycle','next_invoice_date'];
  const sets = [], vals = [];
  for (const f of fields) {
    if (data[f] !== undefined) { sets.push(`${f} = ?`); vals.push(data[f]); }
  }
  if (!sets.length) return 0;
  vals.push(id);
  const [result] = await db.query(`UPDATE subscriptions SET ${sets.join(', ')} WHERE id = ?`, vals);
  return result.affectedRows;
}

// ── Delete customer (cascade ke internet_accounts, subscriptions, invoices, payments) ──
async function deleteCustomer(id) {
  const [result] = await pool.query('DELETE FROM customer WHERE id = ?', [id]);
  return result.affectedRows;
}

// ── All billing profiles (untuk dropdown form) ───────────────
async function findAllBillingProfiles() {
  const [rows] = await pool.query('SELECT * FROM billing_profiles ORDER BY final_price ASC');
  return rows;
}

// ── Internet account by customer_id ──────────────────────────
async function findInternetAccountByCustomerId(customerId) {
  const [rows] = await pool.query(
    `SELECT * FROM internet_accounts
     WHERE customer_id = ?
     ORDER BY FIELD(status, 'active', 'isolated', 'disabled'), id DESC
     LIMIT 1`,
    [customerId]
  );
  return rows[0] ?? null;
}

// ── Subscription + billing profile ───────────────────────────
async function findSubscriptionWithProfile(customerId, internetAccountId) {
  const [rows] = await pool.query(
    `SELECT
       s.id, s.customer_id, s.internet_account_id, s.billing_profile_id,
       s.payment_type, s.billing_cycle, s.next_invoice_date, s.created_at,
       bp.profile_name, bp.speed, bp.base_price, bp.discount, bp.tax_percent, bp.final_price
     FROM subscriptions s
     JOIN billing_profiles bp ON bp.id = s.billing_profile_id
     WHERE s.customer_id = ? AND s.internet_account_id = ?
     ORDER BY s.id DESC LIMIT 1`,
    [customerId, internetAccountId]
  );
  return rows[0] ?? null;
}

// ── Invoices by subscription_id ───────────────────────────────
async function findInvoicesBySubscriptionId(subscriptionId) {
  const [rows] = await pool.query(
    'SELECT * FROM invoices WHERE subscription_id = ? ORDER BY created_at DESC',
    [subscriptionId]
  );
  return rows;
}

// ── Payments by invoice IDs ───────────────────────────────────
async function findPaymentsByInvoiceIds(invoiceIds) {
  if (!invoiceIds.length) return [];
  const placeholders = invoiceIds.map(() => '?').join(', ');
  const [rows] = await pool.query(
    `SELECT * FROM payments WHERE invoice_id IN (${placeholders}) ORDER BY payment_date DESC`,
    invoiceIds
  );
  return rows;
}

module.exports = {
  findAllCustomers,
  findCustomerById,
  createCustomer,
  createInternetAccount,
  createSubscription,
  updateCustomer,
  updateInternetAccount,
  updateSubscription,
  deleteCustomer,
  findAllBillingProfiles,
  findInternetAccountByCustomerId,
  findSubscriptionWithProfile,
  findInvoicesBySubscriptionId,
  findPaymentsByInvoiceIds,
};
