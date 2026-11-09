import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import BuscadorCliente from '../components/BuscadorCliente.jsx';
import { METODOS, dinero, fechaHora, hoyISO, nombreMetodo } from '../utils';

export default function Venta() {
  const avisar = useToast();
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [carrito, setCarrito] = useState([]); // [{ producto, cantidad }]
  const [clienteId, setClienteId] = useState('');
  const [metodo, setMetodo] = useState('efectivo');
  const [enviando, setEnviando] = useState(false);
  const [comprobante, setComprobante] = useState(null);
  const buscadorRef = useRef(null);
  const hoy = hoyISO();

  const cargar = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([api.get('/productos'), api.get('/clientes')]);
      setProductos(p);
      setClientes(c);
    } catch (e) {
      avisar(e.message, 'error');
    }
  }, [avisar]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const vendible = (p) => p.stock > 0 && !(p.vencimiento && p.vencimiento < hoy);

  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const lista = q
      ? productos.filter((p) => [p.nombre, p.codigo, p.categoria, p.laboratorio].some((c) => (c || '').toLowerCase().includes(q)))
      : productos;
    return lista.slice(0, 40);
  }, [productos, busqueda]);

  const total = carrito.reduce((s, i) => s + i.producto.precio * i.cantidad, 0);
  const unidades = carrito.reduce((s, i) => s + i.cantidad, 0);

  function agregar(p) {
    if (!vendible(p)) {
      avisar(p.stock <= 0 ? `"${p.nombre}" está agotado` : `"${p.nombre}" está vencido`, 'error');
      return;
    }
    const existente = carrito.find((i) => i.producto.id === p.id);
    if (existente && existente.cantidad >= p.stock) {
      avisar(`Solo hay ${p.stock} unidades de "${p.nombre}"`, 'error');
      return;
    }
    setCarrito(
      existente
        ? carrito.map((i) => (i.producto.id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i))
        : [...carrito, { producto: p, cantidad: 1 }]
    );
  }

  function fijarCantidad(id, valor) {
    setCarrito(
      carrito.map((i) => {
        if (i.producto.id !== id) return i;
        let n = parseInt(valor, 10);
        if (Number.isNaN(n) || n < 1) n = 1;
        if (n > i.producto.stock) {
          avisar(`Solo hay ${i.producto.stock} unidades de "${i.producto.nombre}"`, 'error');
          n = i.producto.stock;
        }
        return { ...i, cantidad: n };
      })
    );
  }

  const quitar = (id) => setCarrito(carrito.filter((i) => i.producto.id !== id));

  // Enter en el buscador: agrega por código exacto (lector de código de barras) o si hay un único resultado
  function alPresionarEnter(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const q = busqueda.trim().toLowerCase();
    if (!q) return;
    const exacto = productos.find((p) => p.codigo.toLowerCase() === q);
    const elegido = exacto || (resultados.length === 1 ? resultados[0] : null);
    if (elegido) {
      agregar(elegido);
      setBusqueda('');
    } else if (!resultados.length) {
      avisar('No se encontró ningún producto', 'error');
    }
  }

  async function cobrar() {
    if (!carrito.length) return;
    setEnviando(true);
    try {
      const venta = await api.post('/ventas', {
        items: carrito.map((i) => ({ productoId: i.producto.id, cantidad: i.cantidad })),
        clienteId: clienteId || undefined,
        metodoPago: metodo,
      });
      setComprobante(venta);
      if (venta.bajoStock && venta.bajoStock.length) {
        avisar(
          `Reponer pronto: ${venta.bajoStock.map((p) => `${p.nombre} (${p.stock})`).join(', ')}`,
          'warn'
        );
      }
      setCarrito([]);
      setClienteId('');
      setMetodo('efectivo');
      cargar();
    } catch (e) {
      avisar(e.message, 'error');
      cargar(); // refresca el stock por si cambió
    } finally {
      setEnviando(false);
    }
  }

  function cerrarComprobante() {
    setComprobante(null);
    setBusqueda('');
    setTimeout(() => buscadorRef.current && buscadorRef.current.focus(), 50);
  }

  return (
    <div className="pagina">
      <div className="pagina-cabecera">
        <div>
          <h1>Nueva venta</h1>
          <p className="sub">Escribe o escanea el código y presiona Enter para agregar rápido</p>
        </div>
      </div>

      <div className="pos">
        <section className="pos-productos">
          <input
            ref={buscadorRef}
            className="entrada grande"
            placeholder="Buscar producto o escanear código…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={alPresionarEnter}
            autoFocus
          />
          <div className="rejilla">
            {resultados.map((p) => (
              <button
                key={p.id}
                className={`producto ${vendible(p) ? '' : 'deshabilitado'}`}
                onClick={() => agregar(p)}
                type="button"
              >
                <strong>{p.nombre}</strong>
                <small>{p.laboratorio || p.categoria || p.codigo}</small>
                <span className="producto-pie">
                  <b>{dinero(p.precio)}</b>
                  <span
                    className={`insignia insignia-${
                      p.stock <= 0 ? 'peligro' : p.stock <= p.stockMinimo ? 'aviso' : 'ok'
                    }`}
                  >
                    {p.stock <= 0 ? 'Agotado' : `Stock ${p.stock}`}
                  </span>
                </span>
                {p.requiereReceta && <span className="insignia insignia-info">Receta</span>}
              </button>
            ))}
            {!resultados.length && <p className="vacio">Sin resultados</p>}
          </div>
        </section>

        <aside className="carrito">
          <h2>
            Venta actual <small>({unidades} unid.)</small>
          </h2>

          <div className="carrito-lineas">
            {carrito.map((i) => (
              <div className="linea" key={i.producto.id}>
                <div className="linea-info">
                  <strong>{i.producto.nombre}</strong>
                  <small>{dinero(i.producto.precio)} c/u</small>
                </div>
                <div className="cantidad">
                  <button type="button" className="btn btn-sm" onClick={() => fijarCantidad(i.producto.id, i.cantidad - 1)}>
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={i.cantidad}
                    onChange={(e) => fijarCantidad(i.producto.id, e.target.value)}
                    aria-label={`Cantidad de ${i.producto.nombre}`}
                  />
                  <button type="button" className="btn btn-sm" onClick={() => fijarCantidad(i.producto.id, i.cantidad + 1)}>
                    +
                  </button>
                </div>
                <div className="linea-total">{dinero(i.producto.precio * i.cantidad)}</div>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => quitar(i.producto.id)} aria-label="Quitar">
                  ✕
                </button>
              </div>
            ))}
            {!carrito.length && <p className="vacio">Aún no agregas productos</p>}
          </div>

          <BuscadorCliente
            clientes={clientes}
            clienteId={clienteId}
            onSeleccionar={setClienteId}
            onCreado={(c) => {
              setClientes((lista) => [...lista, c]);
              setClienteId(c.id);
            }}
          />

          <div className="metodos">
            {METODOS.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`btn ${metodo === m.id ? 'btn-primario' : ''}`}
                onClick={() => setMetodo(m.id)}
              >
                {m.nombre}
              </button>
            ))}
          </div>

          <div className="total">
            <span>Total</span>
            <strong>{dinero(total)}</strong>
          </div>

          <button className="btn btn-primario btn-grande ancho" disabled={!carrito.length || enviando} onClick={cobrar}>
            {enviando ? 'Registrando…' : 'Cobrar'}
          </button>
          {carrito.length > 0 && (
            <button className="btn btn-ghost ancho" onClick={() => setCarrito([])} type="button">
              Vaciar venta
            </button>
          )}
        </aside>
      </div>

      {comprobante && (
        <Modal titulo="Venta registrada" onClose={cerrarComprobante} ancho={420}>
          <div className="comprobante area-impresion">
            <h3>Botica Nova Salud</h3>
            <p className="centro">
              <strong>{comprobante.numero}</strong>
              <br />
              {fechaHora(comprobante.fecha)}
            </p>
            <p>
              Cliente: {comprobante.clienteNombre || 'Cliente general'}
              {comprobante.clienteDni ? ` · DNI ${comprobante.clienteDni}` : ''}
              <br />
              Atendió: {comprobante.vendedorNombre}
              <br />
              Pago: {nombreMetodo(comprobante.metodoPago)}
            </p>
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="der">Cant.</th>
                  <th className="der">Importe</th>
                </tr>
              </thead>
              <tbody>
                {comprobante.items.map((i) => (
                  <tr key={i.productoId}>
                    <td>{i.nombre}</td>
                    <td className="der">{i.cantidad}</td>
                    <td className="der">{dinero(i.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="comprobante-total">
              TOTAL <strong>{dinero(comprobante.total)}</strong>
            </p>
            <p className="centro nota">Comprobante interno · ¡Gracias por su compra!</p>
          </div>
          <div className="formulario-pie">
            <button className="btn" onClick={() => window.print()}>
              Imprimir
            </button>
            <button className="btn btn-primario" onClick={cerrarComprobante}>
              Nueva venta
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
