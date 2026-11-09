# Nova Salud · Gestión de inventario y ventas

Software web para la botica "Nova Salud": inventario centralizado con stock en tiempo real,
alertas de reposición, registro de ventas y atención rápida al cliente.

- **Frontend:** React + Vite (`/frontend`)
- **Backend:** Node.js + Express + Firebase Admin (`/backend`)
- **Base de datos y login:** Firebase (Firestore + Authentication)

## Cómo cumple el caso práctico

| Requisito | Dónde está |
|---|---|
| Acceso web y seguridad de datos | Login con Firebase Auth, token verificado en cada petición, roles admin/vendedor, `helmet`, CORS, límite de peticiones, Firestore bloqueado a acceso directo (`firestore.rules`) |
| Alertas de reposición con bajo stock | `GET /api/productos/alertas` + panel de Inicio (agotados, bajo stock, por vencer, vencidos) + aviso al vender |
| Interfaz intuitiva y rápida | Pantalla "Nueva venta": búsqueda instantánea, Enter / lector de código de barras agrega el producto, cobro en un clic, comprobante imprimible |
| Registro de ventas | Colección `ventas` con número correlativo, vendedor, cliente y método de pago; historial y anulación |
| Menos errores de inventario | La venta se guarda en **una transacción**: valida stock, descuenta y registra el movimiento (kardex) o no hace nada. El precio y el total los calcula el servidor |

## Puesta en marcha

### 1. Firebase (una sola vez)
1. En [Firebase Console](https://console.firebase.google.com) abre el proyecto `inventario-33ea9`.
2. **Build → Authentication → Sign-in method:** activa **Correo electrónico/contraseña**.
3. **Build → Firestore Database:** crea la base de datos (modo producción).
4. En la pestaña **Reglas** de Firestore pega el contenido de `firestore.rules` y publica.
5. **Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada.**
   Guarda el archivo como `backend/serviceAccountKey.json`. **No lo subas a GitHub** (ya está en `.gitignore`).
6. En **Authentication → Users → Add user** crea tu usuario (correo y contraseña).
   El primer usuario que inicie sesión queda como **administrador**.

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env      # en Windows: copy .env.example .env
npm run dev
```
Debe mostrar: `API de inventario escuchando en http://localhost:3000`.

### 3. Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```
Abre http://localhost:5173 e inicia sesión.

### Primeros pasos en el sistema
1. Entra con tu usuario (será administrador).
2. **Inventario → Nuevo producto:** registra tus productos con precio, stock y stock mínimo.
3. **Usuarios → Nuevo usuario:** crea las cuentas de los vendedores.
4. **Nueva venta:** prueba una venta y revisa cómo baja el stock y aparece la alerta.

## Roles

| Acción | Vendedor | Admin |
|---|:--:|:--:|
| Registrar ventas, ver sus ventas | ✅ | ✅ |
| Ver inventario y alertas | ✅ | ✅ |
| Crear/editar clientes | ✅ | ✅ |
| Crear/editar/eliminar productos, reponer stock | ❌ | ✅ |
| Anular ventas, ver todas las ventas | ❌ | ✅ |
| Reportes y usuarios | ❌ | ✅ |

## Estructura de datos (Firestore)

- `usuarios/{uid}`: nombre, email, rol, activo
- `productos/{id}`: codigo, nombre, categoria, laboratorio, precio, stock, stockMinimo, vencimiento, requiereReceta, activo
- `clientes/{id}`: nombre, dni, telefono
- `ventas/{id}`: numero, fecha, vendedor, cliente, items[], total, metodoPago, estado
- `movimientos/{id}`: kardex de cada cambio de stock (venta, reposición, ajuste, anulación)
- `contadores/ventas`: correlativo de ventas

## API (resumen)

Todas requieren `Authorization: Bearer <token de Firebase>`.

| Método | Ruta | Rol |
|---|---|---|
| GET | `/api/usuarios/yo` | todos |
| GET/POST/PUT | `/api/usuarios` | admin |
| GET | `/api/productos`, `/api/productos/alertas` | todos |
| POST/PUT/DELETE | `/api/productos`, `/api/productos/:id` | admin |
| POST | `/api/productos/:id/ajuste` | admin |
| GET/POST/PUT | `/api/clientes` | todos |
| POST | `/api/ventas` | todos |
| GET | `/api/ventas?desde=&hasta=` | todos (vendedor: solo las suyas) |
| POST | `/api/ventas/:id/anular` | admin |
| GET | `/api/reportes/resumen?desde=&hasta=` | admin |

## Seguridad y buenas prácticas

- Las claves (`serviceAccountKey.json`, `.env`) nunca se suben al repositorio.
- Las contraseñas las gestiona Firebase Authentication (no se guardan en la base).
- El servidor valida todos los datos y recalcula precios y totales.
- Para publicar: sube el backend a un hosting Node (Render, Railway, etc.) usando la variable
  `FIREBASE_SERVICE_ACCOUNT_JSON`, y el frontend con `npm run build` (carpeta `dist`) a Firebase Hosting,
  Netlify o Vercel. Ajusta `FRONTEND_URL` (backend) y `VITE_API_URL` (frontend).
