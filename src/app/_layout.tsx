import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { initDatabase } from "../database/init";

// 準備ができるまでスプラッシュ画面を隠さない
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function setupApp() {
      try {
        // アプリ起動時のデータベース初期化（テーブル作成等）
        await initDatabase();
      } catch (e) {
        console.error("データベースの初期化に失敗しました", e);
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

  return <Stack screenOptions={{ headerShown: false }} />;
}
