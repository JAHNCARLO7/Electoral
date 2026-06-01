require('dotenv').config({ path: __dirname + '/../api/.env' });
const pool = require('../api/db');
(async () => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, usuario, rol, activo, session_token, ultimo_login FROM usuarios WHERE rol = ? LIMIT 50',
      ['movilizador']
    );
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
})();