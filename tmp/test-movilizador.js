const fetch = require('node-fetch');
(async () => {
  const users = [
    { usuario: 'mov', password: '9999' },
    { usuario: 'movi', password: '1111' }
  ];

  for (const u of users) {
    try {
      console.log('=== LOGIN', u.usuario, '===');
      const loginRes = await fetch('http://localhost:8080/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: u.usuario, password: u.password }),
      });
      const loginBody = await loginRes.text();
      console.log('login status', loginRes.status, 'body', loginBody);
      if (loginRes.status !== 200) continue;
      const token = JSON.parse(loginBody).token;
      const secRes = await fetch('http://localhost:8080/api/movilizadores/secciones-resumen', {
        headers: { Authorization: 'Bearer ' + token },
      });
      const secBody = await secRes.text();
      console.log('/secciones-resumen', secRes.status, secBody);
      if (secRes.status !== 200) continue;
      const sections = JSON.parse(secBody);
      for (const section of sections) {
        const url = 'http://localhost:8080/api/movilizadores/ciudadanos-seccion/' + encodeURIComponent(section.seccion);
        const cRes = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
        const cBody = await cRes.text();
        console.log('  section', section.seccion, 'status', cRes.status, 'body', cBody);
      }
    } catch (err) {
      console.error('ERR', err.message);
    }
  }
})();