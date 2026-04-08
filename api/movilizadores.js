// Endpoints para Movilizadores: lista de ciudadanos, visitas y geolocalización
const express = require('express');
const router = express.Router();
const db = require('./db');
const { requireRole } = require('./authMiddleware');

// Helper: validar ID entero positivo
function parseId(val) {
  const id = parseInt(val, 10);
  return (!isNaN(id) && id > 0) ? id : null;
}

// Cache para estado de movilizadores (query pesada con subqueries)
let estadoCache = { data: null, ts: 0 };
const ESTADO_CACHE_TTL = 15_000; // 15 segundos

// Obtener ciudadanos asignados a un movilizador que no han votado
router.get('/ciudadanos/:movilizadorId', async (req, res) => {
  try {
    const movilizadorId = parseId(req.params.movilizadorId);
    if (!movilizadorId) return res.status(400).json({ error: 'ID inválido' });

    // Un movilizador solo puede ver sus propios ciudadanos (admin puede ver todos)
    if (req.user.rol === 'movilizador' && req.user.id !== movilizadorId) {
      return res.status(403).json({ error: 'Sin permisos para ver ciudadanos de otro movilizador' });
    }

    const [rows] = await db.execute(
      'SELECT id, nombre, paterno, materno, calle, no, colonia, seccion, cel, visitas FROM ciudadanos WHERE movilizador_id = ? AND status_voto = "pendiente" AND deleted = 0',
      [movilizadorId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error en endpoint ciudadanos:', error);
    res.status(500).json({ error: 'Error al obtener ciudadanos asignados' });
  }
});

// Obtener todos los ciudadanos asignados a un movilizador CON estado de visitas (para RP)
router.get('/detalle-ciudadanos/:movilizadorId', requireRole('rp', 'admin'), async (req, res) => {
  try {
    const movilizadorId = parseId(req.params.movilizadorId);
    if (!movilizadorId) return res.status(400).json({ error: 'ID inválido' });
    const [rows] = await db.execute(
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

// Incrementar visitas a domicilio (solo movilizador dueño o admin)
router.put('/visita/:ciudadanoId', requireRole('movilizador', 'admin'), async (req, res) => {
  try {
    const ciudadanoId = parseId(req.params.ciudadanoId);
    if (!ciudadanoId) return res.status(400).json({ error: 'ID inválido' });

    // Verificar que el ciudadano pertenece al movilizador actual
    if (req.user.rol === 'movilizador') {
      const [check] = await db.execute(
        'SELECT id FROM ciudadanos WHERE id = ? AND movilizador_id = ? AND deleted = 0',
        [ciudadanoId, req.user.id]
      );
      if (check.length === 0) {
        return res.status(403).json({ error: 'Este ciudadano no está asignado a ti' });
      }
    }

    const [result] = await db.execute(
      'UPDATE ciudadanos SET visitas = visitas + 1 WHERE id = ? AND deleted = 0',
      [ciudadanoId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Ciudadano no encontrado' });
    res.json({ success: true, mensaje: 'Visita registrada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar visita' });
  }
});

// Guardar ubicación del movilizador
router.post('/ubicacion', requireRole('movilizador'), async (req, res) => {
  try {
    const { movilizadorId, lat, lng, activo } = req.body;
    const movId = parseId(movilizadorId);
    if (!movId || typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'Datos de ubicación inválidos' });
    }
    // Validar rango de coordenadas
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'Coordenadas fuera de rango' });
    }
    // Un movilizador solo puede enviar su propia ubicación
    if (req.user.id !== movId) {
      return res.status(403).json({ error: 'No puedes enviar ubicación de otro movilizador' });
    }
    await db.execute(
      'INSERT INTO ubicaciones_movilizador (movilizador_id, lat, lng, activo, timestamp) VALUES (?, ?, ?, ?, NOW())',
      [movId, lat, lng, activo ? 1 : 0]
    );
    // Invalidar cache de estado
    estadoCache.ts = 0;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al guardar ubicación' });
  }
});

// Obtener ubicaciones recientes de movilizadores (para RP)
router.get('/ubicaciones', requireRole('rp', 'admin'), async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT movilizador_id, lat, lng, activo, timestamp FROM ubicaciones_movilizador WHERE timestamp >= NOW() - INTERVAL 15 MINUTE'
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener ubicaciones' });
  }
});

// Obtener estado de todos los movilizadores con su última ubicación y visitas (para RP) — con caché
router.get('/estado', requireRole('rp', 'admin'), async (req, res) => {
  try {
    if (estadoCache.data && (Date.now() - estadoCache.ts < ESTADO_CACHE_TTL)) {
      return res.json(estadoCache.data);
    }
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
        WHERE timestamp >= NOW() - INTERVAL 24 HOUR
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
    estadoCache = { data: rows, ts: Date.now() };
    res.json(rows);
  } catch (error) {
    console.error('Error en /estado:', error);
    res.status(500).json({ error: 'Error al obtener estado de movilizadores' });
  }
});

module.exports = router;
