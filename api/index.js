// API básica con Express para autenticación
require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { authMiddleware, requireRole } = require('./authMiddleware');
const db = require('./db');
const app = express();
const port = process.env.PORT || 8080;

// Trust proxy (requerido detrás de AWS ALB/CloudFront para rate limiting correcto)
app.set('trust proxy', 1);

// Security headers (XSS, clickjacking, MIME sniffing, etc.)
app.use(helmet({
  contentSecurityPolicy: false, // Desactivada para API pura
  crossOriginEmbedderPolicy: false,
}));

// Ocultar header X-Powered-By (no revelar que usamos Express)
app.disable('x-powered-by');

// CORS: permitir solo orígenes conocidos
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:8081', 'http://localhost:8082', 'http://localhost:8083', 'http://localhost:19006'];
app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (mobile apps, curl)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Origen no permitido por CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 600, // Cache preflight 10 minutos
}));
app.use(express.json({ limit: '500kb' }));

// Rate limiting global
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // 100 requests por IP por minuto
  standardHeaders: true,
  message: { error: 'Demasiadas solicitudes, intenta en un minuto' },
});
app.use('/api', limiter);

// Health check para AWS ALB
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(503).json({ status: 'error', message: 'DB no disponible' });
  }
});

// Endpoint de prueba (no revelar info del sistema)
app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

// Endpoints de autenticación (SIN auth middleware)
const authRouter = require('./auth');
app.use('/api/auth', authRouter);

// Endpoints protegidos con JWT
const usersRouter = require('./users');
app.use('/api/users', authMiddleware, requireRole('admin'), usersRouter);

const ciudadanosRouter = require('./ciudadanos');
app.use('/api/ciudadanos', authMiddleware, ciudadanosRouter);

const movilizadoresRouter = require('./movilizadores');
app.use('/api/movilizadores', authMiddleware, movilizadoresRouter);

// Limpieza de ubicaciones viejas (cada 6 horas, elimina registros >24h)
setInterval(async () => {
  try {
    const [result] = await db.query('DELETE FROM ubicaciones_movilizador WHERE timestamp < NOW() - INTERVAL 24 HOUR');
    if (result.affectedRows > 0) console.log(`Limpieza: ${result.affectedRows} ubicaciones antiguas eliminadas`);
  } catch (e) {
    console.warn('Error en limpieza de ubicaciones:', e.message);
  }
}, 6 * 60 * 60 * 1000);

// Manejo global de errores (no filtrar stack traces en producción)
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Ruta catch-all para 404
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`API Electoral escuchando en puerto ${port}`);
});
