const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

// Mock pool sebelum require auth
const mockQuery = jest.fn()
jest.mock('../src/config/database', () => ({
  pool: { query: (...args) => mockQuery(...args), getConnection: jest.fn() },
}))

const { authenticate } = require('../src/routes/auth')

describe('authenticate middleware', () => {
  const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-insecure-secret'

  test('rejects request without token', () => {
    const req = { headers: {} }
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }
    const next = jest.fn()

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  test('rejects invalid token', () => {
    const req = { headers: { authorization: 'Bearer invalid.token.here' } }
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }
    const next = jest.fn()

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  test('passes with valid token', () => {
    const payload = { id: 1, email: 'admin', role: 'admin', nama: 'Admin' }
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' })
    const req = { headers: { authorization: `Bearer ${token}` } }
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }
    const next = jest.fn()

    authenticate(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(req.user).toBeDefined()
    expect(req.user.email).toBe('admin')
    expect(req.user.role).toBe('admin')
  })
})

describe('login flow (unit)', () => {
  test('bcrypt compare works correctly', async () => {
    const password = 'admin123'
    const hashed = await bcrypt.hash(password, 10)
    expect(await bcrypt.compare(password, hashed)).toBe(true)
    expect(await bcrypt.compare('wrong', hashed)).toBe(false)
  })

  test('JWT sign and verify roundtrip', () => {
    const secret = 'testsecret'
    const payload = { id: 1, email: 'test@test.com', role: 'admin', nama: 'Test' }
    const token = jwt.sign(payload, secret, { expiresIn: '1h' })
    const decoded = jwt.verify(token, secret)
    expect(decoded.id).toBe(1)
    expect(decoded.email).toBe('test@test.com')
    expect(decoded.role).toBe('admin')
  })
})
