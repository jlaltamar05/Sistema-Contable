const express = require('express');
const router = express.Router();
const c = require('../controllers/companias.controller');

router.get('/', c.listarCompanias);
router.get('/:id', c.obtenerCompania);

module.exports = router;
