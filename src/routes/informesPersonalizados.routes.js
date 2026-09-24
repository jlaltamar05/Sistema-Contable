const express = require('express');
const router = express.Router();
const c = require('../controllers/informesPersonalizados.controller');

router.get('/metadatos', c.metadatos);
router.get('/', c.listar);
router.post('/', c.crear);
router.put('/:id', c.actualizar);
router.delete('/:id', c.eliminar);
router.get('/:id/ejecutar', c.ejecutar);

module.exports = router;
