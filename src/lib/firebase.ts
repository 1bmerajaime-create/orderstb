import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, signOut, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

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

export function getFirebaseAuth(): Auth {
  if (!isCloudEnabled) {
    throw new Error('Firebase no está configurado');
  }
  if (!app) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
  return auth!;
}

export function getDb(): Firestore {
  getFirebaseAuth();
  return db!;
}

export async function cloudLogin(): Promise<void> {
  if (!isCloudEnabled) return;
  try {
    const firebaseAuth = getFirebaseAuth();
    if (!firebaseAuth.currentUser) {
      await signInAnonymously(firebaseAuth);
    }
  } catch {
    // Auth aún no provisionado en el proyecto: Firestore puede usarse igual
    // si las reglas lo permiten. La UI sigue protegida por la contraseña de la app.
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
