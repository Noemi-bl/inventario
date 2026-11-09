import { auth } from './firebaseConfig';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function peticion(metodo, ruta, cuerpo) {
  const usuario = auth.currentUser;
  const token = usuario ? await usuario.getIdToken() : null;

  let res;
  try {
    res = await fetch(`${BASE}/api${ruta}`, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor. Verifica que el backend esté encendido.');
  }

  let datos = null;
  try {
    datos = await res.json();
  } catch {
    /* respuesta sin cuerpo */
  }
  if (!res.ok) throw new Error((datos && datos.error) || `Error ${res.status}`);
  return datos;
}

export const api = {
  get: (ruta) => peticion('GET', ruta),
  post: (ruta, cuerpo = {}) => peticion('POST', ruta, cuerpo),
  put: (ruta, cuerpo) => peticion('PUT', ruta, cuerpo),
  del: (ruta) => peticion('DELETE', ruta),
};
