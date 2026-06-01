require('dotenv').config({ path: __dirname + '/../api/.env' });
const db = require('../api/db');
(async () => {
  try {
    const query = `SELECT c.id, c.nombre, c.paterno, c.materno, c.calle, c.no, c.colonia, c.seccion, c.cel, c.visitas,
       MAX(vl.created_at) AS ultima_visita
       FROM ciudadanos c
       LEFT JOIN visitas_log vl ON vl.ciudadano_id = c.id
       WHERE c.seccion = ? AND c.status_voto = 'pendiente' AND c.deleted = 0
       GROUP BY c.id
       ORDER BY c.paterno, c.materno, c.nombre`;
    const [rows] = await db.execute(query, ['101']);
    console.log('rows', rows);
  } catch (err) {
    console.error('ERR', err);
  } finally {
    process.exit(0);
  }
})();