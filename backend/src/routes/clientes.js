const router = require('express').Router();
const { db, FieldValue } = require('../firebase');
const { requerirRol } = require('../middleware/auth');
const { HttpError, asyncHandler, docAJson, texto } = require('../utils');

const col = db.collection('clientes');

function leerCliente(body) {
  const dni = texto(body.dni, { campo: 'DNI', max: 8 });
  if (dni && !/^\d{8}$/.test(dni)) throw new HttpError(400, 'El DNI debe tener 8 dígitos');
  const telefono = texto(body.telefono, { campo: 'teléfono', max: 15 });
  if (telefono && !/^[\d+\s-]{6,15}$/.test(telefono)) throw new HttpError(400, 'Teléfono inválido');
  return {
    nombre: texto(body.nombre, { campo: 'nombre', requerido: true, max: 120 }),
    dni,
    telefono,
  };
}

async function dniEnUso(dni, ignorarId) {
  if (!dni) return false;
  const snap = await col.where('dni', '==', dni).get();
  return snap.docs.some((d) => d.id !== ignorarId);
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const snap = await col.get();
    res.json(snap.docs.map(docAJson).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const datos = leerCliente(req.body);
    if (await dniEnUso(datos.dni)) throw new HttpError(409, 'Ya existe un cliente con ese DNI');
    const ref = await col.add({ ...datos, creadoEn: FieldValue.serverTimestamp() });
    res.status(201).json({ id: ref.id, ...datos });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const ref = col.doc(req.params.id);
    if (!(await ref.get()).exists) throw new HttpError(404, 'Cliente no encontrado');
    const datos = leerCliente(req.body);
    if (await dniEnUso(datos.dni, ref.id)) throw new HttpError(409, 'Ya existe un cliente con ese DNI');
    await ref.update({ ...datos, actualizadoEn: FieldValue.serverTimestamp() });
    res.json({ id: ref.id, ...datos });
  })
);

router.delete(
  '/:id',
  requerirRol('admin'),
  asyncHandler(async (req, res) => {
    const ref = col.doc(req.params.id);
    if (!(await ref.get()).exists) throw new HttpError(404, 'Cliente no encontrado');
    await ref.delete();
    res.json({ ok: true });
  })
);

module.exports = router;
