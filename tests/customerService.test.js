// Mock database pool
const mockQuery = jest.fn()
const mockBeginTransaction = jest.fn()
const mockCommit = jest.fn()
const mockRollback = jest.fn()
const mockRelease = jest.fn()
const mockConn = {
  query: mockQuery,
  beginTransaction: mockBeginTransaction,
  commit: mockCommit,
  rollback: mockRollback,
  release: mockRelease,
}

jest.mock('../src/config/database', () => ({
  pool: {
    query: (...args) => mockQuery(...args),
    getConnection: () => Promise.resolve(mockConn),
  },
}))

const svc = require('../src/services/customerService')

beforeEach(() => {
  jest.clearAllMocks()
})

describe('createCustomer', () => {
  test('uses transaction and commits on success', async () => {
    // Mock insert customer -> returns id 1
    mockQuery
      .mockResolvedValueOnce([{ insertId: 1 }])  // insert customer
      .mockResolvedValueOnce([{ insertId: 10 }]) // insert internet_account
      .mockResolvedValueOnce([{ insertId: 20 }]) // insert subscription

    const result = await svc.createCustomer({
      full_name: 'Test User',
      whatsapp_number: '6281234567890',
      internet: { type: 'PPPoE', username: 'testuser' },
      subscription: { billing_profile_id: 1, payment_type: 'postpaid', billing_cycle: 15, next_invoice_date: '2026-05-01' },
    })

    expect(mockBeginTransaction).toHaveBeenCalled()
    expect(mockCommit).toHaveBeenCalled()
    expect(mockRollback).not.toHaveBeenCalled()
    expect(mockRelease).toHaveBeenCalled()
    expect(result.id).toBe(1)
  })

  test('rolls back on failure', async () => {
    mockQuery
      .mockResolvedValueOnce([{ insertId: 1 }]) // insert customer OK
      .mockRejectedValueOnce(new Error('DB error')) // insert internet fails

    await expect(svc.createCustomer({
      full_name: 'Test',
      whatsapp_number: '6281234567890',
      internet: { type: 'PPPoE', username: 'testuser' },
    })).rejects.toThrow('DB error')

    expect(mockBeginTransaction).toHaveBeenCalled()
    expect(mockRollback).toHaveBeenCalled()
    expect(mockCommit).not.toHaveBeenCalled()
    expect(mockRelease).toHaveBeenCalled()
  })
})

describe('updateCustomer', () => {
  test('uses transaction for update', async () => {
    // findCustomerById (uses pool.query, not conn)
    const poolQuery = require('../src/config/database').pool.query
    // First call is from findCustomerById (uses pool directly)
    mockQuery
      .mockResolvedValueOnce([[{ id: 1, full_name: 'Old Name' }]]) // findCustomerById
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // update customer
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // update internet

    const result = await svc.updateCustomer(1, {
      full_name: 'New Name',
      internet: { id: 5, username: 'newuser' },
    })

    expect(mockBeginTransaction).toHaveBeenCalled()
    expect(mockCommit).toHaveBeenCalled()
    expect(mockRelease).toHaveBeenCalled()
    expect(result.updated).toBe(true)
  })

  test('throws 404 for non-existent customer', async () => {
    mockQuery.mockResolvedValueOnce([[]])  // empty result

    await expect(svc.updateCustomer(999, { full_name: 'X' })).rejects.toThrow('Customer tidak ditemukan')
  })
})

describe('deleteCustomer', () => {
  test('returns deleted on success', async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }])
    const result = await svc.deleteCustomer(1)
    expect(result.deleted).toBe(true)
  })

  test('throws 404 when not found', async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }])
    await expect(svc.deleteCustomer(999)).rejects.toThrow('Customer tidak ditemukan')
  })
})
