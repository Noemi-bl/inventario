export const ZONA = 'America/Lima';

export const dinero = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

export const fechaHora = (iso) =>
  iso
    ? new Date(iso).toLocaleString('es-PE', { timeZone: ZONA, dateStyle: 'short', timeStyle: 'short' })
    : '—';

// Fecha de hoy en Lima con formato AAAA-MM-DD
export const hoyISO = () => new Date().toLocaleDateString('en-CA', { timeZone: ZONA });

// Muestra AAAA-MM-DD como DD/MM/AAAA
export const fechaCorta = (f) => (f ? f.split('-').reverse().join('/') : '—');

export const METODOS = [
  { id: 'efectivo', nombre: 'Efectivo' },
  { id: 'yape', nombre: 'Yape' },
  { id: 'plin', nombre: 'Plin' },
  { id: 'tarjeta', nombre: 'Tarjeta' },
];

export const nombreMetodo = (id) => (METODOS.find((m) => m.id === id) || { nombre: id }).nombre;

// Fecha (AAAA-MM-DD) de hace N días, en hora de Lima
export const fechaISOHaceDias = (n) =>
  new Date(Date.now() - n * 86400000).toLocaleDateString('en-CA', { timeZone: ZONA });

// Días que faltan para una fecha AAAA-MM-DD (negativo si ya pasó)
export function diasHasta(fecha) {
  if (!fecha) return null;
  const a = new Date(`${hoyISO()}T00:00:00Z`);
  const b = new Date(`${fecha}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

export function textoVencimiento(fecha) {
  const d = diasHasta(fecha);
  if (d === null) return '';
  if (d < 0) return `vencido hace ${-d} d`;
  if (d === 0) return 'vence hoy';
  return `en ${d} d`;
}
