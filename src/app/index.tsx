import MonthCalendar from "@/components/MonthCalendar";
import TaskList from "@/components/TaskList";
import Timetable from "@/components/Timetable";
import WeekCalendar from "@/components/WeekCalendar";
import BottomNavBar from "@/components/BottomNavBar";
import { Colors } from "@/constants/colors";
import * as SQLite from "expo-sqlite";
import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

// ---------------------------------------------------------
// 【モックデータ】
// 後で差し替えポイント：
//   ここを DB や状態管理から取得した値に置き換えるだけでOK。
//   形式: { 日にち: タスク件数 } の Record<number, number>
// ---------------------------------------------------------
const MOCK_TASK_COUNTS: Record<number, number> = {
  1: 1,
  3: 1,
  10: 1,
  17: 1,
  19: 4, // 件数が多い → 濃いバッジ
  20: 1,
  24: 1,
  31: 1,
};

export default function Index() {
  const taskCounts = MOCK_TASK_COUNTS;
  const [isEditMode, setIsEditMode] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const insets = useSafeAreaInsets();

  // 開発用：テストデータ投入関数
  const handleSeedData = async () => {
    try {
      const db = await SQLite.openDatabaseAsync("app.db");
      
      // 現在の学期があるか確認、なければ作成
      let termId = 1;
      const currentTerm: any = await db.getFirstAsync("SELECT id FROM terms WHERE is_current = 1");
      if (currentTerm) {
        termId = currentTerm.id;
      } else {
        const result = await db.runAsync(
          "INSERT INTO terms (name, start_date, end_date, is_current) VALUES (?, ?, ?, ?)",
          "テスト学期", "2024-04-01", "2024-08-31", 1
        );
        termId = result.lastInsertRowId;
      }

      // 授業データ (0:月, 1:火, 2:水, 3:木, 4:金)
      const seedCourses = [
        { name: 'コンピュータリテラシ', day_of_week: 0, period: 1 },
        { name: 'キャリアデザイン', day_of_week: 0, period: 2 },
        { name: '情報社会及び情報倫理', day_of_week: 0, period: 3 },
        { name: 'CEC', day_of_week: 1, period: 2 },
        { name: '線形代数１', day_of_week: 1, period: 3 },
        { name: 'CEA', day_of_week: 1, period: 4 },
        { name: 'コンピュータ概論', day_of_week: 2, period: 1 },
        { name: '情報数学１', day_of_week: 2, period: 2 },
        { name: 'プログラミング及び演習１', day_of_week: 3, period: 1 },
        { name: 'データサイエンス基礎数理', day_of_week: 3, period: 3 },
        { name: '日本国憲法', day_of_week: 4, period: 1 },
        { name: '論理回路', day_of_week: 4, period: 2 },
        { name: '中国語A', day_of_week: 4, period: 3 },
        { name: '健康・スポーツ化学実習１', day_of_week: 4, period: 4 },
      ];

      for (const course of seedCourses) {
        const existing: any = await db.getFirstAsync(
          "SELECT id FROM classes WHERE term_id = ? AND day_of_week = ? AND period = ?",
          termId, course.day_of_week, course.period
        );

        if (!existing) {
          await db.runAsync(
            "INSERT INTO classes (term_id, name, day_of_week, period) VALUES (?, ?, ?, ?)",
            termId, course.name, course.day_of_week, course.period
          );
        } else {
          await db.runAsync(
            "UPDATE classes SET name = ? WHERE id = ?",
            course.name, existing.id
          );
        }
      }
      
      Alert.alert("完了", "テストデータを投入しました！");
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error(error);
      Alert.alert("エラー", "データの投入に失敗しました。");
    }
  };

  // 開発用：DB初期化（リセット）関数
  const handleResetDb = async () => {
    try {
      const db = await SQLite.openDatabaseAsync("app.db");
      // 各テーブルのデータを全削除（SQLiteの外部キー制約設定によっては、順番やCASCADEに注意）
      await db.execAsync(`
        DELETE FROM task_reminders;
        DELETE FROM tasks;
        DELETE FROM task_locations;
        DELETE FROM classes;
        DELETE FROM terms;
      `);
      Alert.alert("完了", "DBのデータを全て初期化しました！");
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error(error);
      Alert.alert("エラー", "DBの初期化に失敗しました。");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.frame}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.paddedSection}>
            {/* モード切り替えボタン（確認用） */}
            <View style={styles.headerControls}>
              <TouchableOpacity 
                style={[styles.toggleButton, { marginRight: 8, backgroundColor: Colors.yellow.superdark }]} 
                onPress={handleResetDb}
              >
                <Text style={[styles.toggleButtonText, { color: Colors.background.white }]}>
                  DBリセット
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.toggleButton, { marginRight: 8, backgroundColor: Colors.yellow.superdark }]} 
                onPress={handleSeedData}
              >
                <Text style={[styles.toggleButtonText, { color: Colors.background.white }]}>
                  DBにデータを投入
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.toggleButton} 
                onPress={() => setIsEditMode(!isEditMode)}>
                <Text style={styles.toggleButtonText}>
                  {isEditMode ? "時間割編集を終了" : "時間割を追加する"}
                </Text>
              </TouchableOpacity>
            </View>

            <MonthCalendar taskCounts={taskCounts} />
            <WeekCalendar taskCounts={taskCounts} />
            {/* 時間割（枠のみ） */}
            <Timetable isEditMode={isEditMode} refreshKey={refreshKey} />

            {/* 週表示カレンダー */}
            <WeekCalendar taskCounts={taskCounts} />

            {/* 月表示カレンダー */}
            <MonthCalendar taskCounts={taskCounts} />
          </View>

          <TaskList style={{ paddingBottom: 100 + insets.bottom }} />

        </ScrollView>
        <BottomNavBar />
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.purple.primary,
    paddingTop: 16, // 上の余白だけ残す
  },
  frame: {
    flex: 1,
    backgroundColor: "transparent", // 整列用の枠としてのみ使用するため透明に
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: 16, // コンポーネント同士の余白だけを残す
  },
  paddedSection: {
    paddingHorizontal: 16, // TaskList以外の横余白
    gap: 16, // 内部のコンポーネント同士の余白
  },
  headerControls: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  toggleButton: {
    backgroundColor: Colors.background.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  toggleButtonText: {
    color: Colors.purple.primary,
    fontWeight: "700",
    fontSize: 14,
  },
});