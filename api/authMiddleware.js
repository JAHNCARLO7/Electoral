// Middleware de autenticación JWT
const jwt = require('jsonwebtoken');

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
function markUserDeleted(userId) { deletedUserIds.add(Number(userId)); }

// Generar token
function generateToken(user) {
  return jwt.sign(
    { id: user.id, rol: user.rol, nombre: user.nombre },
    JWT_SECRET,
    { expiresIn: '8h', algorithm: JWT_ALGORITHM }
  );
}

// Middleware: verificar token
function authMiddleware(req, res, next) {
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
module.exports = { generateToken, authMiddleware, requireRole, markUserDeleted };
