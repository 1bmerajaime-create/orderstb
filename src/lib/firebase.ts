import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, signOut, type Auth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as
    | string
    | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as
    | string
    | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const isCloudEnabled = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

function ensureApp(): FirebaseApp {
  if (!isCloudEnabled) {
    throw new Error('Firebase no está configurado');
  }
  if (!app) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });
    } catch {
      // Ya inicializado (HMR / multi-import): reutilizar instancia.
      db = getFirestore(app);
    }
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  ensureApp();
  return auth!;
}

export function getDb(): Firestore {
  ensureApp();
  return db!;
}

export async function cloudLogin(): Promise<void> {
  if (!isCloudEnabled) return;
  const firebaseAuth = getFirebaseAuth();
  if (firebaseAuth.currentUser) return;
  try {
    await signInAnonymously(firebaseAuth);
  } catch (error) {
    // Si Anonymous no está activado y las reglas están abiertas, Firestore sigue
    // funcionando. Con reglas auth-only el sync fallará con permission-denied.
    console.warn('Anonymous Auth no disponible:', error);
  }
}

export async function cloudLogout(): Promise<void> {
  if (!isCloudEnabled || !auth?.currentUser) return;
  try {
    await signOut(auth);
  } catch {
    // ignore
  }
}
