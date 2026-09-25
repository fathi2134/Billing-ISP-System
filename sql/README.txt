BILLING ISP — SQL (Legacy, tanpa Prisma)
========================================

File yang dipakai untuk database baru:
  billing_isp_complete.sql

Database yang sudah jalan (tanpa drop): tambah tiket/QC + kolom status WA:
  migration_add_tickets_qc_wa_ack.sql
Kolom Midtrans pada tagihan (jika belum ada):
  migration_tagihan_midtrans_columns.sql

Import di phpMyAdmin (pilih file itu saja) atau:
  mysql -u root -p < sql/billing_isp_complete.sql

Tabel users untuk login: diisi otomatis saat pertama kali server jalan
(jika masih kosong) — lihat src/routes/auth.js (initDefaultAdmin).

Laporan audit & saran perbaikan: lihat LAPORAN.md di root proyek.
