// Endpoint de login seguro con bcrypt
const express = require('express');
const router = express.Router();
const pool = require('./db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { generateToken, authMiddleware, invalidateSessionCache } = require('./authMiddleware');

// Caracteres permitidos en usuario (prevenir inyección en logs)
const VALID_USERNAME = /^[a-zA-Z0-9._@\-]{1,50}$/;

// POST /login { usuario, password }
router.post('/login', async (req, res) => {
  const usuario = (req.body.usuario || '').trim();
  const password = req.body.password || '';
  if (!usuario || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }
  if (usuario.length > 50 || password.length > 100) {
    return res.status(400).json({ error: 'Datos inválidos' });
  }
  if (!VALID_USERNAME.test(usuario)) {
    return res.status(400).json({ error: 'Formato de usuario inválido' });
  }
  try {
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

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
    }

    // Generar session_token único — invalida cualquier sesión anterior
    const sessionToken = crypto.randomBytes(32).toString('hex');

    // Actualizar ultimo_login y session_token
    await pool.execute('UPDATE usuarios SET ultimo_login = NOW(), session_token = ? WHERE id = ?', [sessionToken, user.id]);
    // Invalidar caché inmediatamente para que la nueva sesión sea válida de inmediato
    invalidateSessionCache(user.id);

    const token = generateToken(user, sessionToken);
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        usuario: user.usuario,
        rol: user.rol,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// GET /me — heartbeat para detectar sesiones eliminadas o reemplazadas
router.get('/me', authMiddleware, (req, res) => {
  res.json({ ok: true });
});

module.exports = router;
