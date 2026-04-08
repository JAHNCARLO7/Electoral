console.log('movilizadores.js cargado');
// Endpoints para Movilizadores: lista de ciudadanos, visitas y geolocalización
const express = require('express');
const router = express.Router();
const db = require('./db');

// Obtener ciudadanos asignados a un movilizador que no han votado
router.get('/ciudadanos/:movilizadorId', async (req, res) => {
  try {
    const { movilizadorId } = req.params;
    console.log('Llamada a /ciudadanos/:movilizadorId con id:', movilizadorId);
    const [rows] = await db.query(
      'SELECT id, nombre, paterno, materno, calle, no, colonia, seccion, cel, visitas FROM ciudadanos WHERE movilizador_id = ? AND status_voto = "pendiente" AND deleted = 0',
      [movilizadorId]
    );
    console.log('Resultados de la consulta:', rows);
    res.json(rows);
  } catch (error) {
    console.error('Error en endpoint ciudadanos:', error);
    res.status(500).json({ error: 'Error al obtener ciudadanos asignados' });
  }
});

// Obtener todos los ciudadanos asignados a un movilizador CON estado de visitas (para RP)
router.get('/detalle-ciudadanos/:movilizadorId', async (req, res) => {
  try {
    const { movilizadorId } = req.params;
    const [rows] = await db.query(
      `SELECT id, nombre, paterno, materno, seccion, visitas, status_voto
       FROM ciudadanos
       WHERE movilizador_id = ? AND deleted = 0
       ORDER BY seccion, paterno, materno, nombre`,
      [movilizadorId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener detalle de ciudadanos' });
  }
});

// Incrementar visitas a domicilio
router.put('/visita/:ciudadanoId', async (req, res) => {
  try {
    const { ciudadanoId } = req.params;
    await db.query(
      'UPDATE ciudadanos SET visitas = visitas + 1 WHERE id = ?',
      [ciudadanoId]
    );
    res.json({ success: true, mensaje: 'Visita registrada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar visita' });
  }
});

// Guardar ubicación del movilizador
router.post('/ubicacion', async (req, res) => {
  try {
    const { movilizadorId, lat, lng, activo } = req.body;
    await db.query(
      'INSERT INTO ubicaciones_movilizador (movilizador_id, lat, lng, activo, timestamp) VALUES (?, ?, ?, ?, NOW())',
      [movilizadorId, lat, lng, activo]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al guardar ubicación' });
  }
});

// Obtener ubicaciones recientes de movilizadores (para RP)
router.get('/ubicaciones', async (req, res) => {
  try {
    // Solo ubicaciones de los últimos 15 minutos
    const [rows] = await db.query(
      'SELECT movilizador_id, lat, lng, activo, timestamp FROM ubicaciones_movilizador WHERE timestamp >= NOW() - INTERVAL 15 MINUTE'
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener ubicaciones' });
  }
});

// Obtener estado de todos los movilizadores con su última ubicación y visitas (para RP)
router.get('/estado', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        u.id,
        u.nombre,
        u.activo AS cuenta_activa,
        ub.lat,
        ub.lng,
        ub.timestamp AS ultima_ubicacion,
        CASE
          WHEN ub.timestamp IS NULL THEN 'sin_conexion'
          WHEN ub.timestamp >= NOW() - INTERVAL 10 MINUTE THEN 'activo'
          ELSE 'inactivo'
        END AS estado,
        IFNULL(v.total_visitas, 0) AS total_visitas,
        IFNULL(v.ciudadanos_visitados, 0) AS ciudadanos_visitados,
        IFNULL(v.ciudadanos_asignados, 0) AS ciudadanos_asignados
      FROM usuarios u
      LEFT JOIN (
        SELECT movilizador_id, lat, lng, timestamp,
          ROW_NUMBER() OVER (PARTITION BY movilizador_id ORDER BY timestamp DESC) AS rn
        FROM ubicaciones_movilizador
      ) ub ON ub.movilizador_id = u.id AND ub.rn = 1
      LEFT JOIN (
        SELECT 
          movilizador_id,
          SUM(visitas) AS total_visitas,
          SUM(CASE WHEN visitas > 0 THEN 1 ELSE 0 END) AS ciudadanos_visitados,
          COUNT(*) AS ciudadanos_asignados
        FROM ciudadanos
        WHERE deleted = 0
        GROUP BY movilizador_id
      ) v ON v.movilizador_id = u.id
      WHERE u.rol = 'movilizador'
      ORDER BY u.nombre
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error en /estado:', error);
    res.status(500).json({ error: 'Error al obtener estado de movilizadores' });
  }
});

module.exports = router;
