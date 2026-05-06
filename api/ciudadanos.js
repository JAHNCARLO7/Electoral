const express = require('express');
const router = express.Router();
const db = require('./db');
const { requireRole } = require('./authMiddleware');

// Helper: validar que un param sea entero positivo
function parseId(val) {
  const id = parseInt(val, 10);
  return (!isNaN(id) && id > 0) ? id : null;
}

// Helper: validar que sección sea alfanumérico (prevenir inyección)
function validSeccion(val) {
  return typeof val === 'string' && /^[A-Za-z0-9\-]{1,20}$/.test(val.trim());
}

// Cache simple para estadísticas pesadas (50K filas con GROUP BY)
let statsCache = { data: null, ts: 0 };
const STATS_CACHE_TTL = 10_000; // 10 segundos

// Obtener todas las secciones disponibles (requiere autenticación — role check en authMiddleware)
router.get('/secciones', requireRole('casillero', 'rp', 'admin', 'movilizador'), async (req, res) => {
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
router.get('/seccion/:seccion', requireRole('casillero', 'rp', 'admin', 'movilizador'), async (req, res) => {
  try {
    const { seccion } = req.params;
    if (!validSeccion(seccion)) return res.status(400).json({ error: 'Sección inválida' });
    const [rows] = await db.execute(
      'SELECT id, nombre, paterno, materno FROM ciudadanos WHERE seccion = ? AND status_voto = "pendiente" AND deleted = 0',
      [seccion.trim()]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener ciudadanos' });
  }
});

// Registrar voto de un ciudadano (solo casillero y admin)
router.put('/votar/:id', requireRole('casillero', 'admin'), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID inválido' });
    const [result] = await db.execute(
      'UPDATE ciudadanos SET status_voto = "voto" WHERE id = ? AND deleted = 0 AND status_voto = "pendiente"',
      [id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Ciudadano no encontrado o ya votó' });
    }
    // Invalidar cache de estadísticas
    statsCache.ts = 0;
    res.json({ success: true, mensaje: 'Voto registrado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar voto' });
  }
});

// Estadísticas de votos por sección (para RP) — con caché
router.get('/estadisticas/votos', requireRole('rp', 'admin'), async (req, res) => {
  try {
    if (statsCache.data && (Date.now() - statsCache.ts < STATS_CACHE_TTL)) {
      return res.json(statsCache.data);
    }
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
    statsCache = { data: rows, ts: Date.now() };
    res.json(rows);
  } catch (error) {
    console.error('Error en /estadisticas/votos:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas de votos' });
  }
});

// ========== CRUD CIUDADANOS (ADMIN) ==========

// Listar ciudadanos con paginación (para admin)
router.get('/todos', requireRole('admin'), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 100));
    const search = (req.query.search || '').substring(0, 100).replace(/[%_\\]/g, '\\$&'); // Sanitizar wildcards SQL y limitar longitud
    const offset = (page - 1) * limit;

    let whereExtra = '';
    let params = [];
    if (search) {
      whereExtra = ` AND (c.nombre LIKE ? OR c.paterno LIKE ? OR c.materno LIKE ? OR c.seccion LIKE ?)`;
      const like = `%${search}%`;
      params = [like, like, like, like];
    }

    const [[{ total }]] = await db.execute(
      `SELECT COUNT(*) as total FROM ciudadanos c WHERE c.deleted = 0${whereExtra}`,
      params
    );

    const [rows] = await db.execute(`
      SELECT c.id, c.nombre, c.paterno, c.materno, c.calle, c.no, c.colonia,
             c.seccion, c.cel, c.movilizador_id, c.status_voto, c.visitas,
             u.nombre AS movilizador_nombre
      FROM ciudadanos c
      LEFT JOIN usuarios u ON c.movilizador_id = u.id
      WHERE c.deleted = 0${whereExtra}
      ORDER BY c.seccion, c.paterno, c.materno
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    res.json({ rows, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('Error en /todos:', error);
    res.status(500).json({ error: 'Error al obtener ciudadanos' });
  }
});

// Listar movilizadores disponibles (para selector de asignación)
router.get('/movilizadores-disponibles', requireRole('admin'), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, nombre FROM usuarios WHERE rol = 'movilizador' AND activo = 1 ORDER BY nombre`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener movilizadores' });
  }
});

// Crear ciudadano (solo admin)
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { nombre, paterno, materno, calle, no, colonia, seccion, cel, movilizador_id } = req.body;
    if (!nombre || !paterno || !seccion) {
      return res.status(400).json({ error: 'Nombre, apellido paterno y sección son requeridos' });
    }
    // Validar longitudes máximas
    const fields = { nombre, paterno, materno, calle, colonia, seccion, cel };
    for (const [k, v] of Object.entries(fields)) {
      if (v && String(v).length > 150) return res.status(400).json({ error: `Campo ${k} demasiado largo` });
    }
    // Validar movilizador_id si se envía
    if (movilizador_id) {
      const movId = parseId(movilizador_id);
      if (!movId) return res.status(400).json({ error: 'movilizador_id inválido' });
      const [movCheck] = await db.execute(
        'SELECT id FROM usuarios WHERE id = ? AND rol = "movilizador" AND activo = 1', [movId]
      );
      if (movCheck.length === 0) return res.status(400).json({ error: 'Movilizador no encontrado o inactivo' });
    }
    const [result] = await db.execute(
      `INSERT INTO ciudadanos (nombre, paterno, materno, calle, no, colonia, seccion, cel, movilizador_id, status_voto, visitas, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', 0, 0)`,
      [nombre.trim(), paterno.trim(), (materno || '').trim(), (calle || '').trim(), (no || '').trim(), (colonia || '').trim(), seccion.trim(), (cel || '').trim(), movilizador_id || null]
    );
    res.json({ success: true, id: result.insertId });
  } catch (error) {
    console.error('Error al crear ciudadano:', error);
    res.status(500).json({ error: 'Error al crear ciudadano' });
  }
});

// Actualizar ciudadano (solo admin)
router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID inválido' });
    const { nombre, paterno, materno, calle, no, colonia, seccion, cel, movilizador_id } = req.body;
    const fields = [nombre, paterno, materno, calle, no, colonia, seccion, cel];
    if (fields.some(f => typeof f === 'string' && f.length > 150)) {
      return res.status(400).json({ error: 'Campos demasiado largos (máx 150 caracteres)' });
    }
    const [result] = await db.execute(
      `UPDATE ciudadanos SET nombre=?, paterno=?, materno=?, calle=?, no=?, colonia=?, seccion=?, cel=?, movilizador_id=? WHERE id=? AND deleted = 0`,
      [(nombre||'').trim(), (paterno||'').trim(), (materno||'').trim(), (calle||'').trim(), (no||'').trim(), (colonia||'').trim(), (seccion||'').trim(), (cel||'').trim(), movilizador_id || null, id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Ciudadano no encontrado' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error al actualizar ciudadano:', error);
    res.status(500).json({ error: 'Error al actualizar ciudadano' });
  }
});

// Eliminar ciudadano — soft delete (solo admin)
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID inválido' });
    const [result] = await db.execute('UPDATE ciudadanos SET deleted = 1 WHERE id = ? AND deleted = 0', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Ciudadano no encontrado' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar ciudadano' });
  }
});

module.exports = router;