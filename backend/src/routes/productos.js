const router = require('express').Router();
const { db, FieldValue } = require('../firebase');
const { requerirRol } = require('../middleware/auth');
const { HttpError, asyncHandler, docAJson, texto, numero, hoyLocal, FECHA_RE } = require('../utils');

const col = db.collection('productos');
const DIAS_AVISO_VENCIMIENTO = 30;

function leerProducto(body) {
  const vencimiento = typeof body.vencimiento === 'string' ? body.vencimiento.trim() : '';
  if (vencimiento && !FECHA_RE.test(vencimiento)) {
    throw new HttpError(400, 'La fecha de vencimiento debe tener el formato AAAA-MM-DD');
  }
  return {
    codigo: texto(body.codigo, { campo: 'código', requerido: true, max: 40 }),
    nombre: texto(body.nombre, { campo: 'nombre', requerido: true, max: 120 }),
    categoria: texto(body.categoria, { campo: 'categoría', max: 60 }),
    laboratorio: texto(body.laboratorio, { campo: 'laboratorio', max: 80 }),
    precio: numero(body.precio, { campo: 'precio', min: 0, max: 100000 }),
    stockMinimo: numero(body.stockMinimo ?? 5, { campo: 'stock mínimo', min: 0, max: 100000, entero: true }),
    vencimiento,
    requiereReceta: Boolean(body.requiereReceta),
  };
}

async function codigoEnUso(codigo, ignorarId) {
  const snap = await col.where('codigo', '==', codigo).get();
  return snap.docs.some((d) => d.id !== ignorarId);
}

// Lista de productos activos
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const snap = await col.where('activo', '==', true).get();
    const lista = snap.docs.map(docAJson).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    res.json(lista);
  })
);

// Alertas: productos con stock bajo, agotados, por vencer o vencidos
router.get(
  '/alertas',
  asyncHandler(async (req, res) => {
    const snap = await col.where('activo', '==', true).get();
    const productos = snap.docs.map(docAJson);
    const hoy = hoyLocal();
    const limite = new Date(Date.now() + DIAS_AVISO_VENCIMIENTO * 86400000).toLocaleDateString('en-CA', {
      timeZone: process.env.ZONA_HORARIA || 'America/Lima',
    });

    const agotados = productos.filter((p) => p.stock <= 0);
    const bajoStock = productos.filter((p) => p.stock > 0 && p.stock <= p.stockMinimo);
    const vencidos = productos.filter((p) => p.vencimiento && p.vencimiento < hoy);
    const porVencer = productos.filter((p) => p.vencimiento && p.vencimiento >= hoy && p.vencimiento <= limite);

    const porStock = (a, b) => a.stock - b.stock;
    const porFecha = (a, b) => a.vencimiento.localeCompare(b.vencimiento);
    res.json({
      agotados: agotados.sort(porStock),
      bajoStock: bajoStock.sort(porStock),
      vencidos: vencidos.sort(porFecha),
      porVencer: porVencer.sort(porFecha),
      diasAviso: DIAS_AVISO_VENCIMIENTO,
    });
  })
);

// Crear producto (solo admin)
router.post(
  '/',
  requerirRol('admin'),
  asyncHandler(async (req, res) => {
    const datos = leerProducto(req.body);
    const stock = numero(req.body.stock ?? 0, { campo: 'stock inicial', min: 0, max: 1000000, entero: true });
    if (await codigoEnUso(datos.codigo)) throw new HttpError(409, 'Ya existe un producto con ese código');

    const ref = col.doc();
    const batch = db.batch();
    batch.set(ref, { ...datos, stock, activo: true, creadoEn: FieldValue.serverTimestamp() });
    if (stock > 0) {
      batch.set(db.collection('movimientos').doc(), {
        productoId: ref.id,
        productoNombre: datos.nombre,
        tipo: 'inicial',
        cantidad: stock,
        stockResultante: stock,
        motivo: 'Stock inicial',
        usuarioId: req.usuario.uid,
        usuarioNombre: req.usuario.nombre,
        fecha: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    res.status(201).json({ id: ref.id, ...datos, stock, activo: true });
  })
);

// Editar datos del producto (el stock se cambia solo con /ajuste o con ventas)
router.put(
  '/:id',
  requerirRol('admin'),
  asyncHandler(async (req, res) => {
    const ref = col.doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists || !snap.data().activo) throw new HttpError(404, 'Producto no encontrado');

    const datos = leerProducto(req.body);
    if (await codigoEnUso(datos.codigo, ref.id)) throw new HttpError(409, 'Ya existe un producto con ese código');

    await ref.update({ ...datos, actualizadoEn: FieldValue.serverTimestamp() });
    res.json({ id: ref.id, ...datos, stock: snap.data().stock });
  })
);

// Ajuste de stock: reposición (+) o corrección/merma (-). Solo admin
router.post(
  '/:id/ajuste',
  requerirRol('admin'),
  asyncHandler(async (req, res) => {
    const cantidad = numero(req.body.cantidad, { campo: 'cantidad', min: -1000000, max: 1000000, entero: true });
    if (cantidad === 0) throw new HttpError(400, 'La cantidad no puede ser 0');
    const motivo = texto(req.body.motivo, { campo: 'motivo', max: 200 }) || (cantidad > 0 ? 'Reposición' : 'Ajuste');

    const ref = col.doc(req.params.id);
    const nuevoStock = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists || !snap.data().activo) throw new HttpError(404, 'Producto no encontrado');
      const resultante = snap.data().stock + cantidad;
      if (resultante < 0) throw new HttpError(400, `El stock no puede quedar negativo (actual: ${snap.data().stock})`);

      tx.update(ref, { stock: resultante, actualizadoEn: FieldValue.serverTimestamp() });
      tx.set(db.collection('movimientos').doc(), {
        productoId: ref.id,
        productoNombre: snap.data().nombre,
        tipo: cantidad > 0 ? 'entrada' : 'ajuste',
        cantidad,
        stockResultante: resultante,
        motivo,
        usuarioId: req.usuario.uid,
        usuarioNombre: req.usuario.nombre,
        fecha: FieldValue.serverTimestamp(),
      });
      return resultante;
    });
    res.json({ id: ref.id, stock: nuevoStock });
  })
);

// Historial de movimientos de un producto
router.get(
  '/:id/movimientos',
  requerirRol('admin'),
  asyncHandler(async (req, res) => {
    const snap = await db.collection('movimientos').where('productoId', '==', req.params.id).get();
    const lista = snap.docs
      .map(docAJson)
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
      .slice(0, 100);
    res.json(lista);
  })
);

// Eliminar = desactivar (se conserva el historial de ventas)
router.delete(
  '/:id',
  requerirRol('admin'),
  asyncHandler(async (req, res) => {
    const ref = col.doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpError(404, 'Producto no encontrado');
    await ref.update({ activo: false, actualizadoEn: FieldValue.serverTimestamp() });
    res.json({ ok: true });
  })
);

module.exports = router;
