import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAG6gdXA1tdmGTRcLU1Bq5CPV2GFY95osg",
  authDomain: "://firebaseapp.com",
  projectId: "inventario-33ea9",
  storageBucket: "inventario-33ea9.firebasestorage.app",
  messagingSenderId: "855920240410",
  appId: "1:855920240410:web:53009024b3a81187ee2ea3",
  measurementId: "G-0ZF6BK6XFS"
};

// Inicializar la aplicación y el módulo de autenticación
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

