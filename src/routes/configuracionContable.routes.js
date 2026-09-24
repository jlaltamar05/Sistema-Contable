const express = require('express');
const router = express.Router();
const c = require('../controllers/configuracionContable.controller');
const exigirRolContable = require('../middleware/exigirRolContable');

const ROLES_CONTABLES = ['administrador', 'jefe_contabilidad', 'contador'];

router.get('/', exigirRolContable(ROLES_CONTABLES), c.obtener);
router.put('/', exigirRolContable(ROLES_CONTABLES), c.guardar);

module.exports = router;
