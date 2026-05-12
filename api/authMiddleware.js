// Middleware de autenticación JWT
const jwt = require('jsonwebtoken');
const pool = require('./db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: La variable de entorno JWT_SECRET no está configurada.');
  process.exit(1);
}
if (JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET debe tener al menos 32 caracteres.');
  process.exit(1);
}

// Algoritmo permitido (previene algorithm confusion attacks)
const JWT_ALGORITHM = 'HS256';

// Blacklist en memoria de usuarios desactivados (evita consulta DB en cada request)
const deletedUserIds = new Set();
function markUserDeleted(userId) {
  deletedUserIds.add(Number(userId));
  sessionCache.delete(Number(userId)); // invalidar cache de sesión
}

function invalidateSessionCache(userId) {
  sessionCache.delete(Number(userId));
}

// Cache de session_token por usuario (TTL 30s — evita consulta DB en cada request)
const sessionCache = new Map(); // userId -> { token, ts }
const SESSION_CACHE_TTL = 30_000;

// Limpiar entradas viejas del cache cada 10 minutos para evitar memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of sessionCache) {
    if (now - val.ts > SESSION_CACHE_TTL * 2) sessionCache.delete(key);
  }
}, 10 * 60 * 1000);

async function validateSession(userId, sessionToken) {
  const cached = sessionCache.get(userId);
  if (cached && (Date.now() - cached.ts < SESSION_CACHE_TTL)) {
    return cached.token === sessionToken;
  }
  const [rows] = await pool.execute('SELECT session_token FROM usuarios WHERE id = ? AND activo = 1 LIMIT 1', [userId]);
  if (!rows.length) return false;
  const dbToken = rows[0].session_token;
  sessionCache.set(userId, { token: dbToken, ts: Date.now() });
  return dbToken === sessionToken;
}

// Generar token
function generateToken(user, sessionToken) {
  return jwt.sign(
    { id: user.id, rol: user.rol, nombre: user.nombre, sid: sessionToken },
    JWT_SECRET,
    { expiresIn: '8h', algorithm: JWT_ALGORITHM }
  );
}

// Middleware: verificar token
async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  const token = header.split(' ')[1];
  if (!token || token.length > 2000) {
    return res.status(401).json({ error: 'Token inválido' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
    if (deletedUserIds.has(decoded.id)) {
      return res.status(401).json({ error: 'USER_DELETED' });
    }
    // Verificar sesión única (invalida tokens de otros dispositivos)
    if (decoded.sid) {
      const valid = await validateSession(decoded.id, decoded.sid);
      if (!valid) return res.status(401).json({ error: 'SESSION_REPLACED' });
    }
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// Middleware: solo ciertos roles
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'Sin permisos' });
    }
    next();
  };
}

// NO exportar JWT_SECRET — solo se usa internamente
module.exports = { generateToken, authMiddleware, requireRole, markUserDeleted, invalidateSessionCache };
