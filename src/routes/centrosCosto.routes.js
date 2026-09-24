const express = require('express');
const router = express.Router();
const c = require('../controllers/centrosCosto.controller');
const exigirRolContable = require('../middleware/exigirRolContable');

const ROLES_CONTABLES = ['administrador', 'jefe_contabilidad', 'contador'];

router.get('/', c.listar);
router.post('/', exigirRolContable(ROLES_CONTABLES), c.crear);
router.put('/:id', exigirRolContable(ROLES_CONTABLES), c.actualizar);
router.delete('/:id', exigirRolContable(ROLES_CONTABLES), c.eliminar);

module.exports = router;
