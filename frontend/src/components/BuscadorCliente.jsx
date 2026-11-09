import { useMemo, useState } from 'react';
import { api } from '../api';
import { useToast } from './Toast.jsx';
import Modal from './Modal.jsx';

// Busca un cliente por DNI o nombre, y permite registrar uno nuevo sin salir de la venta.
export default function BuscadorCliente({ clientes, clienteId, onSeleccionar, onCreado }) {
  const avisar = useToast();
  const [q, setQ] = useState('');
  const [form, setForm] = useState(null); // null = modal cerrado
  const [guardando, setGuardando] = useState(false);

  const elegido = clientes.find((c) => c.id === clienteId);
  const texto = q.trim();

  const resultados = useMemo(() => {
    const t = texto.toLowerCase();
    if (!t) return [];
    return clientes.filter((c) => (c.nombre || '').toLowerCase().includes(t) || (c.dni || '').includes(t)).slice(0, 6);
  }, [clientes, texto]);

  function elegir(c) {
    onSeleccionar(c.id);
    setQ('');
  }

  function abrirNuevo() {
    const esDni = /^\d{1,8}$/.test(texto);
    setForm({ nombre: esDni ? '' : texto, dni: esDni ? texto : '', telefono: '' });
  }

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    try {
      const nuevo = await api.post('/clientes', form);
      onCreado(nuevo);
      avisar('Cliente registrado');
      setForm(null);
      setQ('');
    } catch (err) {
      avisar(err.message, 'error');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="campo cliente-buscador">
      <span>Cliente (opcional)</span>

      {elegido ? (
        <div className="cliente-elegido">
          <div>
            <strong>{elegido.nombre}</strong>
            <small>{elegido.dni ? `DNI ${elegido.dni}` : 'Sin DNI'}</small>
          </div>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => onSeleccionar('')}>
            Cambiar
          </button>
        </div>
      ) : (
        <>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por DNI o nombre…"
            autoComplete="off"
          />
          {texto ? (
            <ul className="cliente-lista">
              {resultados.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => elegir(c)}>
                    <strong>{c.nombre}</strong>
                    <small>{c.dni ? `DNI ${c.dni}` : 'Sin DNI'}</small>
                  </button>
                </li>
              ))}
              <li>
                <button type="button" className="cliente-nuevo" onClick={abrirNuevo}>
                  {resultados.length ? '+ Registrar cliente nuevo' : `No se encontró. Registrar “${texto}”`}
                </button>
              </li>
            </ul>
          ) : (
            <small>Sin cliente, la venta queda como “Cliente general”.</small>
          )}
        </>
      )}

      {form && (
        <Modal titulo="Nuevo cliente" onClose={() => setForm(null)} ancho={440}>
          <form onSubmit={guardar} className="formulario una-columna">
            <label className="campo">
              <span>Nombre completo *</span>
              <input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
                maxLength={120}
                autoFocus
              />
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
                {guardando ? 'Guardando…' : 'Guardar y usar'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
