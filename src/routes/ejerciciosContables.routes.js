const express = require('express');
const router = express.Router();
const c = require('../controllers/ejerciciosContables.controller');
const exigirRolContable = require('../middleware/exigirRolContable');

const ROLES_CONTABLES = ['administrador', 'jefe_contabilidad', 'contador'];
const SOLO_JEFES = ['administrador', 'jefe_contabilidad'];

router.get('/', exigirRolContable(ROLES_CONTABLES), c.listar);
router.post('/', exigirRolContable(ROLES_CONTABLES), c.abrirEjercicio);
// Cerrar el ejercicio es más delicado que cerrar un período mensual
// (ya no se puede editar nada de ese año) — igual que la reapertura
// de períodos, solo jefe de contabilidad o administrador.
router.post('/:id/cerrar', exigirRolContable(SOLO_JEFES), c.cerrarEjercicio);

module.exports = router;
