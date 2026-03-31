// Endpoint de login seguro con bcrypt y validación de activo
const express = require('express');
const router = express.Router();
const pool = require('./db');
const bcrypt = require('bcrypt');


// POST /login { usuario, password }
// MODO PRUEBA: compara la contraseña en texto plano (INSEGURO, SOLO PARA DESARROLLO)
router.post('/login', async (req, res) => {
  console.log('Llega al login', req.body);
  const { usuario, password } = req.body;
  if (!usuario || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }
  try {
    // Buscar usuario activo
    const [rows] = await pool.execute(
      'SELECT id, nombre, usuario, password_hash, rol, activo FROM usuarios WHERE usuario = ? LIMIT 1',
      [usuario]
    );
    if (rows.length !== 1) {
      return res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
    }
    const user = rows[0];
    if (!user.activo) {
      return res.status(403).json({ success: false, error: 'Usuario inactivo' });
    }
    // 1. Intenta comparar con bcrypt
    let match = false;
    try {
      match = await bcrypt.compare(password, user.password_hash);
    } catch (e) {
      match = false;
    }

    // 2. Si no coincide, intenta comparar en texto plano
    if (!match && password === user.password_hash) {
      // Migrar: encripta y actualiza la contraseña
      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.execute('UPDATE usuarios SET password_hash = ? WHERE id = ?', [hashedPassword, user.id]);
      match = true;
    }

    if (!match) {
      return res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
    }
    // Login exitoso, devolver datos relevantes
    res.json({
      success: true,
      user: {
        id: user.id,
        nombre: user.nombre,
        usuario: user.usuario,
        rol: user.rol,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Error en el servidor', details: err.message });
  }
});

module.exports = router;
