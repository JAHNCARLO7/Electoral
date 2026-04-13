const express = require('express');
const router = express.Router();
const db = require('./db');

// Obtener todas las secciones disponibles
router.get('/secciones', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT DISTINCT seccion FROM ciudadanos WHERE deleted = 0 ORDER BY seccion'
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener secciones' });
  }
});

// Obtener ciudadanos de una sección (solo los que no han votado)
router.get('/seccion/:seccion', async (req, res) => {
  try {
    const { seccion } = req.params;
    const [rows] = await db.query(
      'SELECT id, nombre, paterno, materno FROM ciudadanos WHERE seccion = ? AND status_voto = "pendiente" AND deleted = 0',
      [seccion]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener ciudadanos' });
  }
});

// Registrar voto de un ciudadano
router.put('/votar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(
      'UPDATE ciudadanos SET status_voto = "voto" WHERE id = ?',
      [id]
    );
    res.json({ success: true, mensaje: 'Voto registrado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar voto' });
  }
});

module.exports = router;