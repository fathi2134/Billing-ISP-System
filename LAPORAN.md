# Laporan pembersihan & skema database (Billing ISP)

Tanggal ringkasan ini dibuat bersamaan dengan perapian file SQL dan dependensi.

## Yang sudah dilakukan

1. **Satu file SQL untuk import penuh**  
   - `sql/billing_isp_complete.sql`  
   - Menghapus database `billing_isp` lalu membuat ulang (cocok untuk “hapus DB lama, upload yang baru”).  
   - Berisi: `users`, `customer`, `billing_profiles`, `internet_accounts`, `subscriptions`, `invoices`, `payments`, `tagihan`, serta modul WhatsApp (`whatsapp_template`, `whatsapp_schedule`, `whatsapp_schedule_recipient`, `whatsapp_delivery_log`).

2. **Legacy SQL saja — Prisma dihapus dari proyek**  
   - `package.json` tidak lagi memuat `prisma` / `@prisma/client`.  
   - Folder `prisma/` (schema lama) dihapus — aplikasi memakai **mysql2** + query di `src/repositories` dan `src/routes`.  
   - `.env.example` tidak lagi memaksa `DATABASE_URL` Prisma.

3. **Perbaikan bug: `scripts/generate-tagihan.js`**  
   - Sebelumnya masih query tabel `pelanggan` / kolom `pelanggan_id` yang **tidak ada** di skema terbaru.  
   - Sekarang mengambil nominal dari **`billing_profiles.final_price`** lewat **subscription terakhir** per `customer`, lalu insert ke `tagihan` dengan **`customer_id`**.

4. **Penunjuk di folder SQL**  
   - `sql/README.txt` menjelaskan file mana yang diimpor.

## Temuan & saran (bisa dibenarkan nanti)

| Item | Keterangan |
|------|------------|
| **Admin default** | Tabel `users` dikosongkan di seed SQL. User admin pertama dibuat oleh `initDefaultAdmin()` saat `npm start` (email `admin`, password `admin` — **wajib diganti** di production). |
| **Dua model tagihan** | Ada `tagihan` (bulan/tahun) dan `invoices`/`payments` (modul invoice). Saat ini keduanya ada; ke depan bisa disatukan atau dipetakan jelas mana yang “sumber kebenaran”. |
| **`whatsapp_schedule_recipient.customer_id`** | Tanpa FK ke `customer` (disengaja agar jadwal tetap punya snapshot meski customer dihapus). Konsisten dengan komentar di skema lama. |
| **Hotspot vs ENUM DB** | Kolom `internet_accounts.type` hanya `PPPoE`, `DHCP`, `Static`. Jika form/API mengirim `Hotspot`, MySQL akan menolak. Solusi: tambahkan nilai `Hotspot` ke ENUM di SQL, atau map `Hotspot` → tipe yang dipakai RouterOS Anda di layer API. |
| **PPPoE / MikroTik** | Route isolir di `routeros.js` harus selaras dengan tipe akun di lapangan. |
| **Port 3000 / 5173** | Backend `3000`, frontend Vite `5173`. Jika `EADDRINUSE` pada 3000, hentikan proses `node` lama sebelum `npm start` lagi. |

## Checklist setelah import SQL baru

1. Sesuaikan `.env` (`DB_*`, `JWT_SECRET`, `MIKROTIK_*`).  
2. `npm install` di root (setelah penghapusan Prisma).  
3. `npm start` — cek login `/api/auth/login`.  
4. `npm run generate-tagihan` — cek `tagihan` bertambah untuk customer yang punya `final_price > 0`.

Jika ada error spesifik setelah langkah ini, catat pesan MySQL / Node dan sesuaikan query atau seed.
