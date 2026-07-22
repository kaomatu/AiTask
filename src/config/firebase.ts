import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
// @ts-ignore
import { getReactNativePersistence } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// 注: 実際の値は環境変数 (.env.local など) から取得するか、
// 自身の Firebase プロジェクト設定の値に置き換えてください。
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

// Firestore の初期化
let db;
if (Platform.OS === 'web') {
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  });
} else {
  db = getFirestore(app);
}

// Storage の初期化
const storage = getStorage(app);

export { app, auth, db, storage };
