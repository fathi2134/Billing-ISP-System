/**
 * customerService.js
 * Business logic untuk modul customer detail.
 */

const repo = require('../repositories/customerRepository');
const { pool } = require('../config/database');

// ── List semua customers (with pagination) ───────────────────
async function getAllCustomers({ limit, offset, search } = {}) {
  return repo.findAllCustomers({ limit, offset, search });
}

// ── Semua billing profiles (untuk dropdown) ───────────────────
async function getAllBillingProfiles() {
  return repo.findAllBillingProfiles();
}

// ── Buat pelanggan baru (customer + internet_account + subscription) ──
async function createCustomer(body) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const customer_code = body.customer_code || `CUST-${Date.now()}`;
    const customerId = await repo.createCustomer({ ...body, customer_code }, conn);

    let internetAccountId = null;
    if (body.internet) {
      internetAccountId = await repo.createInternetAccount({
        customer_id: customerId,
        ...body.internet,
      }, conn);
    }

    if (body.subscription && internetAccountId) {
      await repo.createSubscription({
        customer_id: customerId,
        internet_account_id: internetAccountId,
        ...body.subscription,
      }, conn);
    }

    await conn.commit();
    return { id: customerId };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// ── Update customer + internet_account + subscription ─────────
async function updateCustomer(customerId, body) {
  const customer = await repo.findCustomerById(customerId);
  if (!customer) {
    const err = new Error('Customer tidak ditemukan');
    err.statusCode = 404;
    throw err;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await repo.updateCustomer(customerId, body, conn);

    if (body.internet?.id) {
      await repo.updateInternetAccount(body.internet.id, body.internet, conn);
    }

    if (body.subscription?.id) {
      await repo.updateSubscription(body.subscription.id, body.subscription, conn);
    }

    await conn.commit();
    return { updated: true };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// ── Hapus customer ────────────────────────────────────────────
async function deleteCustomer(customerId) {
  const rows = await repo.deleteCustomer(customerId);
  if (!rows) {
    const err = new Error('Customer tidak ditemukan');
    err.statusCode = 404;
    throw err;
  }
  return { deleted: true };
}

// ── Detail lengkap satu customer ──────────────────────────────
async function getCustomerDetail(customerId) {
  const customer = await repo.findCustomerById(customerId);
  if (!customer) {
    const err = new Error('Customer tidak ditemukan');
    err.statusCode = 404;
    throw err;
  }

  const internetAccount = await repo.findInternetAccountByCustomerId(customerId);

  const subscription = internetAccount
    ? await repo.findSubscriptionWithProfile(customerId, internetAccount.id)
    : null;

  const billingProfile = subscription ?? null;

  const invoices = subscription
    ? await repo.findInvoicesBySubscriptionId(subscription.id)
    : [];

  const invoiceIds = invoices.map((inv) => inv.id);
  const payments = await repo.findPaymentsByInvoiceIds(invoiceIds);

  const paymentsByInvoice = {};
  for (const p of payments) {
    if (!paymentsByInvoice[p.invoice_id]) paymentsByInvoice[p.invoice_id] = [];
    paymentsByInvoice[p.invoice_id].push(formatPayment(p));
  }

  return {
    customer: formatCustomer(customer),
    internet: formatInternetAccount(internetAccount),
    billing: formatBilling(subscription, billingProfile),
    invoices: invoices.map((inv) => ({
      ...formatInvoice(inv),
      payments: paymentsByInvoice[inv.id] ?? [],
    })),
  };
}

// ── Formatters ────────────────────────────────────────────────
function formatCustomer(c) {
  return {
    id: c.id,
    customer_code: c.customer_code,
    name: c.full_name,
    whatsapp: c.whatsapp_number,
    email: c.email || '-',
    id_card: c.id_card_number || '-',
    address: c.address || '-',
    map_link: c.map_link || null,
    created_at: c.created_at,
  };
}

function formatInternetAccount(ia) {
  if (!ia) return null;
  return {
    id: ia.id,
    status: ia.status,
    type: ia.type,
    username: ia.username,
    ip_address: ia.ip_address || '-',
    nas: ia.nas_name || '-',
    service_name: ia.service_name || '-',
  };
}

function formatBilling(sub, profile) {
  if (!sub || !profile) return null;
  return {
    subscription_id: sub.id,
    billing_profile_id: sub.billing_profile_id,
    profile: profile.profile_name,
    speed: profile.speed,
    payment_type: capitalize(sub.payment_type),
    billing_cycle: sub.billing_cycle,
    next_invoice: formatDate(sub.next_invoice_date),
    base_price: Number(profile.base_price),
    discount: Number(profile.discount),
    tax_percent: profile.tax_percent,
    amount: Number(profile.final_price),
  };
}

function formatInvoice(inv) {
  return {
    id: inv.id,
    invoice_number: inv.invoice_number,
    total: Number(inv.total_amount),
    due_date: formatDate(inv.due_date),
    status: capitalize(inv.status),
    created_at: inv.created_at,
  };
}

function formatPayment(p) {
  return {
    id: p.id,
    amount: Number(p.amount),
    method: p.payment_method,
    payment_date: p.payment_date,
    reference: p.reference || '-',
  };
}

function capitalize(str) {
  if (!str) return '-';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDate(date) {
  if (!date) return null;
  return new Date(date).toISOString().split('T')[0];
}

module.exports = {
  getAllCustomers,
  getAllBillingProfiles,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerDetail,
};
