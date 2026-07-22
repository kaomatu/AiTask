import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
// @ts-ignore
import { getReactNativePersistence } from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  persistentSingleTabManager
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "PLACEHOLDER",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "PLACEHOLDER",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "PLACEHOLDER",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "PLACEHOLDER",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "PLACEHOLDER",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "PLACEHOLDER"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// プラットフォームごとに認証永続化の設定を分ける
const auth = Platform.OS === 'web'
  ? getAuth(app)
  : initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });

// Firestore の初期化（ローカルキャッシュ永続化を有効化）
let db: any;
try {
  if (Platform.OS === 'web') {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      experimentalForceLongPolling: true,
    });
  } else {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) }),
    });
  }
} catch (e) {
  // すでに初期化済みの場合は既存インスタンスを取得
  db = getFirestore(app);
}

// Storage の初期化
const storage = getStorage(app);

export { app, auth, db, storage };
