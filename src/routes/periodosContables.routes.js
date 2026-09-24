const express = require('express');
const router = express.Router();
const c = require('../controllers/periodosContables.controller');
const exigirRolContable = require('../middleware/exigirRolContable');

const ROLES_CONTABLES = ['administrador', 'jefe_contabilidad', 'contador'];
const SOLO_JEFES = ['administrador', 'jefe_contabilidad'];

router.get('/', exigirRolContable(ROLES_CONTABLES), c.listar);
router.post('/cerrar', exigirRolContable(ROLES_CONTABLES), c.cerrar);
router.post('/reabrir', exigirRolContable(SOLO_JEFES), c.reabrir);

module.exports = router;
