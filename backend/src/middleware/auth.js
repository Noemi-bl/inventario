const { auth, db, FieldValue } = require('../firebase');
const { HttpError, asyncHandler } = require('../utils');

// Verifica el token de Firebase y carga el rol del usuario desde Firestore.
const autenticar = asyncHandler(async (req, res, next) => {
  const cabecera = req.headers.authorization || '';
  const coincide = cabecera.match(/^Bearer (.+)$/);
  if (!coincide) throw new HttpError(401, 'Inicia sesión para continuar');

  let decodificado;
  try {
    decodificado = await auth.verifyIdToken(coincide[1]);
  } catch {
    throw new HttpError(401, 'Sesión inválida o vencida. Vuelve a iniciar sesión');
  }

  const ref = db.collection('usuarios').doc(decodificado.uid);
  let snap = await ref.get();

  if (!snap.exists) {
    // Si todavía no existe ningún administrador, el primero que ingresa lo será.
    const hayAdmin = !(await db.collection('usuarios').where('rol', '==', 'admin').limit(1).get()).empty;
    if (hayAdmin) {
      throw new HttpError(403, 'Tu cuenta no está registrada en el sistema. Pide acceso al administrador');
    }
    await ref.set({
      email: decodificado.email || '',
      nombre: decodificado.name || (decodificado.email || 'Administrador').split('@')[0],
      rol: 'admin',
      activo: true,
      creadoEn: FieldValue.serverTimestamp(),
    });
    snap = await ref.get();
  }

  const datos = snap.data();
  if (datos.pendiente) throw new HttpError(403, 'Tu cuenta está pendiente de aprobación del administrador');
  if (!datos.activo) throw new HttpError(403, 'Tu cuenta está desactivada');

  req.usuario = {
    uid: decodificado.uid,
    email: datos.email,
    nombre: datos.nombre,
    rol: datos.rol,
  };
  next();
});

// Restringe una ruta a ciertos roles: requerirRol('admin')
const requerirRol =
  (...roles) =>
  (req, res, next) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      return next(new HttpError(403, 'No tienes permiso para realizar esta acción'));
    }
    next();
  };

module.exports = { autenticar, requerirRol };
