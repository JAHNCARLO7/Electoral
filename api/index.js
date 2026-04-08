// API básica con Express para autenticación
const express = require('express');
const cors = require('cors');
const app = express();
const port = 8080;

app.use(cors());
app.use(express.json());

// Endpoint de prueba
app.get('/', (req, res) => {
  res.send('API Electoral funcionando');
});


// Endpoints de autenticación
const authRouter = require('./auth');
app.use('/api/auth', authRouter);

// Endpoints de usuarios (solo admin)
console.log('Cargando users.js...');
const usersRouter = require('./users');
console.log('users.js cargado:', typeof usersRouter);
app.use('/api/users', usersRouter);

const ciudadanosRouter = require('./ciudadanos');
app.use('/api/ciudadanos', ciudadanosRouter);

// Endpoints de movilizadores
const movilizadoresRouter = require('./movilizadores');
app.use('/api/movilizadores', movilizadoresRouter);

app.listen(port, '0.0.0.0', () => {
  console.log(`API Electoral escuchando en http://localhost:${port}`);
});
