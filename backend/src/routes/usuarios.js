const router = require('express').Router();
const { auth, db, FieldValue } = require('../firebase');
const { HttpError, asyncHandler, docAJson, texto } = require('../utils');

const ROLES = ['admin', 'vendedor'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Datos del usuario que inició sesión (el frontend lo usa para mostrar menús según el rol)
router.get('/yo', (req, res) => res.json(req.usuario));

// === Desde aquí, solo admin (se aplica en server.js para la ruta /api/usuarios) ===
const adminRouter = require('express').Router();

adminRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const snap = await db.collection('usuarios').get();
    res.json(snap.docs.map((d) => ({ uid: d.id, ...docAJson(d) })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
  })
);

adminRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const nombre = texto(req.body.nombre, { campo: 'nombre', requerido: true, max: 80 });
    const email = texto(req.body.email, { campo: 'correo', requerido: true, max: 120 }).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const rol = req.body.rol;

    if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Correo inválido');
    if (!ROLES.includes(rol)) throw new HttpError(400, 'Rol inválido');

    // Si la cuenta ya existe en Firebase Authentication, solo se vincula al sistema
    // (conserva su contraseña actual; no hace falta escribir una).
    let existente = null;
    try {
      existente = await auth.getUserByEmail(email);
    } catch (e) {
      if (e.code !== 'auth/user-not-found') throw e;
    }

    if (existente) {
      const ref = db.collection('usuarios').doc(existente.uid);
      if ((await ref.get()).exists) throw new HttpError(409, 'Ese correo ya está registrado en el sistema');
      if (existente.disabled) await auth.updateUser(existente.uid, { disabled: false });
      await ref.set({
        email,
        nombre,
        rol,
        activo: true,
        creadoEn: FieldValue.serverTimestamp(),
      });
      return res.status(201).json({ uid: existente.uid, email, nombre, rol, activo: true, vinculado: true });
    }

    if (password.length < 8) throw new HttpError(400, 'La contraseña debe tener al menos 8 caracteres');

    let nuevo;
    try {
      nuevo = await auth.createUser({ email, password, displayName: nombre });
    } catch (e) {
      if (e.code === 'auth/email-already-exists') throw new HttpError(409, 'Ese correo ya está registrado');
      throw new HttpError(400, 'No se pudo crear el usuario: ' + (e.message || 'error desconocido'));
    }

    try {
      await db.collection('usuarios').doc(nuevo.uid).set({
        email,
        nombre,
        rol,
        activo: true,
        creadoEn: FieldValue.serverTimestamp(),
      });
    } catch (e) {
      await auth.deleteUser(nuevo.uid).catch(() => {});
      throw e;
    }
    res.status(201).json({ uid: nuevo.uid, email, nombre, rol, activo: true });
  })
);

adminRouter.put(
  '/:uid',
  asyncHandler(async (req, res) => {
    const { uid } = req.params;
    const ref = db.collection('usuarios').doc(uid);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpError(404, 'Usuario no encontrado');

    const cambios = {};
    if (req.body.nombre !== undefined) {
      cambios.nombre = texto(req.body.nombre, { campo: 'nombre', requerido: true, max: 80 });
    }
    if (req.body.rol !== undefined) {
      if (!ROLES.includes(req.body.rol)) throw new HttpError(400, 'Rol inválido');
      cambios.rol = req.body.rol;
    }
    if (req.body.activo !== undefined) {
      cambios.activo = Boolean(req.body.activo);
      if (cambios.activo) cambios.pendiente = false; // aprobar una solicitud de cuenta
    }

    if (uid === req.usuario.uid && (cambios.activo === false || (cambios.rol && cambios.rol !== 'admin'))) {
      throw new HttpError(400, 'No puedes quitarte el acceso ni tu rol de administrador');
    }

    await ref.update({ ...cambios, actualizadoEn: FieldValue.serverTimestamp() });
    if (cambios.activo !== undefined) await auth.updateUser(uid, { disabled: !cambios.activo });
    if (cambios.nombre) await auth.updateUser(uid, { displayName: cambios.nombre });
    res.json({ uid, ...snap.data(), ...cambios, creadoEn: undefined, actualizadoEn: undefined });
  })
);

router.use('/', require('../middleware/auth').requerirRol('admin'), adminRouter);

module.exports = router;
