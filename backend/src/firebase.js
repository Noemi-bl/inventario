const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

function cargarCredenciales() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }
  const ruta = path.resolve(
    __dirname,
    '..',
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './serviceAccountKey.json'
  );
  if (!fs.existsSync(ruta)) {
    throw new Error(
      `No se encontró la clave de servicio de Firebase en: ${ruta}\n` +
        'Descárgala desde Firebase Console > Configuración del proyecto > Cuentas de servicio ' +
        'y guárdala como backend/serviceAccountKey.json (no la subas a GitHub).'
    );
  }
  return JSON.parse(fs.readFileSync(ruta, 'utf8'));
}

admin.initializeApp({ credential: admin.credential.cert(cargarCredenciales()) });

const db = admin.firestore();
const auth = admin.auth();
const { FieldValue, Timestamp } = admin.firestore;

module.exports = { admin, db, auth, FieldValue, Timestamp };
