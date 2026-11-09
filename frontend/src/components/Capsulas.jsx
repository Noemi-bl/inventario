// Medidor de stock en forma de cápsulas: 10 pastillas que se van vaciando.
// "Lleno" equivale al doble del stock mínimo.
export default function Capsulas({ stock, minimo }) {
  const base = minimo > 0 ? minimo * 2 : 10;
  let llenas = Math.round((Math.max(stock, 0) / base) * 10);
  if (stock > 0) llenas = Math.max(1, llenas);
  llenas = Math.min(10, llenas);

  const estado = stock <= 0 ? 'agotado' : stock <= minimo ? 'bajo' : 'ok';
  const texto = stock <= 0 ? 'Agotado' : stock <= minimo ? 'Stock bajo' : 'Stock suficiente';

  return (
    <span className={`capsulas ${estado}`} role="img" aria-label={`${texto}: ${stock} unidades`} title={`${texto}: ${stock}`}>
      {Array.from({ length: 10 }, (_, i) => (
        <i key={i} className={i < llenas ? 'on' : ''} />
      ))}
    </span>
  );
}
