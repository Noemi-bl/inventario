const OFFSET = process.env.OFFSET_HORARIO || '-05:00';
const ZONA = process.env.ZONA_HORARIA || 'America/Lima';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Convierte Timestamps de Firestore a texto ISO (recursivo)
function limpiar(valor) {
  if (valor && typeof valor.toDate === 'function') return valor.toDate().toISOString();
  if (Array.isArray(valor)) return valor.map(limpiar);
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, limpiar(v)]));
  }
  return valor;
}

const docAJson = (doc) => ({ id: doc.id, ...limpiar(doc.data()) });

// Evita que un error en una ruta async tumbe el servidor
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const redondear = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

function hoyLocal() {
  return new Date().toLocaleDateString('en-CA', { timeZone: ZONA }); // YYYY-MM-DD
}

function inicioDia(fechaStr) {
  return new Date(`${fechaStr}T00:00:00.000${OFFSET}`);
}

function finDia(fechaStr) {
  return new Date(`${fechaStr}T23:59:59.999${OFFSET}`);
}

// Lee ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD (por defecto: hoy)
function leerRango(query) {
  const hoy = hoyLocal();
  const desde = query.desde || hoy;
  const hasta = query.hasta || desde;
  if (!FECHA_RE.test(desde) || !FECHA_RE.test(hasta)) {
    throw new HttpError(400, 'Las fechas deben tener el formato AAAA-MM-DD');
  }
  const ini = inicioDia(desde);
  const fin = finDia(hasta);
  if (Number.isNaN(ini.getTime()) || Number.isNaN(fin.getTime()) || ini > fin) {
    throw new HttpError(400, 'Rango de fechas inválido');
  }
  return { desde, hasta, ini, fin };
}

function texto(valor, { campo, requerido = false, max = 120 } = {}) {
  const t = typeof valor === 'string' ? valor.trim() : '';
  if (requerido && !t) throw new HttpError(400, `El campo "${campo}" es obligatorio`);
  if (t.length > max) throw new HttpError(400, `El campo "${campo}" no puede superar ${max} caracteres`);
  return t;
}

function numero(valor, { campo, min = 0, max = 1e9, entero = false } = {}) {
  const n = Number(valor);
  if (valor === '' || valor === null || valor === undefined || !Number.isFinite(n)) {
    throw new HttpError(400, `El campo "${campo}" debe ser un número`);
  }
  if (entero && !Number.isInteger(n)) throw new HttpError(400, `El campo "${campo}" debe ser un entero`);
  if (n < min || n > max) throw new HttpError(400, `El campo "${campo}" debe estar entre ${min} y ${max}`);
  return n;
}

module.exports = {
  HttpError,
  limpiar,
  docAJson,
  asyncHandler,
  redondear,
  FECHA_RE,
  hoyLocal,
  inicioDia,
  finDia,
  leerRango,
  texto,
  numero,
};
