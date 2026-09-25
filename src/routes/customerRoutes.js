const express = require('express');
const ctrl = require('../controllers/customerController');
const { validate, validateCustomerPayload, validateSubscriptionPayload } = require('../middleware/validate');

const router = express.Router();

function validateCreateCustomer(body) {
  const errors = validateCustomerPayload(body) || [];
  const subErrors = validateSubscriptionPayload(body.subscription);
  if (subErrors) errors.push(...subErrors);
  return errors.length ? errors : null;
}

function validateUpdateCustomer(body) {
  const errors = [];
  if (body.full_name !== undefined && (!body.full_name || !body.full_name.trim())) {
    errors.push('Nama lengkap tidak boleh kosong');
  }
  if (body.whatsapp_number !== undefined) {
    const { isValidWaNumber } = require('../middleware/validate');
    const waErr = isValidWaNumber(body.whatsapp_number);
    if (waErr) errors.push(waErr);
  }
  const subErrors = validateSubscriptionPayload(body.subscription);
  if (subErrors) errors.push(...subErrors);
  return errors.length ? errors : null;
}

router.get('/',                      ctrl.getAll);
router.get('/billing-profiles',      ctrl.getBillingProfiles);
router.get('/:id/detail',            ctrl.getDetail);
router.post('/',                     validate(validateCreateCustomer), ctrl.create);
router.put('/:id',                   validate(validateUpdateCustomer), ctrl.update);
router.delete('/:id',                ctrl.remove);
router.post('/:id/isolir',           ctrl.isolir);
router.post('/:id/buka-isolir',      ctrl.bukaIsolir);
router.post('/:id/kirim-wa',         ctrl.kirimWa);

module.exports = router;
