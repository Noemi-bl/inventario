import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import { dinero, fechaHora, hoyISO, nombreMetodo } from '../utils';

export default function Ventas() {
  const { perfil } = useAuth();
  const esAdmin = perfil.rol === 'admin';
  const avisar = useToast();
  const [desde, setDesde] = useState(hoyISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [ventas, setVentas] = useState([]);
  const [detalle, setDetalle] = useState(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setVentas(await api.get(`/ventas?desde=${desde}&hasta=${hasta}`));
    } catch (e) {
      avisar(e.message, 'error');
    } finally {
      setCargando(false);
    }
  }, [desde, hasta, avisar]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function anular(v) {
    if (!window.confirm(`¿Anular la venta ${v.numero}? El stock volverá al inventario.`)) return;
    try {
      await api.post(`/ventas/${v.id}/anular`);
      avisar('Venta anulada y stock restituido');
      setDetalle(null);
      cargar();
    } catch (e) {
      avisar(e.message, 'error');
    }
  }

  const completadas = ventas.filter((v) => v.estado === 'completada');
  const total = completadas.reduce((s, v) => s + v.total, 0);

  return (
    <div className="pagina">
      <div className="pagina-cabecera">
        <div>
          <h1>Ventas</h1>
          <p className="sub">{esAdmin ? 'Todas las ventas del período' : 'Tus ventas del período'}</p>
        </div>
      </div>

      <div className="barra">
        <label className="campo en-linea">
          <span>Desde</span>
          <input type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label className="campo en-linea">
          <span>Hasta</span>
          <input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <div className="resumen-barra">
          {completadas.length} ventas · <strong>{dinero(total)}</strong>
        </div>
      </div>

      <div className="tabla-envoltura">
        <table>
          <thead>
            <tr>
              <th>N.º</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Vendedor</th>
              <th>Pago</th>
              <th className="der">Total</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {ventas.map((v) => (
              <tr key={v.id} className="clicable" onClick={() => setDetalle(v)}>
                <td className="mono">{v.numero}</td>
                <td>{fechaHora(v.fecha)}</td>
                <td>{v.clienteNombre || 'Cliente general'}</td>
                <td>{v.vendedorNombre}</td>
                <td>{nombreMetodo(v.metodoPago)}</td>
                <td className="der">{dinero(v.total)}</td>
                <td>
                  <span className={`insignia insignia-${v.estado === 'completada' ? 'ok' : 'peligro'}`}>
                    {v.estado === 'completada' ? 'Completada' : 'Anulada'}
                  </span>
                </td>
              </tr>
            ))}
            {!ventas.length && (
              <tr>
                <td colSpan="7" className="vacio">
                  {cargando ? 'Cargando…' : 'No hay ventas en este período'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {detalle && (
        <Modal titulo={`Venta ${detalle.numero}`} onClose={() => setDetalle(null)} ancho={560}>
          <p className="nota">
            {fechaHora(detalle.fecha)} · {detalle.vendedorNombre} · {nombreMetodo(detalle.metodoPago)}
            <br />
            Cliente: {detalle.clienteNombre || 'Cliente general'}
            {detalle.clienteDni ? ` · DNI ${detalle.clienteDni}` : ''}
          </p>
          <div className="tabla-envoltura">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="der">P. unit.</th>
                  <th className="der">Cant.</th>
                  <th className="der">Importe</th>
                </tr>
              </thead>
              <tbody>
                {detalle.items.map((i) => (
                  <tr key={i.productoId}>
                    <td>{i.nombre}</td>
                    <td className="der">{dinero(i.precioUnitario)}</td>
                    <td className="der">{i.cantidad}</td>
                    <td className="der">{dinero(i.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="comprobante-total">
            TOTAL <strong>{dinero(detalle.total)}</strong>
          </p>
          {detalle.estado === 'anulada' && (
            <div className="aviso aviso-error">Venta anulada por {detalle.anuladaPor}</div>
          )}
          {esAdmin && detalle.estado === 'completada' && (
            <div className="formulario-pie">
              <button className="btn btn-peligro" onClick={() => anular(detalle)}>
                Anular venta
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
