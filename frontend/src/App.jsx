import React, { useState, useEffect } from 'react';
import { auth } from './firebaseConfig';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import './App.css';

function App() {
  // Estados de Autenticación y Control de Pantalla
  const [usuario, setUsuario] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [esRegistro, setEsRegistro] = useState(false); // Alternar entre Login y Registro
  const [mensajeAuth, setMensajeAuth] = useState({ tipo: '', texto: '' });

  // Estados del Punto de Venta (POS)
  const [productos, setProductos] = useState([
    { id: 1, nombre: 'Paracetamol 500mg', principio: 'Paracetamol', precio: 0.50, stock: 15 },
    { id: 2, nombre: 'Amoxicilina 500mg', principio: 'Amoxicilina', precio: 1.20, stock: 3 },
    { id: 3, nombre: 'Ibuprofeno 400mg', principio: 'Ibuprofeno', precio: 0.80, stock: 50 }
  ]);
  const [busqueda, setBusqueda] = useState('');
  const [carrito, setCarrito] = useState([]);
  const [alertas, setAlertas] = useState([]);

  // Monitorear si el usuario está logueado o no
  useEffect(() => {
    const desuscribir = onAuthStateChanged(auth, (user) => {
      setUsuario(user);
    });
    return () => desuscribir();
  }, []);

  useEffect(() => {
    const productosEnRiesgo = productos.filter(p => p.stock <= 5);
    setAlertas(productosEnRiesgo);
  }, [productos]);

  // Función para procesar Login o Registro
  const manejarAuth = async (e) => {
    e.preventDefault();
    setMensajeAuth({ tipo: '', texto: '' });

    try {
      if (esRegistro) {
        // CREAR CUENTA NUEVA EN FIREBASE
        await createUserWithEmailAndPassword(auth, email, password);
        setMensajeAuth({ tipo: 'exito', texto: '¡Cuenta de empleado creada con éxito!' });
        setEsRegistro(false);
      } else {
        // INICIAR SESIÓN
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        setMensajeAuth({ tipo: 'error', texto: 'El correo electrónico ya está registrado.' });
      } else if (error.code === 'auth/weak-password') {
        setMensajeAuth({ tipo: 'error', texto: 'La contraseña debe tener mínimo 6 caracteres.' });
      } else {
        setMensajeAuth({ tipo: 'error', texto: 'Credenciales inválidas o error de conexión.' });
      }
    }
  };

  // Función para Cerrar Sesión
  const manejarLogout = () => {
    signOut(auth);
    setCarrito([]);
    setEmail('');
    setPassword('');
    setMensajeAuth({ tipo: '', texto: '' });
  };

  const productosFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.principio.toLowerCase().includes(busqueda.toLowerCase())
  );

  const agregarAlCarrito = (producto) => {
    if (producto.stock === 0) return alert("Producto sin stock disponible");
    setCarrito([...carrito, producto]);
  };

  const calcularTotal = () => carrito.reduce((sum, p) => sum + p.precio, 0).toFixed(2);

  // VISTA 1: FORMULARIO DINÁMICO DE ACCESO / REGISTRO
  if (!usuario) {
    return (
      <div className="login-container">
        <form onSubmit={manejarAuth} className="login-card">
          <h2>Botica Nova Salud</h2>
          <p>{esRegistro ? 'Registro de Nuevo Empleado' : 'Acceso Seguro al Sistema de Inventario'}</p>
          
          {mensajeAuth.texto && (
            <div className={`badge-auth ${mensajeAuth.tipo}`}>
              {mensajeAuth.texto}
            </div>
          )}
          
          <div className="form-group">
            <label>Correo Electrónico:</label>
            <input 
              type="email" 
              placeholder="nombre@novasalud.com" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
          </div>
          
          <div className="form-group">
            <label>Contraseña:</label>
            <input 
              type="password" 
              placeholder="Mínimo 6 caracteres" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>
          
          <button type="submit" className="btn-login">
            {esRegistro ? 'Registrar y Crear Cuenta' : 'Ingresar al Sistema'}
          </button>

          <p className="toggle-auth-text">
            {esRegistro ? '¿Ya tienes una cuenta?' : '¿Eres un empleado nuevo?'}
            <button 
              type="button" 
              className="btn-toggle-link"
              onClick={() => {
                setEsRegistro(!esRegistro);
                setMensajeAuth({ tipo: '', texto: '' });
              }}
            >
              {esRegistro ? 'Inicia Sesión aquí' : 'Regístrate aquí'}
            </button>
          </p>
        </form>
      </div>
    );
  }

  // VISTA 2: SISTEMA PRINCIPAL PUNTO DE VENTA (POS)
  return (
    <div className="botica-container">
      <header className="botica-header">
        <div className="header-top">
          <h1>Botica Nova Salud - Sistema de Gestión</h1>
          <button onClick={manejarLogout} className="btn-logout">Cerrar Sesión ({usuario.email})</button>
        </div>
        {alertas.length > 0 && (
          <div className="banner-alertas">
            ⚠️ <strong>Alerta de Reposición:</strong> {alertas.map(a => `${a.nombre} (${a.stock} und)`).join(', ')}
          </div>
        )}
      </header>

      <div className="botica-layout">
        <div className="panel-catalogo">
          <input
            type="text"
            placeholder="🔍 Buscar por medicamento o principio activo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="buscador-input"
            autoFocus
          />

          <table className="tabla-productos">
            <thead>
              <tr>
                <th>Medicamento</th>
                <th>Principio Activo</th>
                <th>Precio</th>
                <th>Stock</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {productosFiltrados.map(p => (
                <tr key={p.id} className={p.stock <= 5 ? 'fila-alerta' : ''}>
                  <td>{p.nombre}</td>
                  <td>{p.principio}</td>
                  <td>S/. {p.precio.toFixed(2)}</td>
                  <td>{p.stock} u.</td>
                  <td>
                    <button onClick={() => agregarAlCarrito(p)} className="btn-agregar">
                      + Añadir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel-carrito">
          <h2>🛒 Ticket de Venta</h2>
          <div className="items-carrito">
            {carrito.length === 0 ? (
              <p className="carrito-vacio">No hay productos seleccionados.</p>
            ) : (
              carrito.map((item, idx) => (
                <div key={idx} className="item-linea">
                  <span>{item.nombre}</span>
                  <strong>S/. {item.precio.toFixed(2)}</strong>
                </div>
              ))
            )}
          </div>
          <div className="total-seccion">
            <h3>Total a Pagar: S/. {calcularTotal()}</h3>
            <button onClick={() => { alert("Venta registrada con éxito"); setCarrito([]); }} className="btn-cobrar" disabled={carrito.length === 0}>
              Emitir Comprobante (F12)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
