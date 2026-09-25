const {
  isValidWaNumber,
  isValidBillingCycle,
  isValidDate,
  isValidRole,
  validateCustomerPayload,
  validateSubscriptionPayload,
} = require('../src/middleware/validate')

describe('isValidWaNumber', () => {
  test('rejects empty input', () => {
    expect(isValidWaNumber('')).toBeTruthy()
    expect(isValidWaNumber(null)).toBeTruthy()
  })
  test('accepts valid 62xxx number', () => {
    expect(isValidWaNumber('6281234567890')).toBeNull()
  })
  test('accepts valid 0xxx number', () => {
    expect(isValidWaNumber('081234567890')).toBeNull()
  })
  test('rejects too short', () => {
    expect(isValidWaNumber('628')).toBeTruthy()
  })
  test('rejects invalid prefix', () => {
    expect(isValidWaNumber('1234567890123')).toBeTruthy()
  })
})

describe('isValidBillingCycle', () => {
  test('accepts 1-28', () => {
    expect(isValidBillingCycle(1)).toBeNull()
    expect(isValidBillingCycle(15)).toBeNull()
    expect(isValidBillingCycle(28)).toBeNull()
  })
  test('rejects 0 and 29+', () => {
    expect(isValidBillingCycle(0)).toBeTruthy()
    expect(isValidBillingCycle(29)).toBeTruthy()
    expect(isValidBillingCycle(-1)).toBeTruthy()
  })
})

describe('isValidDate', () => {
  test('accepts YYYY-MM-DD', () => {
    expect(isValidDate('2026-04-05')).toBeNull()
  })
  test('rejects empty', () => {
    expect(isValidDate('')).toBeTruthy()
  })
  test('rejects wrong format', () => {
    expect(isValidDate('05-04-2026')).toBeTruthy()
    expect(isValidDate('2026/04/05')).toBeTruthy()
  })
  test('rejects invalid date', () => {
    expect(isValidDate('2026-13-40')).toBeTruthy()
  })
})

describe('isValidRole', () => {
  test('accepts admin and bos', () => {
    expect(isValidRole('admin')).toBeNull()
    expect(isValidRole('bos')).toBeNull()
  })
  test('accepts empty (default)', () => {
    expect(isValidRole(null)).toBeNull()
    expect(isValidRole('')).toBeNull()
  })
  test('rejects unknown role', () => {
    expect(isValidRole('superadmin')).toBeTruthy()
  })
})

describe('validateCustomerPayload', () => {
  const valid = { full_name: 'John Doe', whatsapp_number: '6281234567890' }

  test('passes with valid payload', () => {
    expect(validateCustomerPayload(valid)).toBeNull()
  })
  test('fails without name', () => {
    expect(validateCustomerPayload({ ...valid, full_name: '' })).toBeTruthy()
  })
  test('fails without whatsapp', () => {
    expect(validateCustomerPayload({ ...valid, whatsapp_number: '' })).toBeTruthy()
  })
  test('fails with invalid email', () => {
    const errors = validateCustomerPayload({ ...valid, email: 'not-email' })
    expect(errors).toBeTruthy()
    expect(errors.some(e => e.includes('email'))).toBe(true)
  })
  test('passes with valid email', () => {
    expect(validateCustomerPayload({ ...valid, email: 'john@example.com' })).toBeNull()
  })
})

describe('validateSubscriptionPayload', () => {
  test('passes with null', () => {
    expect(validateSubscriptionPayload(null)).toBeNull()
  })
  test('passes with valid data', () => {
    expect(validateSubscriptionPayload({
      billing_cycle: 15,
      payment_type: 'postpaid',
      next_invoice_date: '2026-05-01',
      billing_profile_id: 1,
    })).toBeNull()
  })
  test('fails with invalid billing cycle', () => {
    const errors = validateSubscriptionPayload({ billing_cycle: 30 })
    expect(errors).toBeTruthy()
  })
  test('fails with invalid payment type', () => {
    const errors = validateSubscriptionPayload({ payment_type: 'credit' })
    expect(errors).toBeTruthy()
  })
  test('fails with invalid date', () => {
    const errors = validateSubscriptionPayload({ next_invoice_date: 'invalid' })
    expect(errors).toBeTruthy()
  })
})
