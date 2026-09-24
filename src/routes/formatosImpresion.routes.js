const express = require('express');
const router = express.Router();
const c = require('../controllers/formatosImpresion.controller');

router.get('/', c.listarFormatos);
router.get('/:id', c.obtenerFormato);
router.post('/', c.crearFormato);
router.put('/:id', c.actualizarFormato);
router.delete('/:id', c.eliminarFormato);

module.exports = router;
