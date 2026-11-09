import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import Capsulas from '../components/Capsulas.jsx';
import { dinero, fechaCorta, fechaHora, hoyISO } from '../utils';

const VACIO = {
  codigo: '',
  nombre: '',
  categoria: '',
  laboratorio: '',
  precio: '',
  stock: '',
  stockMinimo: 5,
  vencimiento: '',
  requiereReceta: false,
};

function estadoStock(p) {
  if (p.stock <= 0) return { texto: 'Agotado', clase: 'peligro' };
  if (p.stock <= p.stockMinimo) return { texto: 'Bajo', clase: 'aviso' };
  return { texto: 'OK', clase: 'ok' };
}

export default function Productos() {
  const { perfil } = useAuth();
  const esAdmin = perfil.rol === 'admin';
  const avisar = useToast();
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [form, setForm] = useState(null); // null = cerrado
  const [editandoId, setEditandoId] = useState(null);
  const [ajuste, setAjuste] = useState(null); // { producto, cantidad, motivo }
  const [historial, setHistorial] = useState(null); // { producto, lista }
  const [guardando, setGuardando] = useState(false);
  const hoy = hoyISO();

  const cargar = useCallback(
    () => api.get('/productos').then(setProductos).catch((e) => avisar(e.message, 'error')),
    [avisar]
  );
  useEffect(() => {
    cargar();
  }, [cargar]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productos.filter((p) => {
      if (filtro === 'bajo' && !(p.stock <= p.stockMinimo)) return false;
      if (filtro === 'vencer' && !(p.vencimiento && p.vencimiento <= hoy)) {
        // por vencer: dentro de 30 días
        const limite = new Date(Date.now() + 30 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
        if (!(p.vencimiento && p.vencimiento <= limite)) return false;
      }
      if (!q) return true;
      return [p.nombre, p.codigo, p.categoria, p.laboratorio].some((c) => (c || '').toLowerCase().includes(q));
    });
  }, [productos, busqueda, filtro, hoy]);

  const cambiar = (campo) => (e) =>
    setForm({ ...form, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  function nuevo() {
    setEditandoId(null);
    setForm({ ...VACIO });
  }

  function editar(p) {
    setEditandoId(p.id);
    setForm({ ...p });
  }

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    try {
      if (editandoId) await api.put(`/productos/${editandoId}`, form);
      else await api.post('/productos', form);
      avisar(editandoId ? 'Producto actualizado' : 'Producto creado');
      setForm(null);
      cargar();
    } catch (err) {
      avisar(err.message, 'error');
    } finally {
      setGuardando(false);
    }
  }

  async function guardarAjuste(e) {
    e.preventDefault();
    setGuardando(true);
    try {
      const r = await api.post(`/productos/${ajuste.producto.id}/ajuste`, {
        cantidad: ajuste.cantidad,
        motivo: ajuste.motivo,
      });
      avisar(`Stock actualizado: ${r.stock} unidades`);
      setAjuste(null);
      cargar();
    } catch (err) {
      avisar(err.message, 'error');
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(p) {
    if (!window.confirm(`¿Eliminar "${p.nombre}"? Se conservará el historial de ventas.`)) return;
    try {
      await api.del(`/productos/${p.id}`);
      avisar('Producto eliminado');
      cargar();
    } catch (err) {
      avisar(err.message, 'error');
    }
  }

  async function verHistorial(p) {
    try {
      setHistorial({ producto: p, lista: await api.get(`/productos/${p.id}/movimientos`) });
    } catch (err) {
      avisar(err.message, 'error');
    }
  }

  return (
    <div className="pagina">
      <div className="pagina-cabecera">
        <div>
          <h1>Inventario</h1>
          <p className="sub">{productos.length} productos registrados</p>
        </div>
        {esAdmin && (
          <button className="btn btn-primario" onClick={nuevo}>
            + Nuevo producto
          </button>
        )}
      </div>

      <div className="barra">
        <input
          className="entrada"
          placeholder="Buscar por nombre, código, categoría o laboratorio…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <select className="entrada corto" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="todos">Todos</option>
          <option value="bajo">Bajo stock / agotados</option>
          <option value="vencer">Por vencer / vencidos</option>
        </select>
      </div>

      <div className="tabla-envoltura">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Producto</th>
              <th>Categoría</th>
              <th className="der">Precio</th>
              <th className="der">Stock</th>
              <th>Estado</th>
              <th>Vence</th>
              {esAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {visibles.map((p) => {
              const est = estadoStock(p);
              const vencido = p.vencimiento && p.vencimiento < hoy;
              return (
                <tr key={p.id}>
                  <td className="mono">{p.codigo}</td>
                  <td>
                    <strong>{p.nombre}</strong>
                    {p.requiereReceta && <span className="insignia insignia-info"> Receta</span>}
                    <small className="bloque">{p.laboratorio}</small>
                  </td>
                  <td>{p.categoria || '—'}</td>
                  <td className="der">{dinero(p.precio)}</td>
                  <td className="der">
                    <span className="celda-stock">
                      <Capsulas stock={p.stock} minimo={p.stockMinimo} />
                      <span>
                        <strong>{p.stock}</strong> <small>/ mín. {p.stockMinimo}</small>
                      </span>
                    </span>
                  </td>
                  <td>
                    <span className={`insignia insignia-${est.clase}`}>{est.texto}</span>
                  </td>
                  <td className={vencido ? 'texto-peligro' : ''}>{fechaCorta(p.vencimiento)}</td>
                  {esAdmin && (
                    <td className="acciones">
                      <button className="btn btn-sm" onClick={() => setAjuste({ producto: p, cantidad: '', motivo: '' })}>
                        Reponer / ajustar
                      </button>
                      <button className="btn btn-sm" onClick={() => editar(p)}>
                        Editar
                      </button>
                      <button className="btn btn-sm btn-ghost" onClick={() => verHistorial(p)}>
                        Historial
                      </button>
                      <button className="btn btn-sm btn-peligro" onClick={() => eliminar(p)}>
                        Eliminar
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {!visibles.length && (
              <tr>
                <td colSpan={esAdmin ? 8 : 7} className="vacio">
                  No hay productos para mostrar
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal titulo={editandoId ? 'Editar producto' : 'Nuevo producto'} onClose={() => setForm(null)} ancho={640}>
          <form onSubmit={guardar} className="formulario">
            <label className="campo">
              <span>Código *</span>
              <input value={form.codigo} onChange={cambiar('codigo')} required maxLength={40} />
            </label>
            <label className="campo">
              <span>Nombre *</span>
              <input value={form.nombre} onChange={cambiar('nombre')} required maxLength={120} />
            </label>
            <label className="campo">
              <span>Categoría</span>
              <input value={form.categoria} onChange={cambiar('categoria')} maxLength={60} placeholder="Analgésicos, Vitaminas…" />
            </label>
            <label className="campo">
              <span>Laboratorio</span>
              <input value={form.laboratorio} onChange={cambiar('laboratorio')} maxLength={80} />
            </label>
            <label className="campo">
              <span>Precio de venta (S/) *</span>
              <input type="number" min="0" step="0.01" value={form.precio} onChange={cambiar('precio')} required />
            </label>
            {!editandoId && (
              <label className="campo">
                <span>Stock inicial</span>
                <input type="number" min="0" step="1" value={form.stock} onChange={cambiar('stock')} />
              </label>
            )}
            <label className="campo">
              <span>Stock mínimo (alerta)</span>
              <input type="number" min="0" step="1" value={form.stockMinimo} onChange={cambiar('stockMinimo')} required />
            </label>
            <label className="campo">
              <span>Fecha de vencimiento</span>
              <input type="date" value={form.vencimiento} onChange={cambiar('vencimiento')} />
            </label>
            <label className="campo check">
              <input type="checkbox" checked={form.requiereReceta} onChange={cambiar('requiereReceta')} />
              <span>Requiere receta médica</span>
            </label>
            <div className="formulario-pie">
              <button type="button" className="btn" onClick={() => setForm(null)}>
                Cancelar
              </button>
              <button className="btn btn-primario" disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {ajuste && (
        <Modal titulo={`Ajustar stock: ${ajuste.producto.nombre}`} onClose={() => setAjuste(null)}>
          <form onSubmit={guardarAjuste} className="formulario una-columna">
            <p className="nota">
              Stock actual: <strong>{ajuste.producto.stock}</strong>. Usa un número positivo para reponer (ej. 50) o negativo
              para descontar mermas o correcciones (ej. -3).
            </p>
            <label className="campo">
              <span>Cantidad *</span>
              <input
                type="number"
                step="1"
                value={ajuste.cantidad}
                onChange={(e) => setAjuste({ ...ajuste, cantidad: e.target.value })}
                required
                autoFocus
              />
            </label>
            <label className="campo">
              <span>Motivo</span>
              <input
                value={ajuste.motivo}
                onChange={(e) => setAjuste({ ...ajuste, motivo: e.target.value })}
                placeholder="Compra a proveedor, merma, conteo físico…"
                maxLength={200}
              />
            </label>
            <div className="formulario-pie">
              <button type="button" className="btn" onClick={() => setAjuste(null)}>
                Cancelar
              </button>
              <button className="btn btn-primario" disabled={guardando}>
                Guardar ajuste
              </button>
            </div>
          </form>
        </Modal>
      )}

      {historial && (
        <Modal titulo={`Historial: ${historial.producto.nombre}`} onClose={() => setHistorial(null)} ancho={720}>
          <div className="tabla-envoltura">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th className="der">Cantidad</th>
                  <th className="der">Stock</th>
                  <th>Motivo</th>
                  <th>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {historial.lista.map((m) => (
                  <tr key={m.id}>
                    <td>{fechaHora(m.fecha)}</td>
                    <td>{m.tipo}</td>
                    <td className="der">{m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}</td>
                    <td className="der">{m.stockResultante}</td>
                    <td>{m.motivo}</td>
                    <td>{m.usuarioNombre}</td>
                  </tr>
                ))}
                {!historial.lista.length && (
                  <tr>
                    <td colSpan="6" className="vacio">
                      Sin movimientos
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}
