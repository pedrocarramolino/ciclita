/**
 * Conexión con Firebase (cuentas y base de datos en la nube).
 *
 * La configuración no es secreta: identifica el proyecto y va dentro de la app. Lo que
 * protege los datos son las reglas de Firestore (firestore.rules): cada cuenta solo
 * puede leer y escribir lo suyo.
 *
 * - Auth: correo y contraseña, con la sesión guardada en IndexedDB.
 * - Firestore "lite" (solo peticiones, sin caché ni conexión permanente): la app
 *   trabaja con su base de datos local y sincroniza por su cuenta (ver sync.ts).
 * - Sin Analytics: Ciclita no usa analítica ni rastreadores.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  browserLocalPersistence,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore/lite'
import { lang } from '../i18n'

const firebaseConfig = {
  apiKey: 'AIzaSyCCMoB5F2ODaR8dZrRBg-9_rZsuwBMKz-0',
  authDomain: 'ciclita.firebaseapp.com',
  projectId: 'ciclita',
  storageBucket: 'ciclita.firebasestorage.app',
  messagingSenderId: '619209940605',
  appId: '1:619209940605:web:270921625839130e7d5b14',
}

let app: FirebaseApp | null = null
let authInstance: Auth | null = null
let dbInstance: Firestore | null = null

function firebaseApp(): FirebaseApp {
  app ??= initializeApp(firebaseConfig)
  return app
}

export function auth(): Auth {
  if (!authInstance) {
    // initializeAuth sin "popupRedirectResolver": no carga el iframe de Google (no hace
    // falta para correo y contraseña, y la política de seguridad no lo permitiría).
    authInstance = initializeAuth(firebaseApp(), {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    })
    // Correos de confirmación y de cambio de contraseña en el idioma de la app.
    authInstance.languageCode = lang
  }
  return authInstance
}

export function firestore(): Firestore {
  dbInstance ??= getFirestore(firebaseApp())
  return dbInstance
}
