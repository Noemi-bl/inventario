const router = require('express').Router();
const { db, Timestamp } = require('../firebase');
const { asyncHandler, docAJson, redondear, leerRango, hoyLocal } = require('../utils');

// Resumen de ventas de un rango de fechas (solo admin, se aplica en server.js)
router.get(
  '/resumen',
  asyncHandler(async (req, res) => {
    const { desde, hasta, ini, fin } = leerRango(req.query);

    const snap = await db
      .collection('ventas')
      .where('fecha', '>=', Timestamp.fromDate(ini))
      .where('fecha', '<=', Timestamp.fromDate(fin))
      .get();
    const todas = snap.docs.map(docAJson);
    const ventas = todas.filter((v) => v.estado === 'completada');
    const anuladas = todas.length - ventas.length;

    const porMetodo = {};
    const porDia = {};
    const porVendedor = {};
    const productos = {};
    let total = 0;

    for (const v of ventas) {
      total += v.total;
      porMetodo[v.metodoPago] = redondear((porMetodo[v.metodoPago] || 0) + v.total);

      const dia = new Date(v.fecha).toLocaleDateString('en-CA', {
        timeZone: process.env.ZONA_HORARIA || 'America/Lima',
      });
      porDia[dia] = redondear((porDia[dia] || 0) + v.total);

      const vend = (porVendedor[v.vendedorNombre] ||= { ventas: 0, total: 0 });
      vend.ventas += 1;
      vend.total = redondear(vend.total + v.total);

      for (const it of v.items) {
        const p = (productos[it.productoId] ||= { productoId: it.productoId, nombre: it.nombre, cantidad: 0, total: 0 });
        p.cantidad += it.cantidad;
        p.total = redondear(p.total + it.subtotal);
      }
    }

    const prods = await db.collection('productos').where('activo', '==', true).get();
    const lista = prods.docs.map(docAJson);
    const hoy = hoyLocal();

    res.json({
      desde,
      hasta,
      totalVentas: redondear(total),
      cantidadVentas: ventas.length,
      ticketPromedio: ventas.length ? redondear(total / ventas.length) : 0,
      anuladas,
      porMetodo,
      porDia: Object.entries(porDia)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([fecha, monto]) => ({ fecha, total: monto })),
      porVendedor: Object.entries(porVendedor).map(([nombre, d]) => ({ nombre, ...d })),
      topProductos: Object.values(productos)
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 10),
      inventario: {
        totalProductos: lista.length,
        agotados: lista.filter((p) => p.stock <= 0).length,
        bajoStock: lista.filter((p) => p.stock > 0 && p.stock <= p.stockMinimo).length,
        vencidos: lista.filter((p) => p.vencimiento && p.vencimiento < hoy).length,
        valorInventario: redondear(lista.reduce((s, p) => s + p.precio * p.stock, 0)),
      },
    });
  })
);

module.exports = router;
