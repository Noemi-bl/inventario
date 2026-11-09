require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

require('./src/firebase'); // inicializa Firebase Admin (falla con un mensaje claro si falta la clave)
const { autenticar, requerirRol } = require('./src/middleware/auth');
const { HttpError } = require('./src/utils');

const app = express();
const PORT = process.env.PORT || 3000;

const origenesPermitidos = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(helmet());
app.use(
  cors({
    origin(origin, cb) {
      // Permite herramientas sin origen (Postman, curl) y los orígenes configurados
      if (!origin || origenesPermitidos.includes(origin)) return cb(null, true);
      cb(new Error('Origen no permitido por CORS'));
    },
  })
);
app.use(express.json({ limit: '100kb' }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false }));

// Pública: para comprobar que el servidor está arriba
app.get('/api/health', (req, res) => res.json({ ok: true, servicio: 'Nova Salud - Inventario' }));

// Pública: solicitud de cuenta nueva (límite estricto: 10 por hora por IP)
app.use(
  '/api/registro',
  rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false }),
  require('./src/routes/registro')
);

// Todo lo demás exige sesión iniciada
app.use('/api', autenticar);
app.use('/api/usuarios', require('./src/routes/usuarios'));
app.use('/api/productos', require('./src/routes/productos'));
app.use('/api/clientes', require('./src/routes/clientes'));
app.use('/api/ventas', require('./src/routes/ventas'));
app.use('/api/reportes', requerirRol('admin'), require('./src/routes/reportes'));

app.use('/api', (req, res, next) => next(new HttpError(404, 'Ruta no encontrada')));

// Manejo central de errores
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => console.log(`API de inventario escuchando en http://localhost:${PORT}`));
