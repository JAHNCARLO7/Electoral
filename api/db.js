// Configuración de conexión a MySQL para electoral_db
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'database',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_POOL_SIZE) || 25,
  queueLimit: 100,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  // Timeouts para evitar queries colgados
  connectTimeout: 10000,
});

// Crear índices optimizados si no existen (se ejecuta una vez al iniciar)
(async () => {
  try {
    // Índice compuesto optimizado: las queries más comunes filtran por deleted + seccion + status_voto
    await pool.query('CREATE INDEX IF NOT EXISTS idx_ciud_del_sec_status ON ciudadanos (deleted, seccion, status_voto)');
    // Para buscar ciudadanos por movilizador (pantalla movilizador)
    await pool.query('CREATE INDEX IF NOT EXISTS idx_ciud_mov_del_status ON ciudadanos (movilizador_id, deleted, status_voto)');
    // Para el GROUP BY movilizador_id en la query de estado
    await pool.query('CREATE INDEX IF NOT EXISTS idx_ciud_mov_del ON ciudadanos (movilizador_id, deleted)');
    // Para búsqueda paginada de admin
    await pool.query('CREATE INDEX IF NOT EXISTS idx_ciud_del_paterno ON ciudadanos (deleted, seccion, paterno, materno)');
    // Ubicaciones: la subquery usa movilizador_id + timestamp DESC
    await pool.query('CREATE INDEX IF NOT EXISTS idx_ubic_mov_ts ON ubicaciones_movilizador (movilizador_id, timestamp DESC)');
    // Limpieza periódica de ubicaciones
    await pool.query('CREATE INDEX IF NOT EXISTS idx_ubic_ts ON ubicaciones_movilizador (timestamp)');
    // Usuarios: login por nombre de usuario
    await pool.query('CREATE INDEX IF NOT EXISTS idx_usuarios_usuario ON usuarios (usuario)');
    // Usuarios: filtro por rol + activo (para listar movilizadores)
    await pool.query('CREATE INDEX IF NOT EXISTS idx_usuarios_rol_activo ON usuarios (rol, activo)');
    console.log('Índices de BD verificados');
  } catch (e) {
    console.warn('No se pudieron crear índices (puede que ya existan):', e.message);
  }
})();

module.exports = pool;
