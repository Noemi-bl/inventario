import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { api } from '../api';

// Blíster decorativo: algunas pastillas ya "salieron"
const PASTILLAS = Array.from({ length: 18 }, (_, i) => i);
const VACIAS = new Set([2, 7, 8, 13, 16]);

export default function Login() {
  const { perfil, cargando, login, errorAcceso } = useAuth();
  const [modo, setModo] = useState('ingreso'); // 'ingreso' | 'registro'
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (!cargando && perfil) return <Navigate to="/" replace />;

  const esRegistro = modo === 'registro';

  function cambiarModo(nuevo) {
    setModo(nuevo);
    setError('');
    setPassword('');
    setConfirmar('');
  }

  async function enviar(e) {
    e.preventDefault();
    setError('');

    if (esRegistro && password !== confirmar) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setEnviando(true);
    try {
      if (esRegistro) {
        await api.post('/registro', { nombre: nombre.trim(), email: email.trim(), password });
        await login(email.trim(), password); // entra directamente con la cuenta recién creada
      } else {
        await login(email.trim(), password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login-fondo">
      <aside className="login-lado">
        <div className="login-lado-marca">
          <span className="marca-icono">✚</span>
          <strong>Nova Salud</strong>
        </div>

        <div className="login-lado-texto">
          <h2>Cada caja, contada.</h2>
          <p>Registra ventas en segundos y recibe aviso cuando algún producto se esté acabando.</p>
        </div>

        <div className="blister" aria-hidden="true">
          {PASTILLAS.map((i) => (
            <i key={i} className={VACIAS.has(i) ? 'vacia' : ''} style={{ '--i': i }} />
          ))}
        </div>
      </aside>

      <form className="login-tarjeta" onSubmit={enviar}>
        <div className="login-marca">
          <h1>{esRegistro ? 'Crea tu cuenta' : 'Bienvenida de nuevo'}</h1>
          <p>{esRegistro ? 'Entrarás como vendedor.' : 'Ingresa para continuar con tu turno.'}</p>
        </div>

        {esRegistro && (
          <label className="campo">
            <span>Nombre completo</span>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} required autoFocus />
          </label>
        )}

        <label className="campo">
          <span>Correo electrónico</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            autoFocus={!esRegistro}
          />
        </label>
        <label className="campo">
          <span>{esRegistro ? 'Contraseña (mínimo 8 caracteres)' : 'Contraseña'}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={esRegistro ? 'new-password' : 'current-password'}
            minLength={esRegistro ? 8 : undefined}
            required
          />
        </label>
        {esRegistro && (
          <label className="campo">
            <span>Repite la contraseña</span>
            <input
              type="password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
        )}

        {(error || (!esRegistro && errorAcceso)) && <div className="aviso aviso-error">{error || errorAcceso}</div>}

        <button className="btn btn-primario btn-grande" disabled={enviando}>
          {enviando ? 'Un momento…' : esRegistro ? 'Crear cuenta e ingresar' : 'Ingresar'}
        </button>

        <p className="login-nota">
          {esRegistro ? (
            <>
              ¿Ya tienes cuenta?{' '}
              <button type="button" className="enlace" onClick={() => cambiarModo('ingreso')}>
                Ingresar
              </button>
            </>
          ) : (
            <>
              ¿Eres nuevo?{' '}
              <button type="button" className="enlace" onClick={() => cambiarModo('registro')}>
                Crear cuenta
              </button>
            </>
          )}
        </p>
      </form>
    </div>
  );
}
