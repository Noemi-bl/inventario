const router = require('express').Router();
const { db, FieldValue, Timestamp } = require('../firebase');
const { requerirRol } = require('../middleware/auth');
const { HttpError, asyncHandler, docAJson, redondear, leerRango, hoyLocal } = require('../utils');

const METODOS_PAGO = ['efectivo', 'yape', 'plin', 'tarjeta'];
const MAX_ITEMS = 100;

// Registrar una venta. Todo ocurre en UNA transacción:
// valida stock, descuenta inventario, guarda la venta y los movimientos.
// Si algo falla, no se guarda nada (el inventario nunca queda inconsistente).
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { items, clienteId, metodoPago = 'efectivo' } = req.body;

    if (!METODOS_PAGO.includes(metodoPago)) throw new HttpError(400, 'Método de pago inválido');
    if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, 'Agrega al menos un producto');
    if (items.length > MAX_ITEMS) throw new HttpError(400, `Máximo ${MAX_ITEMS} productos por venta`);

    // Unir productos repetidos y validar cantidades
    const pedido = new Map();
    for (const it of items) {
      const cantidad = Number(it && it.cantidad);
      if (!it || typeof it.productoId !== 'string' || !it.productoId) throw new HttpError(400, 'Producto inválido');
      if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 9999) {
        throw new HttpError(400, 'Las cantidades deben ser enteros mayores a 0');
      }
      pedido.set(it.productoId, (pedido.get(it.productoId) || 0) + cantidad);
    }

    let cliente = null;
    if (clienteId) {
      const c = await db.collection('clientes').doc(String(clienteId)).get();
      if (!c.exists) throw new HttpError(400, 'El cliente seleccionado no existe');
      cliente = { id: c.id, nombre: c.data().nombre, dni: c.data().dni || null };
    }

    const ids = [...pedido.keys()];
    const contadorRef = db.collection('contadores').doc('ventas');
    const productoRefs = ids.map((id) => db.collection('productos').doc(id));
    const ventaRef = db.collection('ventas').doc();
    const hoy = hoyLocal();

    const resultado = await db.runTransaction(async (tx) => {
      // 1) Todas las lecturas primero
      const [contadorSnap, ...productoSnaps] = await tx.getAll(contadorRef, ...productoRefs);

      // 2) Validaciones y cálculo del total en el servidor (no se confía en precios del cliente)
      const lineas = [];
      const bajoStock = [];
      let total = 0;

      productoSnaps.forEach((snap, i) => {
        const id = ids[i];
        if (!snap.exists || !snap.data().activo) throw new HttpError(400, 'Un producto de la venta ya no existe');
        const p = snap.data();
        const cantidad = pedido.get(id);

        if (p.vencimiento && p.vencimiento < hoy) {
          throw new HttpError(400, `"${p.nombre}" está vencido y no puede venderse`);
        }
        if (p.stock < cantidad) {
          throw new HttpError(409, `Stock insuficiente de "${p.nombre}" (disponible: ${p.stock})`);
        }

        const subtotal = redondear(p.precio * cantidad);
        total += subtotal;
        const stockNuevo = p.stock - cantidad;
        lineas.push({
          productoId: id,
          codigo: p.codigo,
          nombre: p.nombre,
          precioUnitario: p.precio,
          cantidad,
          subtotal,
          stockNuevo,
        });
        if (stockNuevo <= p.stockMinimo) bajoStock.push({ nombre: p.nombre, stock: stockNuevo });
      });
      total = redondear(total);

      const numeroCorrelativo = (contadorSnap.exists ? contadorSnap.data().valor : 0) + 1;
      const numero = `V-${String(numeroCorrelativo).padStart(6, '0')}`;

      // 3) Escrituras
      tx.set(contadorRef, { valor: numeroCorrelativo });
      lineas.forEach((l) => {
        tx.update(db.collection('productos').doc(l.productoId), {
          stock: l.stockNuevo,
          actualizadoEn: FieldValue.serverTimestamp(),
        });
        tx.set(db.collection('movimientos').doc(), {
          productoId: l.productoId,
          productoNombre: l.nombre,
          tipo: 'venta',
          cantidad: -l.cantidad,
          stockResultante: l.stockNuevo,
          motivo: `Venta ${numero}`,
          ventaId: ventaRef.id,
          usuarioId: req.usuario.uid,
          usuarioNombre: req.usuario.nombre,
          fecha: FieldValue.serverTimestamp(),
        });
      });

      const itemsGuardados = lineas.map(({ stockNuevo, ...resto }) => resto);
      tx.set(ventaRef, {
        numero,
        fecha: FieldValue.serverTimestamp(),
        vendedorId: req.usuario.uid,
        vendedorNombre: req.usuario.nombre,
        clienteId: cliente ? cliente.id : null,
        clienteNombre: cliente ? cliente.nombre : null,
        clienteDni: cliente ? cliente.dni : null,
        items: itemsGuardados,
        total,
        metodoPago,
        estado: 'completada',
      });

      return { id: ventaRef.id, numero, total, items: itemsGuardados, bajoStock };
    });

    res.status(201).json({
      ...resultado,
      fecha: new Date().toISOString(),
      metodoPago,
      clienteNombre: cliente ? cliente.nombre : null,
      clienteDni: cliente ? cliente.dni : null,
      vendedorNombre: req.usuario.nombre,
    });
  })
);

// Historial de ventas. Admin: todas. Vendedor: solo las suyas.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { ini, fin } = leerRango(req.query);
    let ventas;

    if (req.usuario.rol === 'admin') {
      const snap = await db
        .collection('ventas')
        .where('fecha', '>=', Timestamp.fromDate(ini))
        .where('fecha', '<=', Timestamp.fromDate(fin))
        .orderBy('fecha', 'desc')
        .limit(500)
        .get();
      ventas = snap.docs.map(docAJson);
    } else {
      const snap = await db.collection('ventas').where('vendedorId', '==', req.usuario.uid).get();
      ventas = snap.docs
        .map(docAJson)
        .filter((v) => new Date(v.fecha) >= ini && new Date(v.fecha) <= fin)
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .slice(0, 500);
    }
    res.json(ventas);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const snap = await db.collection('ventas').doc(req.params.id).get();
    if (!snap.exists) throw new HttpError(404, 'Venta no encontrada');
    const venta = docAJson(snap);
    if (req.usuario.rol !== 'admin' && venta.vendedorId !== req.usuario.uid) {
      throw new HttpError(403, 'No tienes permiso para ver esta venta');
    }
    res.json(venta);
  })
);

// Anular una venta (solo admin): devuelve el stock al inventario
router.post(
  '/:id/anular',
  requerirRol('admin'),
  asyncHandler(async (req, res) => {
    const ventaRef = db.collection('ventas').doc(req.params.id);

    await db.runTransaction(async (tx) => {
      const ventaSnap = await tx.get(ventaRef);
      if (!ventaSnap.exists) throw new HttpError(404, 'Venta no encontrada');
      const venta = ventaSnap.data();
      if (venta.estado === 'anulada') throw new HttpError(409, 'La venta ya fue anulada');

      const refs = venta.items.map((i) => db.collection('productos').doc(i.productoId));
      const snaps = await tx.getAll(...refs);

      snaps.forEach((snap, i) => {
        const item = venta.items[i];
        if (!snap.exists) return; // producto eliminado de la base: no hay stock que restituir
        const nuevo = snap.data().stock + item.cantidad;
        tx.update(snap.ref, { stock: nuevo, actualizadoEn: FieldValue.serverTimestamp() });
        tx.set(db.collection('movimientos').doc(), {
          productoId: item.productoId,
          productoNombre: item.nombre,
          tipo: 'anulacion',
          cantidad: item.cantidad,
          stockResultante: nuevo,
          motivo: `Anulación de ${venta.numero}`,
          ventaId: ventaRef.id,
          usuarioId: req.usuario.uid,
          usuarioNombre: req.usuario.nombre,
          fecha: FieldValue.serverTimestamp(),
        });
      });

      tx.update(ventaRef, {
        estado: 'anulada',
        anuladaPor: req.usuario.nombre,
        anuladaEn: FieldValue.serverTimestamp(),
      });
    });

    res.json({ ok: true });
  })
);

module.exports = router;
