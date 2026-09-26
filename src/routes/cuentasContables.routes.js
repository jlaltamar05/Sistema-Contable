const express = require('express');
const router = express.Router();
const c = require('../controllers/cuentasContables.controller');
const exigirRolContable = require('../middleware/exigirRolContable');

const ROLES_CONTABLES = ['administrador', 'jefe_contabilidad', 'contador'];

router.get('/', c.listar);
router.post('/', exigirRolContable(ROLES_CONTABLES), c.crear);
router.post('/importar', exigirRolContable(ROLES_CONTABLES), c.importar);
router.post('/vaciar', exigirRolContable(['administrador', 'jefe_contabilidad']), c.vaciar);
router.put('/:id', exigirRolContable(ROLES_CONTABLES), c.actualizar);
router.delete('/:id', exigirRolContable(ROLES_CONTABLES), c.eliminar);

module.exports = router;
