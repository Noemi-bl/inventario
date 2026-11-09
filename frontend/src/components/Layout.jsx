import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { api } from '../api';
import Icono from './Icono.jsx';

export default function Layout() {
  const { perfil, logout } = useAuth();
  const ubicacion = useLocation();
  const [alertas, setAlertas] = useState(0);
  const esAdmin = perfil.rol === 'admin';

  // El globo del menú se actualiza cada vez que cambias de pantalla
  useEffect(() => {
    let vivo = true;
    api
      .get('/productos/alertas')
      .then((a) => {
        if (!vivo) return;
        const ids = new Set([...a.agotados, ...a.bajoStock, ...a.vencidos, ...a.porVencer].map((p) => p.id));
        setAlertas(ids.size);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [ubicacion.pathname]);

  const enlaces = [
    { a: '/', texto: 'Inicio', icono: 'inicio', fin: true },
    { a: '/venta', texto: 'Nueva venta', icono: 'venta' },
    { a: '/ventas', texto: 'Ventas', icono: 'ventas' },
    { a: '/productos', texto: 'Inventario', icono: 'inventario', globo: alertas },
    { a: '/clientes', texto: 'Clientes', icono: 'clientes' },
    ...(esAdmin
      ? [
          { a: '/reportes', texto: 'Reportes', icono: 'reportes' },
          { a: '/usuarios', texto: 'Usuarios', icono: 'usuarios' },
        ]
      : []),
  ];

  return (
    <div className="app">
      <aside className="lateral">
        <div className="marca">
          <span className="marca-icono">✚</span>
          <div>
            <strong>Nova Salud</strong>
            <small>Inventario y ventas</small>
          </div>
        </div>

        <nav className="menu" aria-label="Principal">
          {enlaces.map((e) => (
            <NavLink key={e.a} to={e.a} end={e.fin} className={({ isActive }) => (isActive ? 'activo' : '')}>
              <Icono nombre={e.icono} />
              <span>{e.texto}</span>
              {e.globo > 0 && (
                <span className="globo" title={`${e.globo} productos con alerta`}>
                  {e.globo}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="usuario">
          <span className="avatar" aria-hidden="true">
            {perfil.nombre.trim().charAt(0).toUpperCase()}
          </span>
          <div className="usuario-datos">
            <strong>{perfil.nombre}</strong>
            <small>{esAdmin ? 'Administrador' : 'Vendedor'}</small>
          </div>
          <button className="btn-salir" onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión">
            <Icono nombre="salir" tam={18} />
          </button>
        </div>
      </aside>
      <main className="contenido">
        <Outlet />
      </main>
    </div>
  );
}
