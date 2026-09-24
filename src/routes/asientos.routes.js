const express = require('express');
const router = express.Router();
const c = require('../controllers/asientos.controller');
const exigirRolContable = require('../middleware/exigirRolContable');

const ROLES_CONTABLES = ['administrador', 'jefe_contabilidad', 'contador'];
const permiso = exigirRolContable(ROLES_CONTABLES);

// Rutas de proceso en lote ANTES de '/:id' para que no choquen.
router.post('/proceso/contabilizar', permiso, c.procesoContabilizar);
router.post('/proceso/desprocesar', permiso, c.procesoDesprocesar);
router.get('/proceso/estatus', permiso, c.procesoEstatus);

router.get('/', permiso, c.listar);
router.post('/', permiso, c.crearManual);
router.get('/:id', permiso, c.obtener);
router.post('/:id/contabilizar', permiso, c.contabilizarUno);
router.post('/:id/reversar', permiso, c.reversarUno);
router.delete('/:id', permiso, c.eliminarPendiente);

module.exports = router;
