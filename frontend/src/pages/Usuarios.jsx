import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';

const VACIO = { nombre: '', email: '', password: '', rol: 'vendedor' };

export default function Usuarios() {
  const { perfil } = useAuth();
  const avisar = useToast();
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(
    () => api.get('/usuarios').then(setUsuarios).catch((e) => avisar(e.message, 'error')),
    [avisar]
  );
  useEffect(() => {
    cargar();
  }, [cargar]);

  async function crear(e) {
    e.preventDefault();
    setGuardando(true);
    try {
      await api.post('/usuarios', form);
      avisar('Usuario creado');
      setForm(null);
      cargar();
    } catch (err) {
      avisar(err.message, 'error');
    } finally {
      setGuardando(false);
    }
  }

  async function actualizar(u, cambios) {
    try {
      await api.put(`/usuarios/${u.uid}`, cambios);
      avisar('Usuario actualizado');
      cargar();
    } catch (err) {
      avisar(err.message, 'error');
    }
  }

  return (
    <div className="pagina">
      <div className="pagina-cabecera">
        <div>
          <h1>Usuarios</h1>
          <p className="sub">Administra quién puede entrar al sistema</p>
        </div>
        <button className="btn btn-primario" onClick={() => setForm({ ...VACIO })}>
          + Nuevo usuario
        </button>
      </div>

      <div className="tabla-envoltura">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => {
              const soyYo = u.uid === perfil.uid;
              return (
                <tr key={u.uid}>
                  <td>
                    <strong>{u.nombre}</strong> {soyYo && <small>(tú)</small>}
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      value={u.rol}
                      disabled={soyYo}
                      onChange={(e) => actualizar(u, { rol: e.target.value })}
                      aria-label={`Rol de ${u.nombre}`}
                    >
                      <option value="admin">Administrador</option>
                      <option value="vendedor">Vendedor</option>
                    </select>
                  </td>
                  <td>
                    <span className={`insignia insignia-${u.pendiente ? 'aviso' : u.activo ? 'ok' : 'peligro'}`}>
                      {u.pendiente ? 'Pendiente' : u.activo ? 'Activo' : 'Desactivado'}
                    </span>
                  </td>
                  <td className="acciones">
                    {!soyYo && (
                      <button className="btn btn-sm" onClick={() => actualizar(u, { activo: !u.activo })}>
                        {u.pendiente ? 'Aprobar' : u.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal titulo="Nuevo usuario" onClose={() => setForm(null)}>
          <form onSubmit={crear} className="formulario una-columna">
            <label className="campo">
              <span>Nombre *</span>
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required maxLength={80} autoFocus />
            </label>
            <label className="campo">
              <span>Correo *</span>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </label>
            <label className="campo">
              <span>Contraseña inicial (mínimo 8 caracteres)</span>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                minLength={8}
                autoComplete="new-password"
                placeholder="Déjala vacía si la cuenta ya existe"
              />
              <small>
                Si el correo ya tiene cuenta en Firebase, se vincula con su contraseña actual. Solo escribe una contraseña
                para cuentas nuevas.
              </small>
            </label>
            <label className="campo">
              <span>Rol</span>
              <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
                <option value="vendedor">Vendedor (vende y consulta)</option>
                <option value="admin">Administrador (acceso total)</option>
              </select>
            </label>
            <div className="formulario-pie">
              <button type="button" className="btn" onClick={() => setForm(null)}>
                Cancelar
              </button>
              <button className="btn btn-primario" disabled={guardando}>
                {guardando ? 'Creando…' : 'Crear usuario'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
