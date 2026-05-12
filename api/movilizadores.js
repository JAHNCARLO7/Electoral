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

// Resumen de secciones para el movilizador (reemplaza la carga masiva de todos los ciudadanos)
router.get('/secciones-resumen', requireRole('movilizador', 'admin'), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        seccion,
        COUNT(*) AS total,
        SUM(CASE WHEN visitas > 0 THEN 1 ELSE 0 END) AS visitados
      FROM ciudadanos
      WHERE status_voto = 'pendiente' AND deleted = 0
      GROUP BY seccion
      ORDER BY seccion
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error en /secciones-resumen:', error);
    res.status(500).json({ error: 'Error al obtener resumen de secciones' });
  }
});

// Obtener ciudadanos de una sección específica (carga bajo demanda)
router.get('/ciudadanos-seccion/:seccion', requireRole('movilizador', 'admin'), async (req, res) => {
  try {
    const seccion = (req.params.seccion || '').trim();
    if (!seccion || !/^[A-Za-z0-9\-]{1,20}$/.test(seccion)) {
      return res.status(400).json({ error: 'Sección inválida' });
    }
    const [rows] = await db.execute(
      `SELECT c.id, c.nombre, c.paterno, c.materno, c.calle, c.no, c.colonia, c.seccion, c.cel, c.visitas,
              MAX(vl.created_at) AS ultima_visita
       FROM ciudadanos c
       LEFT JOIN visitas_log vl ON vl.ciudadano_id = c.id
       WHERE c.seccion = ? AND c.status_voto = 'pendiente' AND c.deleted = 0
       GROUP BY c.id
       ORDER BY c.paterno, c.materno, c.nombre`,
      [seccion]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error en /ciudadanos-seccion:', error);
    res.status(500).json({ error: 'Error al obtener ciudadanos de la sección' });
  }
});

// Obtener ciudadanos (mantenido por compatibilidad, limitado a 500 registros)
router.get('/ciudadanos/:movilizadorId', requireRole('movilizador', 'admin'), async (req, res) => {
  try {
    if (req.user.rol === 'movilizador') {
      const [rows] = await db.execute(
        `SELECT id, nombre, paterno, materno, calle, no, colonia, seccion, cel, visitas
         FROM ciudadanos
         WHERE status_voto = 'pendiente' AND deleted = 0
         ORDER BY seccion, paterno
         LIMIT 500`
      );
      return res.json(rows);
    }
    const movilizadorId = parseId(req.params.movilizadorId);
    if (!movilizadorId) return res.status(400).json({ error: 'ID inválido' });
    const [rows] = await db.execute(
      `SELECT id, nombre, paterno, materno, calle, no, colonia, seccion, cel, visitas
       FROM ciudadanos
       WHERE movilizador_id = ? AND status_voto = 'pendiente' AND deleted = 0
       ORDER BY seccion, paterno
       LIMIT 500`,
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

    // Verificar que el ciudadano exista y esté pendiente
    if (req.user.rol === 'movilizador') {
      const [check] = await db.execute(
        'SELECT id FROM ciudadanos WHERE id = ? AND status_voto = "pendiente" AND deleted = 0',
        [ciudadanoId]
      );
      if (check.length === 0) {
        return res.status(403).json({ error: 'Este ciudadano no está disponible para visita' });
      }
    }

    // Bloquear si ya se registró una visita en los últimos 30 minutos
    const [recent] = await db.execute(
      'SELECT created_at FROM visitas_log WHERE ciudadano_id = ? ORDER BY created_at DESC LIMIT 1',
      [ciudadanoId]
    );
    if (recent.length > 0) {
      const diff = Date.now() - new Date(recent[0].created_at).getTime();
      if (diff < 30 * 60 * 1000) {
        const minutosRestantes = Math.ceil((30 * 60 * 1000 - diff) / 60000);
        return res.status(429).json({ error: 'VISITA_RECIENTE', minutosRestantes });
      }
    }

    const [result] = await db.execute(
      'UPDATE ciudadanos SET visitas = visitas + 1 WHERE id = ? AND deleted = 0',
      [ciudadanoId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Ciudadano no encontrado' });

    // Registrar en visitas_log para estadísticas por movilizador en tiempo real
    await db.execute(
      'INSERT INTO visitas_log (ciudadano_id, movilizador_id) VALUES (?, ?)',
      [ciudadanoId, req.user.id]
    );

    // Invalidar cache de estado: el RG verá datos actualizados en el siguiente poll
    estadoCache.ts = 0;

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
          WHEN ub.timestamp >= NOW() - INTERVAL 12 MINUTE THEN 'activo'
          ELSE 'inactivo'
        END AS estado,
        IFNULL(vl.total_visitas, 0) AS total_visitas,
        IFNULL(vl.ciudadanos_visitados, 0) AS ciudadanos_visitados,
        tot.total_pendientes AS ciudadanos_asignados
      FROM usuarios u
      CROSS JOIN (
        SELECT COUNT(*) AS total_pendientes
        FROM ciudadanos
        WHERE deleted = 0 AND status_voto = 'pendiente'
      ) tot
      LEFT JOIN (
        SELECT movilizador_id, lat, lng, timestamp,
          ROW_NUMBER() OVER (PARTITION BY movilizador_id ORDER BY timestamp DESC) AS rn
        FROM ubicaciones_movilizador
        WHERE timestamp >= NOW() - INTERVAL 24 HOUR
      ) ub ON ub.movilizador_id = u.id AND ub.rn = 1
      LEFT JOIN (
        SELECT
          movilizador_id,
          COUNT(*) AS total_visitas,
          COUNT(DISTINCT ciudadano_id) AS ciudadanos_visitados
        FROM visitas_log
        GROUP BY movilizador_id
      ) vl ON vl.movilizador_id = u.id
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
