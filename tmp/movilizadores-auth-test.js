require('dotenv').config({ path: __dirname + '/../api/.env' });
const pool = require('../api/db');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
(async () => {
  try {
    const [rows] = await pool.execute('SELECT id, usuario, nombre, rol, session_token FROM usuarios WHERE usuario = ?', ['movi']);
    if (!rows.length) {
      console.error('Usuario movi no existe');
      process.exit(1);
    }
    const user = rows[0];
    const token = jwt.sign({ id: user.id, rol: user.rol, nombre: user.nombre, sid: user.session_token }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '8h' });
    const apiPort = process.argv[2] || process.env.API_PORT || 8080;
    const baseUrl = `http://localhost:${apiPort}`;
    console.log('apiPort', apiPort);
    console.log('token', token.slice(0, 80) + '...');
    const endpoints = [
      {url: `${baseUrl}/api/movilizadores/secciones-resumen`, name: 'secciones-resumen'},
      {url: `${baseUrl}/api/movilizadores/ciudadanos-seccion/101`, name: 'ciudadanos-seccion/101'}
    ];
    for (const ep of endpoints) {
      const res = await fetch(ep.url, { headers: { Authorization: 'Bearer ' + token } });
      const text = await res.text();
      console.log(ep.name, res.status, text);
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
})();