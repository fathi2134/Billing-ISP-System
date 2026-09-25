import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Pelanggan } from './pages/Pelanggan'
import { Tagihan } from './pages/Tagihan'
import { WhatsAppAdmin } from './pages/WhatsAppAdmin'
import { Tickets } from './pages/Tickets'
import { QualityCheckInput } from './pages/QualityCheckInput'
import { Settings } from './pages/Settings'
import { Login } from './pages/Login'
import { PaymentSuccess } from './pages/PaymentSuccess'
import { PaymentFailed } from './pages/PaymentFailed'
import { PaymentPending } from './pages/PaymentPending'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

const savedTheme = localStorage.getItem('theme') || 'light'
if (savedTheme === 'dark') document.documentElement.classList.add('dark')
else document.documentElement.classList.remove('dark')

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user')
    return saved ? JSON.parse(saved) : null
  })

  function handleLogout() {
    localStorage.clear()
    setUser(null)
  }

  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        {/* Halaman redirect Midtrans — harus bisa dibuka tanpa login admin */}
        <Route path="/payment/success" element={<PaymentSuccess />} />
        <Route path="/payment/failed" element={<PaymentFailed />} />
        <Route path="/payment/pending" element={<PaymentPending />} />

        {user ? (
          <Route path="/" element={<Layout user={user} onLogout={handleLogout} />}>
            <Route index element={<Dashboard />} />
            <Route path="customers" element={<Pelanggan />} />
            <Route path="tagihan" element={<Tagihan />} />
            <Route path="whatsapp" element={<WhatsAppAdmin />} />
            <Route path="tickets" element={<Tickets />} />
            <Route path="quality-check" element={<QualityCheckInput />} />
            <Route path="tickets-qc" element={<Navigate to="/tickets" replace />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        ) : (
          <Route path="*" element={<Login onLogin={setUser} />} />
        )}
      </Routes>
    </BrowserRouter>
  )
}
