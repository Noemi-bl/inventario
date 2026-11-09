const router = require('express').Router();
const { auth, db, FieldValue } = require('../firebase');
const { HttpError, asyncHandler, texto } = require('../utils');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Ruta PÚBLICA: una persona crea su cuenta y puede entrar de inmediato.
// Siempre se crea con rol "vendedor"; solo un administrador puede cambiar el rol después.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const nombre = texto(req.body.nombre, { campo: 'nombre', requerido: true, max: 80 });
    const email = texto(req.body.email, { campo: 'correo', requerido: true, max: 120 }).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Correo inválido');
    if (password.length < 8) throw new HttpError(400, 'La contraseña debe tener al menos 8 caracteres');

    let nuevo;
    try {
      nuevo = await auth.createUser({ email, password, displayName: nombre });
    } catch (e) {
      if (e.code === 'auth/email-already-exists') {
        throw new HttpError(409, 'Ese correo ya tiene una cuenta. Si no puedes entrar, pide acceso al administrador');
      }
      throw new HttpError(400, 'No se pudo crear la cuenta. Revisa los datos e inténtalo de nuevo');
    }

    try {
      await db.collection('usuarios').doc(nuevo.uid).set({
        email,
        nombre,
        rol: 'vendedor',
        activo: true,
        creadoEn: FieldValue.serverTimestamp(),
      });
    } catch (e) {
      await auth.deleteUser(nuevo.uid).catch(() => {});
      throw e;
    }

    res.status(201).json({ ok: true });
  })
);

module.exports = router;
