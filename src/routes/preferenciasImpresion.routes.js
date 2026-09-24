const express = require('express');
const router = express.Router();
const c = require('../controllers/preferenciasImpresion.controller');

router.get('/', c.listar);
router.put('/', c.guardar);

module.exports = router;
