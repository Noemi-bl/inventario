import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import Capsulas from '../components/Capsulas.jsx';
import Contador from '../components/Contador.jsx';
import Icono from '../components/Icono.jsx';
import { ZONA, dinero, fechaCorta, fechaISOHaceDias, hoyISO, textoVencimiento } from '../utils';

function saludo() {
  const h = Number(new Date().toLocaleString('en-US', { timeZone: ZONA, hour: 'numeric', hour12: false })) % 24;
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

const fechaLarga = () =>
  new Date().toLocaleDateString('es-PE', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long' });

const diaCorto = (f) => new Date(`${f}T12:00:00`).toLocaleDateString('es-PE', { weekday: 'short' }).replace('.', '');

function GrupoAlerta({ titulo, tono, lista, tipo }) {
  if (!lista.length) return null;
  return (
    <section className={`panel grupo grupo-${tono}`}>
      <header className="grupo-cab">
        <h3>{titulo}</h3>
        <span className={`insignia insignia-${tono}`}>{lista.length}</span>
      </header>
      <ul className="lista-alerta">
        {lista.slice(0, 8).map((p) => (
          <li key={p.id}>
            <div className="lista-nombre">
              <strong>{p.nombre}</strong>
              <small>{p.laboratorio || p.categoria || p.codigo}</small>
            </div>
            {tipo === 'stock' ? (
              <>
                <Capsulas stock={p.stock} minimo={p.stockMinimo} />
                <span className="lista-dato">
                  {p.stock} <small>/ mín. {p.stockMinimo}</small>
                </span>
              </>
            ) : (
              <span className="lista-dato">
                {fechaCorta(p.vencimiento)} <small>{textoVencimiento(p.vencimiento)}</small>
              </span>
            )}
          </li>
        ))}
      </ul>
      {lista.length > 8 && <p className="nota">y {lista.length - 8} más…</p>}
    </section>
  );
}

export default function Dashboard() {
  const { perfil } = useAuth();
  const avisar = useToast();
  const [alertas, setAlertas] = useState(null);
  const [hoy, setHoy] = useState(null);
  const [datosSemana, setDatosSemana] = useState(null);
  const esAdmin = perfil.rol === 'admin';

  useEffect(() => {
    api.get('/productos/alertas').then(setAlertas).catch((e) => avisar(e.message, 'error'));
    if (esAdmin) {
      api.get('/reportes/resumen').then(setHoy).catch((e) => avisar(e.message, 'error'));
      api
        .get(`/reportes/resumen?desde=${fechaISOHaceDias(6)}&hasta=${hoyISO()}`)
        .then(setDatosSemana)
        .catch((e) => avisar(e.message, 'error'));
    }
  }, [esAdmin, avisar]);

  const totalAlertas = useMemo(() => {
    if (!alertas) return 0;
    return new Set([...alertas.agotados, ...alertas.bajoStock, ...alertas.vencidos, ...alertas.porVencer].map((p) => p.id)).size;
  }, [alertas]);

  const semana = useMemo(() => {
    if (!datosSemana) return [];
    const mapa = Object.fromEntries(datosSemana.porDia.map((d) => [d.fecha, d.total]));
    return Array.from({ length: 7 }, (_, i) => {
      const fecha = fechaISOHaceDias(6 - i);
      return { fecha, total: mapa[fecha] || 0 };
    });
  }, [datosSemana]);
  const maxSemana = Math.max(1, ...semana.map((d) => d.total));

  let estado = 'Revisando el inventario…';
  if (alertas) {
    estado =
      totalAlertas === 0
        ? 'El inventario está al día: no hay nada por reponer.'
        : `${totalAlertas} ${totalAlertas === 1 ? 'producto necesita' : 'productos necesitan'} tu atención.`;
  }

  return (
    <div className="pagina">
      <section className="portada">
        <div className="portada-texto">
          <p className="portada-fecha">{fechaLarga()}</p>
          <h1>
            {saludo()}, {perfil.nombre.split(' ')[0]}
          </h1>
          <p className={`portada-estado ${alertas && totalAlertas > 0 ? 'con-alertas' : ''}`}>{estado}</p>
        </div>
        <div className="portada-acciones">
          <Link to="/venta" className="btn btn-claro btn-grande">
            <Icono nombre="mas" /> Nueva venta
          </Link>
          {esAdmin && totalAlertas > 0 && (
            <Link to="/productos" className="btn btn-contorno btn-grande">
              Reponer stock
            </Link>
          )}
        </div>
      </section>

      {esAdmin && hoy && (
        <div className="tarjetas">
          <div className="tarjeta tarjeta-hoy">
            <small>Vendido hoy</small>
            <strong>
              <Contador valor={hoy.totalVentas} decimales={2} prefijo="S/ " />
            </strong>
          </div>
          <div className="tarjeta">
            <small>Ventas de hoy</small>
            <strong>
              <Contador valor={hoy.cantidadVentas} />
            </strong>
          </div>
          <div className="tarjeta">
            <small>Ticket promedio</small>
            <strong>
              <Contador valor={hoy.ticketPromedio} decimales={2} prefijo="S/ " />
            </strong>
          </div>
          <div className="tarjeta">
            <small>Valor del inventario</small>
            <strong>
              <Contador valor={hoy.inventario.valorInventario} decimales={2} prefijo="S/ " />
            </strong>
          </div>
        </div>
      )}

      {esAdmin && datosSemana && (
        <section className="panel">
          <header className="grupo-cab">
            <h3>Ventas de los últimos 7 días</h3>
            <span className="nota">{dinero(datosSemana.totalVentas)} en total</span>
          </header>
          <div className="semana">
            {semana.map((d, i) => (
              <div className={`semana-col ${d.fecha === hoyISO() ? 'hoy' : ''}`} key={d.fecha}>
                <span className="semana-valor">{d.total ? `S/ ${Math.round(d.total)}` : '—'}</span>
                <div className="semana-pista">
                  <div
                    className="semana-barra"
                    style={{ height: `${Math.max(3, (d.total / maxSemana) * 100)}%`, '--i': i }}
                    title={`${fechaCorta(d.fecha)}: ${dinero(d.total)}`}
                  />
                </div>
                <span className="semana-dia">{diaCorto(d.fecha)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {alertas && totalAlertas === 0 && (
        <div className="aviso aviso-ok">Sin agotados, sin bajo stock y sin productos por vencer.</div>
      )}

      {alertas && totalAlertas > 0 && (
        <div className="dos-columnas">
          <GrupoAlerta titulo="Agotados" tono="peligro" lista={alertas.agotados} tipo="stock" />
          <GrupoAlerta titulo="Bajo stock" tono="aviso" lista={alertas.bajoStock} tipo="stock" />
          <GrupoAlerta titulo="Vencidos" tono="peligro" lista={alertas.vencidos} tipo="venc" />
          <GrupoAlerta
            titulo={`Vencen en los próximos ${alertas.diasAviso} días`}
            tono="aviso"
            lista={alertas.porVencer}
            tipo="venc"
          />
        </div>
      )}
    </div>
  );
}
