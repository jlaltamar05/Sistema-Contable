const express = require('express');
const router = express.Router();
const c = require('../controllers/reportesContables.controller');
const exigirRolContable = require('../middleware/exigirRolContable');

const ROLES_CONTABLES = ['administrador', 'jefe_contabilidad', 'contador'];
const permiso = exigirRolContable(ROLES_CONTABLES);

router.get('/libro-diario', permiso, c.libroDiario);
router.get('/libro-mayor', permiso, c.libroMayor);
router.get('/balance-comprobacion', permiso, c.balanceComprobacion);
router.get('/estado-resultados', permiso, c.estadoResultados);
router.get('/balance-general', permiso, c.balanceGeneral);

module.exports = router;
