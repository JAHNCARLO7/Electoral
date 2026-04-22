// Endpoints para gestión de usuarios (solo admin)
const express = require('express');
const router = express.Router();
const pool = require('./db');
const bcrypt = require('bcrypt');

// Helper: validar ID entero positivo
function parseId(val) {
  const id = parseInt(val, 10);
  return (!isNaN(id) && id > 0) ? id : null;
}

const VALID_ROLES = ['admin', 'movilizador', 'casillero', 'rp'];

// Desactivar usuario (soft delete — solo admin)
router.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'ID inválido' });
  // No permitir eliminarse a sí mismo
  if (req.user.id === id) {
    return res.status(400).json({ success: false, error: 'No puedes desactivar tu propia cuenta' });
  }
  try {
    const [result] = await pool.execute('UPDATE usuarios SET activo = 0 WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error al desactivar usuario:', err);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// Obtener usuario por ID
router.get('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'ID inválido' });
  try {
    const [rows] = await pool.execute('SELECT id, nombre, usuario, rol, activo FROM usuarios WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    res.json({ success: true, user: rows[0] });
  } catch (err) {
    console.error('Error al obtener usuario:', err);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// Obtener todos los usuarios activos
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, nombre, usuario, rol, activo FROM usuarios');
    res.json({ success: true, users: rows });
  } catch (err) {
    console.error('Error al listar usuarios:', err);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// Crear nuevo usuario
router.post('/', async (req, res) => {
  const { usuario, password, nombre, rol } = req.body;
  if (!usuario || !password || !nombre || !rol) {
    return res.status(400).json({ success: false, error: 'Faltan datos' });
  }
  if (usuario.length > 50 || nombre.length > 100 || password.length > 100) {
    return res.status(400).json({ success: false, error: 'Datos demasiado largos' });
  }
  if (!VALID_ROLES.includes(rol)) {
    return res.status(400).json({ success: false, error: 'Rol inválido' });
  }
  // Validar contraseña: mínimo 4 dígitos, solo números, no repetida
  if (!/^[0-9]{4,}$/.test(password)) {
    return res.status(400).json({ success: false, error: 'La contraseña debe tener al menos 4 dígitos numéricos' });
  }
  // Verificar que la contraseña no exista ya en la base de datos
  const [existing] = await pool.execute('SELECT id FROM usuarios WHERE password_hash = ?', [await bcrypt.hash(password, 12)]);
  if (existing.length > 0) {
    return res.status(400).json({ success: false, error: 'La contraseña ya está en uso, elige otra diferente.' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      'INSERT INTO usuarios (usuario, password_hash, nombre, rol, activo) VALUES (?, ?, ?, ?, 1)',
      [usuario.trim(), hashedPassword, nombre.trim(), rol]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error al guardar usuario:', err);
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, error: 'El usuario ya existe' });
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});


// Actualizar usuario (admin)
router.put('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'ID inválido' });
  const { nombre, usuario, password, rol, activo } = req.body;
  if (!nombre && !usuario && !password && !rol && typeof activo === 'undefined') {
    return res.status(400).json({ success: false, error: 'No hay datos para actualizar' });
  }
  // Validar longitudes
  if (nombre && nombre.length > 100) return res.status(400).json({ success: false, error: 'Nombre demasiado largo' });
  if (usuario && usuario.length > 50) return res.status(400).json({ success: false, error: 'Usuario demasiado largo' });
  if (password && password.length > 100) return res.status(400).json({ success: false, error: 'Contraseña demasiado larga' });
  if (rol && !VALID_ROLES.includes(rol)) return res.status(400).json({ success: false, error: 'Rol inválido' });
  let fields = [];
  let values = [];
  if (nombre) { fields.push('nombre = ?'); values.push(nombre.trim()); }
  if (usuario) { fields.push('usuario = ?'); values.push(usuario.trim()); }
  if (password) {
    if (!/^[0-9]{4,}$/.test(password)) return res.status(400).json({ success: false, error: 'La contraseña debe tener al menos 4 dígitos numéricos' });
    // Verificar que la contraseña no exista ya en la base de datos
    const [existing] = await pool.execute('SELECT id FROM usuarios WHERE password_hash = ?', [await bcrypt.hash(password, 12)]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: 'La contraseña ya está en uso, elige otra diferente.' });
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    fields.push('password_hash = ?'); values.push(hashedPassword);
  }
  if (rol) { fields.push('rol = ?'); values.push(rol); }
  if (typeof activo !== 'undefined') { fields.push('activo = ?'); values.push(activo ? 1 : 0); }
  values.push(id);
  try {
    const [result] = await pool.execute(
      `UPDATE usuarios SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    res.json({ success: true, result });
  } catch (err) {
    console.error('Error al actualizar usuario:', err);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

module.exports = router;
