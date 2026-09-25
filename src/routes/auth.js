const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? undefined : 'dev-only-insecure-secret');

// === MIDDLEWARE KEAMANAN ===
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Tidak ada token, harap login' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Sesi telah berakhir, silakan login ulang' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Akses ditolak: Hanya Admin yang diizinkan' });
  next();
}

// === ROUTER API ===
const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (!rows.length) return res.status(401).json({ error: 'Username atau password salah' });
    
    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Username atau password salah' });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, nama: user.nama }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, role: user.role, nama: user.nama } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/users', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, nama, email, role FROM users ORDER BY id ASC');
    res.json({ data: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/users', authenticate, requireAdmin, async (req, res) => {
  const { nama, email, password, role } = req.body;
  if (!nama || !email || !password) return res.status(400).json({ error: 'Semua field wajib diisi' });
  const allowedRoles = ['admin', 'bos'];
  if (role && !allowedRoles.includes(role)) {
    return res.status(400).json({ error: `Role harus salah satu: ${allowedRoles.join(', ')}` });
  }
  if (password.length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter' });
  try {
    const hashed = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO users (nama, email, password, role) VALUES (?, ?, ?, ?)', [nama, email, hashed, role || 'bos']);
    res.status(201).json({ message: 'Pengguna berhasil ditambahkan' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email/Username sudah dipakai' });
    res.status(500).json({ error: e.message });
  }
});

router.delete('/users/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'Tidak bisa menghapus akun sendiri' });
    await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: 'Pengguna dihapus' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function initDefaultAdmin() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        nama VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'bos') NOT NULL DEFAULT 'bos',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    const [rows] = await pool.query('SELECT id FROM users LIMIT 1');
    if (rows.length === 0) await pool.query("INSERT INTO users (nama, email, password, role) VALUES ('Administrator', 'admin', ?, 'admin')", [await bcrypt.hash('admin', 10)]);
  } catch (e) {
    console.error('[Auth] Gagal inisialisasi admin:', e.message);
  }
}

module.exports = { router, initDefaultAdmin, authenticate, requireAdmin };