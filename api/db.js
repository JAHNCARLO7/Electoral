// Configuración de conexión a MySQL para electoral_db
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root', // Cambia si tu usuario es diferente
  password: '', // Cambia si tienes contraseña
  database: 'database',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;
