import { useEffect } from 'react';

export default function Modal({ titulo, onClose, children, ancho = 520 }) {
  useEffect(() => {
    const alTeclear = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onClose]);

  return (
    <div className="modal-fondo" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: ancho }} role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="modal-cabecera">
          <h2>{titulo}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="modal-cuerpo">{children}</div>
      </div>
    </div>
  );
}
