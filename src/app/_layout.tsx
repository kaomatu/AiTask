import "react-native-gesture-handler";
import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { AuthProvider, useAuth } from "../context/AuthContext";
import * as SplashScreen from "expo-splash-screen";
import { initDatabase } from "../database/init";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { SQLiteProvider } from "expo-sqlite";
import { Platform } from "react-native";

// Web用のChunkLoadError（新しいデプロイ時の古いキャッシュによる真っ白画面）対策
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const handleChunkError = (error: any) => {
    const message = error?.message || error || '';
    if (
      message.includes('Loading chunk') || 
      message.includes('CSS chunk') ||
      message.includes('Failed to fetch dynamically imported module') ||
      (error?.name === 'ChunkLoadError')
    ) {
      console.log('🔄 新しいバージョンがデプロイされたため、ページをリロードします。');
      window.location.reload();
    }
  };

  window.addEventListener('error', (event) => {
    handleChunkError(event.error || event.message);
  });

  window.addEventListener('unhandledrejection', (event) => {
    handleChunkError(event.reason);
  });
}

// 準備ができるまでスプラッシュ画面を隠さない
SplashScreen.preventAutoHideAsync();

import { Drawer } from 'expo-router/drawer';
import CustomDrawerContent from '../components/CustomDrawerContent';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

import { setupNotificationResponseListener, requestNotificationPermissions } from "../services/notificationService";
import { syncTaskReminders } from "../services/dbService";

function RootLayoutNav() {
  const { user, loading, onboardingCompleted } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // 通知レスポンスリスナー（通知タップ時に /calendar-week へナビゲート）
    const cleanupListener = setupNotificationResponseListener(router);
    return () => {
      cleanupListener();
    };
  }, [router]);

  useEffect(() => {
    if (loading) return;

    const inOnboarding = segments[0] === 'onboarding';
    console.log('🔄 _layout guard:', { user: !!user, onboardingCompleted, inOnboarding, segments: segments.join('/') });

    if (!user) {
      if (!inOnboarding) {
        console.log('🔄 → /onboarding へリダイレクト（未ログイン）');
        router.replace('/onboarding');
      }
    } else if (onboardingCompleted) {
      if (inOnboarding) {
        console.log('🔄 → / へリダイレクト（オンボーディング完了済み）');
        router.replace('/');
      }
      // アプリログイン時に通知パーミッション確認とタスク通知スケジュールの同期を行う
      requestNotificationPermissions().then(() => {
        syncTaskReminders();
      });
    }
  }, [user, loading, onboardingCompleted, segments]);

  if (loading) {
    return null;
  }

  return (
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={({ navigation }) => ({
        headerShown: true,
        headerTransparent: false,
        headerShadowVisible: false,
        headerTitle: '',
        headerStyle: { elevation: 0, shadowOpacity: 0, borderBottomWidth: 0 },
      })}
    >
      <Drawer.Screen 
        name="index" 
        options={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: Colors.purple.primary, elevation: 0, shadowOpacity: 0, borderBottomWidth: 0, shadowColor: 'transparent', borderBottomColor: 'transparent' },
          headerTintColor: '#FFF',
        }} 
      />
      <Drawer.Screen 
        name="settings" 
        options={{
          headerShown: false,
        }} 
      />
      <Drawer.Screen 
        name="timetable" 
        options={{
          headerShown: false,
        }} 
      />
      <Drawer.Screen name="timetable-edit" options={{ headerShown: false, swipeEnabled: false }} />
      <Drawer.Screen 
        name="tasks-overview" 
        options={{
          headerShown: false,
        }} 
      />
      <Drawer.Screen 
        name="calendar-week" 
        options={{
          headerShown: false,
        }} 
      />
      <Drawer.Screen 
        name="calendar-month" 
        options={{
          headerShown: false,
        }} 
      />
      <Drawer.Screen name="design-preview" options={{ headerShown: false, swipeEnabled: false }} />
      <Drawer.Screen
        name="onboarding"
        options={{
          headerShown: false,
          swipeEnabled: false,
        }}
      />
    </Drawer>
  );
}

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function setupApp() {
      try {
        // アプリ起動時の準備処理（SQLiteProviderが初期化を行うためDB処理は不要）
        // 念のため少しだけ遅延を入れてからスプラッシュを隠す
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (e) {
        console.error("アプリ起動準備中にエラーが発生しました", e);
      } finally {
        setIsReady(true);
        // 初期化が終わったらスプラッシュ画面を消す
        await SplashScreen.hideAsync();
      }
    }

    setupApp();
  }, []);

  if (!isReady) {
    // 準備中は何も表示しない（裏でスプラッシュ画面が表示され続ける）
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SQLiteProvider databaseName="app.db" onInit={initDatabase}>
        <BottomSheetModalProvider>
          <AuthProvider>
            <RootLayoutNav />
          </AuthProvider>
        </BottomSheetModalProvider>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}
