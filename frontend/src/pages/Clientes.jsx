import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';

const VACIO = { nombre: '', dni: '', telefono: '' };

export default function Clientes() {
  const { perfil } = useAuth();
  const esAdmin = perfil.rol === 'admin';
  const avisar = useToast();
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [form, setForm] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(
    () => api.get('/clientes').then(setClientes).catch((e) => avisar(e.message, 'error')),
    [avisar]
  );
  useEffect(() => {
    cargar();
  }, [cargar]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return q ? clientes.filter((c) => [c.nombre, c.dni, c.telefono].some((x) => (x || '').toLowerCase().includes(q))) : clientes;
  }, [clientes, busqueda]);

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    try {
      if (editandoId) await api.put(`/clientes/${editandoId}`, form);
      else await api.post('/clientes', form);
      avisar(editandoId ? 'Cliente actualizado' : 'Cliente registrado');
      setForm(null);
      cargar();
    } catch (err) {
      avisar(err.message, 'error');
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(c) {
    if (!window.confirm(`¿Eliminar a "${c.nombre}"?`)) return;
    try {
      await api.del(`/clientes/${c.id}`);
      avisar('Cliente eliminado');
      cargar();
    } catch (err) {
      avisar(err.message, 'error');
    }
  }

  return (
    <div className="pagina">
      <div className="pagina-cabecera">
        <div>
          <h1>Clientes</h1>
          <p className="sub">{clientes.length} clientes registrados</p>
        </div>
        <button
          className="btn btn-primario"
          onClick={() => {
            setEditandoId(null);
            setForm({ ...VACIO });
          }}
        >
          + Nuevo cliente
        </button>
      </div>

      <div className="barra">
        <input
          className="entrada"
          placeholder="Buscar por nombre, DNI o teléfono…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="tabla-envoltura">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>DNI</th>
              <th>Teléfono</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.nombre}</strong>
                </td>
                <td className="mono">{c.dni || '—'}</td>
                <td>{c.telefono || '—'}</td>
                <td className="acciones">
                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      setEditandoId(c.id);
                      setForm({ nombre: c.nombre, dni: c.dni || '', telefono: c.telefono || '' });
                    }}
                  >
                    Editar
                  </button>
                  {esAdmin && (
                    <button className="btn btn-sm btn-peligro" onClick={() => eliminar(c)}>
                      Eliminar
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!visibles.length && (
              <tr>
                <td colSpan="4" className="vacio">
                  No hay clientes para mostrar
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal titulo={editandoId ? 'Editar cliente' : 'Nuevo cliente'} onClose={() => setForm(null)}>
          <form onSubmit={guardar} className="formulario una-columna">
            <label className="campo">
              <span>Nombre completo *</span>
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required maxLength={120} autoFocus />
            </label>
            <label className="campo">
              <span>DNI</span>
              <input
                value={form.dni}
                onChange={(e) => setForm({ ...form, dni: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                inputMode="numeric"
                placeholder="8 dígitos"
              />
            </label>
            <label className="campo">
              <span>Teléfono</span>
              <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} maxLength={15} />
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
    </div>
  );
}
