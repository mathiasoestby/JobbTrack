// Firebase-oppkobling: config-lagring, tilkobling til Auth/Firestore, og en enkel
// nøkkel/verdi-lagringsbro (`window.storage`) som resten av appen bruker.
import { STORAGE_KEY } from "./store.js";

const FIREBASE_SDK_VERSION = "10.12.2";
const CONFIG_STORAGE_KEY = "firebase-config";
const LEGACY_LOCAL_BACKUP_KEY = "timeliste-lokal";

// Sett et objekt her ({apiKey: "...", projectId: "...", ...}) for å hardkode
// firebaseConfig i kildekoden i stedet for å lime den inn i appen ved oppstart.
const INLINE_FIREBASE_CONFIG = null;

export function getStoredFirebaseConfig() {
  if (INLINE_FIREBASE_CONFIG) return INLINE_FIREBASE_CONFIG;
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveFirebaseConfig(config) {
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
}

// Godtar at brukeren limer inn rått JS-objekt-syntax (fra Firebase-konsollet),
// og normaliserer det til gyldig JSON: `const firebaseConfig = {apiKey: '...'}` -> `{"apiKey":"..."}`.
export function normalizeFirebaseConfigText(text) {
  return text
    .trim()
    .replace(/^const\s+firebaseConfig\s*=\s*/, "")
    .replace(/;$/, "")
    .replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":')
    .replace(/'/g, '"')
    .replace(/,(\s*[}\]])/g, "$1");
}

export async function connectFirebase(config) {
  const [appModule, authModule, firestoreModule] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-firestore.js`),
  ]);
  const app = appModule.initializeApp(config);
  const db = firestoreModule.initializeFirestore(app, {
    localCache: firestoreModule.persistentLocalCache({}),
  });
  return {
    app,
    db,
    authModule,
    firestoreModule,
    auth: authModule.getAuth(app),
  };
}

// Kobler `window.storage` til `users/{uid}/storage/{key}` i Firestore for innlogget bruker.
export function connectFirestoreStorage({ db, firestoreModule, uid }) {
  const docRef = (key) => firestoreModule.doc(db, "users", uid, "storage", key);
  window.storage = {
    async get(key) {
      const snap = await firestoreModule.getDoc(docRef(key));
      if (!snap.exists()) throw new Error("finnes ikke");
      return { key, value: snap.data().value, shared: false };
    },
    async set(key, value) {
      await firestoreModule.setDoc(docRef(key), { value, updated: Date.now() });
      return { key, value, shared: false };
    },
    async delete(key) {
      await firestoreModule.deleteDoc(docRef(key));
      return { key, deleted: true, shared: false };
    },
    async list() {
      const snap = await firestoreModule.getDocs(firestoreModule.collection(db, "users", uid, "storage"));
      return { keys: snap.docs.map((d) => d.id), shared: false };
    },
  };
}

// Engangsmigrering: flytt data fra den gamle rene lokale versjonen (før Firebase) opp til skyen,
// men bare hvis brukeren ikke allerede har noe der. Returnerer true hvis noe ble flyttet.
export async function migrateLocalBackup() {
  let localValue = null;
  try {
    localValue = JSON.parse(localStorage.getItem(LEGACY_LOCAL_BACKUP_KEY) || "{}")[STORAGE_KEY] || null;
  } catch {
    // ingen gyldig lokal sikkerhetskopi
  }
  if (!localValue) return false;

  try {
    await window.storage.get(STORAGE_KEY);
    return false; // finnes allerede i skyen
  } catch {
    // fantes ikke fra før — migrer
  }
  await window.storage.set(STORAGE_KEY, localValue);
  return true;
}
