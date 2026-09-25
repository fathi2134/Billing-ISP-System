const NAMA_BULAN = [
  '',
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

function formatIdr(n) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);
}

/**
 * Pesan WhatsApp tagihan + opsional link bayar Midtrans (redirect_url).
 */
function buildTagihanWaText({ namaCustomer, bulan, tahun, nominal, paymentUrl }) {
  const periode = `${NAMA_BULAN[Number(bulan)] || bulan} ${tahun}`;
  const lines = [
    `Yth. ${namaCustomer || 'Pelanggan'},`,
    '',
    `Tagihan layanan internet periode *${periode}* sebesar *${formatIdr(nominal)}*.`,
    '',
  ];
  if (paymentUrl) {
    lines.push('Silakan bayar online (aman via Midtrans):');
    lines.push(paymentUrl);
    lines.push('');
    lines.push('Setelah pembayaran berhasil, status tagihan akan terupdate otomatis.');
  } else {
    lines.push('Silakan lakukan pembayaran sesuai ketentuan atau hubungi kami.');
  }
  lines.push('');
  lines.push('Terima kasih.');
  return lines.join('\n');
}

/** Konfirmasi pembayaran diterima (setelah Midtrans settlement / webhook). */
function buildPembayaranTerimaWaText({ namaCustomer, bulan, tahun, nominal }) {
  const periode = `${NAMA_BULAN[Number(bulan)] || bulan} ${tahun}`;
  return [
    `Yth. ${namaCustomer || 'Pelanggan'},`,
    '',
    `Kami telah menerima pembayaran tagihan internet periode *${periode}* sebesar *${formatIdr(nominal)}*.`,
    '',
    'Terima kasih atas kepercayaan Anda.',
  ].join('\n');
}

module.exports = { buildTagihanWaText, buildPembayaranTerimaWaText, formatIdr };
