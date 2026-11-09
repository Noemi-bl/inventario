import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast.jsx';
import { dinero, fechaCorta, hoyISO, nombreMetodo } from '../utils';

function primerDiaDelMes() {
  return hoyISO().slice(0, 8) + '01';
}

export default function Reportes() {
  const avisar = useToast();
  const [desde, setDesde] = useState(primerDiaDelMes());
  const [hasta, setHasta] = useState(hoyISO());
  const [datos, setDatos] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setDatos(await api.get(`/reportes/resumen?desde=${desde}&hasta=${hasta}`));
    } catch (e) {
      avisar(e.message, 'error');
    }
  }, [desde, hasta, avisar]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const maxDia = datos ? Math.max(1, ...datos.porDia.map((d) => d.total)) : 1;

  return (
    <div className="pagina">
      <div className="pagina-cabecera">
        <div>
          <h1>Reportes</h1>
          <p className="sub">Ventas e inventario por período</p>
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
      </div>

      {!datos && <p className="nota">Cargando…</p>}

      {datos && (
        <>
          <div className="tarjetas">
            <div className="tarjeta">
              <small>Total vendido</small>
              <strong>{dinero(datos.totalVentas)}</strong>
            </div>
            <div className="tarjeta">
              <small>N.º de ventas</small>
              <strong>{datos.cantidadVentas}</strong>
            </div>
            <div className="tarjeta">
              <small>Ticket promedio</small>
              <strong>{dinero(datos.ticketPromedio)}</strong>
            </div>
            <div className="tarjeta">
              <small>Ventas anuladas</small>
              <strong>{datos.anuladas}</strong>
            </div>
          </div>

          <div className="panel">
            <h3>Ventas por día</h3>
            {datos.porDia.length ? (
              <div className="barras">
                {datos.porDia.map((d) => (
                  <div className="barra-fila" key={d.fecha}>
                    <span className="barra-etiqueta">{fechaCorta(d.fecha)}</span>
                    <div className="barra-pista">
                      <div className="barra-relleno" style={{ width: `${(d.total / maxDia) * 100}%` }} />
                    </div>
                    <span className="barra-valor">{dinero(d.total)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="vacio">Sin ventas en el período</p>
            )}
          </div>

          <div className="dos-columnas">
            <div className="panel">
              <h3>Productos más vendidos</h3>
              <div className="tabla-envoltura">
                <table>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th className="der">Unid.</th>
                      <th className="der">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.topProductos.map((p) => (
                      <tr key={p.productoId}>
                        <td>{p.nombre}</td>
                        <td className="der">{p.cantidad}</td>
                        <td className="der">{dinero(p.total)}</td>
                      </tr>
                    ))}
                    {!datos.topProductos.length && (
                      <tr>
                        <td colSpan="3" className="vacio">
                          Sin datos
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel">
              <h3>Por método de pago</h3>
              <div className="tabla-envoltura">
                <table>
                  <tbody>
                    {Object.entries(datos.porMetodo).map(([m, monto]) => (
                      <tr key={m}>
                        <td>{nombreMetodo(m)}</td>
                        <td className="der">{dinero(monto)}</td>
                      </tr>
                    ))}
                    {!Object.keys(datos.porMetodo).length && (
                      <tr>
                        <td className="vacio">Sin datos</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <h3 className="separado">Por vendedor</h3>
              <div className="tabla-envoltura">
                <table>
                  <thead>
                    <tr>
                      <th>Vendedor</th>
                      <th className="der">Ventas</th>
                      <th className="der">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.porVendedor.map((v) => (
                      <tr key={v.nombre}>
                        <td>{v.nombre}</td>
                        <td className="der">{v.ventas}</td>
                        <td className="der">{dinero(v.total)}</td>
                      </tr>
                    ))}
                    {!datos.porVendedor.length && (
                      <tr>
                        <td colSpan="3" className="vacio">
                          Sin datos
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="panel">
            <h3>Estado actual del inventario</h3>
            <div className="tarjetas">
              <div className="tarjeta">
                <small>Productos activos</small>
                <strong>{datos.inventario.totalProductos}</strong>
              </div>
              <div className="tarjeta">
                <small>Agotados</small>
                <strong className={datos.inventario.agotados ? 'texto-peligro' : ''}>{datos.inventario.agotados}</strong>
              </div>
              <div className="tarjeta">
                <small>Bajo stock</small>
                <strong>{datos.inventario.bajoStock}</strong>
              </div>
              <div className="tarjeta">
                <small>Vencidos</small>
                <strong className={datos.inventario.vencidos ? 'texto-peligro' : ''}>{datos.inventario.vencidos}</strong>
              </div>
              <div className="tarjeta">
                <small>Valor del inventario</small>
                <strong>{dinero(datos.inventario.valorInventario)}</strong>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
