import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from './firebaseConfig';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [perfil, setPerfil] = useState(null); // { uid, nombre, email, rol }
  const [cargando, setCargando] = useState(true);
  const [errorAcceso, setErrorAcceso] = useState('');

  useEffect(() => {
    const cancelar = onAuthStateChanged(auth, async (usuario) => {
      if (!usuario) {
        setPerfil(null);
        setCargando(false);
        return;
      }
      try {
        setPerfil(await api.get('/usuarios/yo'));
        setErrorAcceso('');
      } catch (e) {
        setErrorAcceso(e.message);
        setPerfil(null);
        await signOut(auth);
      } finally {
        setCargando(false);
      }
    });
    return cancelar;
  }, []);

  async function login(email, password) {
    setErrorAcceso('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      const credencialesMalas = ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'];
      if (credencialesMalas.includes(e.code)) throw new Error('Correo o contraseña incorrectos');
      if (e.code === 'auth/too-many-requests') throw new Error('Demasiados intentos. Espera unos minutos');
      if (e.code === 'auth/user-disabled') throw new Error('Tu cuenta está desactivada');
      throw new Error('No se pudo iniciar sesión');
    }
  }

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ perfil, cargando, errorAcceso, login, logout }}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
