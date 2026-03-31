
// Endpoints para gestión de usuarios (solo admin)
const express = require('express');
const router = express.Router();
const pool = require('./db');
const bcrypt = require('bcrypt');

// Obtener usuario por ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.execute('SELECT id, nombre, usuario, rol, activo FROM usuarios WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    res.json({ success: true, user: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Obtener todos los usuarios activos
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, nombre, usuario, rol, activo FROM usuarios');
    res.json({ success: true, users: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Crear nuevo usuario
router.post('/', async (req, res) => {
  console.log('Intentando crear usuario', req.body);
  const { usuario, password, nombre, rol } = req.body;
  if (!usuario || !password || !nombre || !rol) {
    console.error('Faltan datos en el registro:', req.body);
    return res.status(400).json({ success: false, error: 'Faltan datos' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      'INSERT INTO usuarios (usuario, password_hash, nombre, rol, activo) VALUES (?, ?, ?, ?, 1)',
      [usuario, hashedPassword, nombre, rol]
    );
    console.log('Resultado del INSERT:', result);
    res.json({ success: true });
  } catch (err) {
    console.error('Error al guardar usuario:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// Actualizar usuario (admin)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, usuario, password, rol, activo } = req.body;
  if (!nombre && !usuario && !password && !rol && typeof activo === 'undefined') {
    return res.status(400).json({ success: false, error: 'No hay datos para actualizar' });
  }
  let fields = [];
  let values = [];
  if (nombre) { fields.push('nombre = ?'); values.push(nombre); }
  if (usuario) { fields.push('usuario = ?'); values.push(usuario); }
  if (password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    fields.push('password_hash = ?'); values.push(hashedPassword);
  }
  if (rol) { fields.push('rol = ?'); values.push(rol); }
  if (typeof activo !== 'undefined') { fields.push('activo = ?'); values.push(activo); }
  values.push(id);
  try {
    const [result] = await pool.execute(
      `UPDATE usuarios SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
