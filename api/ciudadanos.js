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

// Estadísticas de votos por sección (para RP)
router.get('/estadisticas/votos', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        seccion,
        COUNT(*) AS total,
        SUM(CASE WHEN status_voto = 'voto' THEN 1 ELSE 0 END) AS votaron,
        SUM(CASE WHEN status_voto = 'pendiente' THEN 1 ELSE 0 END) AS pendientes
      FROM ciudadanos
      WHERE deleted = 0
      GROUP BY seccion
      ORDER BY seccion
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error en /estadisticas/votos:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas de votos' });
  }
});

// ========== CRUD CIUDADANOS (ADMIN) ==========

// Listar todos los ciudadanos con su movilizador asignado
router.get('/todos', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT c.id, c.nombre, c.paterno, c.materno, c.calle, c.no, c.colonia,
             c.seccion, c.cel, c.movilizador_id, c.status_voto, c.visitas,
             u.nombre AS movilizador_nombre
      FROM ciudadanos c
      LEFT JOIN usuarios u ON c.movilizador_id = u.id
      WHERE c.deleted = 0
      ORDER BY c.seccion, c.paterno, c.materno
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error en /todos:', error);
    res.status(500).json({ error: 'Error al obtener ciudadanos' });
  }
});

// Listar movilizadores disponibles (para selector de asignación)
router.get('/movilizadores-disponibles', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, nombre FROM usuarios WHERE rol = 'movilizador' AND activo = 1 ORDER BY nombre`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener movilizadores' });
  }
});

// Crear ciudadano
router.post('/', async (req, res) => {
  try {
    const { nombre, paterno, materno, calle, no, colonia, seccion, cel, movilizador_id } = req.body;
    if (!nombre || !paterno || !seccion) {
      return res.status(400).json({ error: 'Nombre, apellido paterno y sección son requeridos' });
    }
    const [result] = await db.query(
      `INSERT INTO ciudadanos (nombre, paterno, materno, calle, no, colonia, seccion, cel, movilizador_id, status_voto, visitas, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', 0, 0)`,
      [nombre, paterno, materno || '', calle || '', no || '', colonia || '', seccion, cel || '', movilizador_id || null]
    );
    res.json({ success: true, id: result.insertId });
  } catch (error) {
    console.error('Error al crear ciudadano:', error);
    res.status(500).json({ error: 'Error al crear ciudadano' });
  }
});

// Actualizar ciudadano (incluye reasignar movilizador)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, paterno, materno, calle, no, colonia, seccion, cel, movilizador_id } = req.body;
    await db.query(
      `UPDATE ciudadanos SET nombre=?, paterno=?, materno=?, calle=?, no=?, colonia=?, seccion=?, cel=?, movilizador_id=? WHERE id=?`,
      [nombre, paterno, materno || '', calle || '', no || '', colonia || '', seccion, cel || '', movilizador_id || null, id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error al actualizar ciudadano:', error);
    res.status(500).json({ error: 'Error al actualizar ciudadano' });
  }
});

// Eliminar ciudadano (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('UPDATE ciudadanos SET deleted = 1 WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar ciudadano' });
  }
});

module.exports = router;