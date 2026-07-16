import "react-native-gesture-handler";
import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { AuthProvider, useAuth } from "../context/AuthContext";
import * as SplashScreen from "expo-splash-screen";
import { initDatabase } from "../database/init";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { SQLiteProvider } from "expo-sqlite";

// 準備ができるまでスプラッシュ画面を隠さない
SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { user, loading, onboardingCompleted } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inOnboarding = segments[0] === 'onboarding';
    console.log('🔄 _layout guard:', { user: !!user, onboardingCompleted, inOnboarding, segments: segments.join('/') });

    if (!user) {
      // 未ログイン：オンボーディング外にいる場合のみリダイレクト
      if (!inOnboarding) {
        console.log('🔄 → /onboarding へリダイレクト（未ログイン）');
        router.replace('/onboarding');
      }
    } else if (onboardingCompleted) {
      // ログイン済み＆オンボーディング完了済み：オンボーディング内にいる場合はダッシュボードへ
      if (inOnboarding) {
        console.log('🔄 → / へリダイレクト（オンボーディング完了済み）');
        router.replace('/');
      }
    }
    // ログイン済み＆オンボーディング未完了の場合：
    // オンボーディングフロー内の自由な遷移（step2, step3）を妨げない
  }, [user, loading, onboardingCompleted, segments]);

  if (loading) {
    return null;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
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
