import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteApp, getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const getDefaultFirebaseConfig = () => ({
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
});

export const isFirebaseConfigValid = (config) => Boolean(
  config?.apiKey &&
    config?.authDomain &&
    config?.projectId &&
    config?.appId
);

const configHasChanged = (current, next) => {
  if (!current || !next) return true;
  return (
    current.apiKey !== next.apiKey ||
    current.authDomain !== next.authDomain ||
    current.projectId !== next.projectId ||
    current.storageBucket !== next.storageBucket ||
    current.messagingSenderId !== next.messagingSenderId ||
    current.appId !== next.appId
  );
};

export const initializeFirebase = async (config) => {
  if (!isFirebaseConfigValid(config)) {
    return {
      app: null,
      auth: null,
      db: null,
      config,
      ready: false
    };
  }

  let app = null;
  if (getApps().length) {
    const current = getApp();
    if (configHasChanged(current.options, config)) {
      await deleteApp(current);
      app = initializeApp(config);
    } else {
      app = current;
    }
  } else {
    app = initializeApp(config);
  }

  let authInstance;
  try {
    authInstance = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
  } catch {
    authInstance = getAuth(app);
  }

  const db = getFirestore(app);

  return {
    app,
    auth: authInstance,
    db,
    config,
    ready: true
  };
};
