import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [avisos, setAvisos] = useState([]);

  // tipo: 'ok' | 'error' | 'warn'
  const avisar = useCallback((mensaje, tipo = 'ok') => {
    const id = Date.now() + Math.random();
    setAvisos((a) => [...a, { id, mensaje, tipo }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), tipo === 'ok' ? 3500 : 6000);
  }, []);

  return (
    <ToastContext.Provider value={avisar}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {avisos.map((a) => (
          <div key={a.id} className={`toast toast-${a.tipo}`}>
            {a.mensaje}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
