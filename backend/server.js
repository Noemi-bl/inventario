const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Inicializar Firebase Admin SDK usando la ID de tu proyecto del .env
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID
    });
}

const db = admin.firestore();

// ENDPOINT: REGISTRAR PRODUCTO EN LA BOTICA
app.post('/api/productos', async (req, res) => {
    try {
        const { nombre, principioActivo, precio, stock, stockMinimo } = req.body;
        
        // Crea la colección 'productos' directamente en tu consola de Firebase
        const docRef = await db.collection('productos').add({
            nombre,
            principioActivo,
            precio: Number(precio),
            stock: Number(stock),
            stockMinimo: Number(stockMinimo),
            fechaRegistro: new Date().toISOString()
        });

        res.status(201).json({ status: "success", id: docRef.id, mensaje: "¡Producto guardado en Firestore con éxito!" });
    } catch (error) {
        res.status(500).json({ status: "error", detalle: error.message });
    }
});

// ENDPOINT: ALERTAS DE STOCK BAJO
app.get('/api/alertas', async (req, res) => {
    try {
        const snapshot = await db.collection('productos').get();
        const alertas = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.stock <= data.stockMinimo) {
                alertas.push({ id: doc.id, ...data });
            }
        });

        res.json({ status: "success", totalAlertas: alertas.length, productosEnRiesgo: alertas });
    } catch (error) {
        res.status(500).json({ status: "error", detalle: error.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Servidor API REST conectado con Firebase Admin en puerto ${PORT}`);
});
