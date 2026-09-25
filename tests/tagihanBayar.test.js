/**
 * Test untuk logika pembayaran tagihan.
 * Memverifikasi bahwa pembayaran tagihan mengupdate status + sinkronisasi invoice.
 */

const express = require('express')

// Mock database
const mockPoolQuery = jest.fn()
const mockConnQuery = jest.fn()
const mockBegin = jest.fn()
const mockCommit = jest.fn()
const mockRollback = jest.fn()
const mockRelease = jest.fn()

jest.mock('../src/config/database', () => ({
  pool: {
    query: (...args) => mockPoolQuery(...args),
    getConnection: () => Promise.resolve({
      query: (...args) => mockConnQuery(...args),
      beginTransaction: mockBegin,
      commit: mockCommit,
      rollback: mockRollback,
      release: mockRelease,
    }),
  },
}))

jest.mock('../src/services/tagihanGenerator', () => ({
  generateTagihanForPeriod: jest.fn(),
}))

const tagihanRouter = require('../src/routes/tagihan')

// Helper: buat express app untuk testing
function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/tagihan', tagihanRouter)
  return app
}

const request = (app, method, url, body) => {
  return new Promise((resolve) => {
    const req = {
      method,
      url,
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }
    // Simple supertest-like approach using app.handle
    const mockReq = Object.assign(
      require('stream').Readable.from(''),
      {
        method,
        url,
        headers: { 'content-type': 'application/json', host: 'localhost' },
        connection: { remoteAddress: '127.0.0.1' },
      }
    )
    mockReq.body = body
    const mockRes = {
      statusCode: 200,
      _headers: {},
      _body: null,
      status(code) { this.statusCode = code; return this },
      json(data) { this._body = data; resolve({ status: this.statusCode, body: data }) },
      setHeader(k, v) { this._headers[k] = v },
      getHeader(k) { return this._headers[k] },
    }
    app.handle(mockReq, mockRes, () => resolve({ status: 404, body: null }))
  })
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('PATCH /tagihan/:id/bayar', () => {
  test('marks tagihan as paid and syncs invoice', async () => {
    const tagihan = { id: 1, customer_id: 5, bulan: 4, tahun: 2026, nominal: 150000, status_bayar: 'belum' }
    const invoice = { id: 10, total_amount: 150000 }

    mockConnQuery
      .mockResolvedValueOnce([[tagihan]])     // SELECT tagihan FOR UPDATE
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE tagihan lunas
      .mockResolvedValueOnce([[invoice]])      // SELECT invoice
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE invoice paid
      .mockResolvedValueOnce([{ insertId: 1 }])     // INSERT payment

    const app = makeApp()
    const res = await request(app, 'PATCH', '/tagihan/1/bayar', { payment_method: 'cash' })

    expect(mockBegin).toHaveBeenCalled()
    expect(mockCommit).toHaveBeenCalled()
    expect(res.status).toBe(200)
    expect(res.body.message).toContain('lunas')
    expect(res.body.invoice_synced).toBe(true)
  })

  test('rejects already paid tagihan', async () => {
    const tagihan = { id: 1, customer_id: 5, bulan: 4, tahun: 2026, nominal: 150000, status_bayar: 'lunas' }

    mockConnQuery.mockResolvedValueOnce([[tagihan]])

    const app = makeApp()
    const res = await request(app, 'PATCH', '/tagihan/1/bayar', { payment_method: 'cash' })

    expect(res.status).toBe(409)
    expect(res.body.error).toContain('lunas')
  })

  test('rejects invalid payment method', async () => {
    const app = makeApp()
    const res = await request(app, 'PATCH', '/tagihan/1/bayar', { payment_method: 'bitcoin' })

    expect(res.status).toBe(400)
  })
})
