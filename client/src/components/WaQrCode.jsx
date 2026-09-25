/**
 * WaQrCode.jsx
 * Generate QR code di browser langsung dari string WA — tidak butuh internet.
 * Pakai library `qrcode` (canvas-based).
 */
import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

export function WaQrCode({ value }) {
  const canvasRef = useRef(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (!value || !canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, value, {
      width: 256,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    }).catch(e => setErr(e.message))
  }, [value])

  if (err) return <p className="text-sm text-rose-500">Gagal render QR: {err}</p>

  return <canvas ref={canvasRef} className="rounded-xl" />
}
