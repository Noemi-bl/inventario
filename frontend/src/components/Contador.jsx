import { useEffect, useRef, useState } from 'react';

// Número que sube desde el valor anterior hasta el nuevo. Respeta "reducir movimiento".
export default function Contador({ valor, decimales = 0, prefijo = '' }) {
  const [actual, setActual] = useState(0);
  const previo = useRef(0);

  useEffect(() => {
    const reducir = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducir) {
      setActual(valor);
      previo.current = valor;
      return undefined;
    }
    const desde = previo.current;
    const inicio = performance.now();
    const duracion = 900;
    let cuadro;
    const paso = (ahora) => {
      const p = Math.min(1, (ahora - inicio) / duracion);
      const suave = 1 - Math.pow(1 - p, 3);
      setActual(desde + (valor - desde) * suave);
      if (p < 1) cuadro = requestAnimationFrame(paso);
      else previo.current = valor;
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [valor]);

  return (
    <>
      {prefijo}
      {actual.toLocaleString('es-PE', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })}
    </>
  );
}
