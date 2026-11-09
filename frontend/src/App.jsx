import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Productos from './pages/Productos.jsx';
import Venta from './pages/Venta.jsx';
import Ventas from './pages/Ventas.jsx';
import Clientes from './pages/Clientes.jsx';
import Reportes from './pages/Reportes.jsx';
import Usuarios from './pages/Usuarios.jsx';

function Protegida({ children }) {
  const { perfil, cargando } = useAuth();
  if (cargando) return <div className="pantalla-carga">Cargando…</div>;
  if (!perfil) return <Navigate to="/login" replace />;
  return children;
}

function SoloAdmin({ children }) {
  const { perfil } = useAuth();
  return perfil.rol === 'admin' ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <Protegida>
            <Layout />
          </Protegida>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="venta" element={<Venta />} />
        <Route path="ventas" element={<Ventas />} />
        <Route path="productos" element={<Productos />} />
        <Route path="clientes" element={<Clientes />} />
        <Route
          path="reportes"
          element={
            <SoloAdmin>
              <Reportes />
            </SoloAdmin>
          }
        />
        <Route
          path="usuarios"
          element={
            <SoloAdmin>
              <Usuarios />
            </SoloAdmin>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
