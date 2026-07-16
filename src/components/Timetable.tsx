import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { useSQLiteContext } from "expo-sqlite";
import { useFocusEffect } from "expo-router";
import { getPeriodTimes, getSettings, getCurrentTerm, getClasses } from "../services/dbService";
import { auth } from "../config/firebase";

const ALL_WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];

interface TimetableProps {
  /**
   * 時間割を追加・編集するフェーズかどうか
   */
  isEditMode?: boolean;

  /**
   * 授業選択モードかどうか
   */
  isSelectMode?: boolean;

  /**
   * 追加ボタンが押されたときのコールバック
   * @param day 曜日（例："月"）
   * @param period 時限（例：1）
   * @param previousCourseName 直前の時限にある授業名（あれば）
   */
  onAddCourse?: (day: string, period: number, previousCourseName?: string) => void;
  
  /**
   * 授業が選択されたときのコールバック
   */
  onSelectClass?: (course: any) => void;
  
  refreshKey?: number;
}

export default function Timetable({ isEditMode = false, isSelectMode = false, refreshKey = 0, onAddCourse, onSelectClass }: TimetableProps) {
  const db = useSQLiteContext();
  const [courses, setCourses] = useState<any[]>([]);
  const [isHighlightCurrent, setIsHighlightCurrent] = useState(true);
  const [periodTimes, setPeriodTimes] = useState<any[]>([]);

  // 設定から取得した曜日・時限数
  const [displayDays, setDisplayDays] = useState(5);
  const [displayPeriods, setDisplayPeriods] = useState(5);

  const WEEKDAYS = ALL_WEEKDAYS.slice(0, displayDays);
  const PERIODS = Array.from({ length: displayPeriods }, (_, i) => i + 1);

  // 現在の時限を計算する関数（DBの設定値を参照）
  const getCurrentPeriod = () => {
    if (!periodTimes || periodTimes.length === 0) return -1;

    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const timeInMinutes = hours * 60 + minutes;

    for (const pt of periodTimes) {
      if (!pt.start_time || !pt.end_time) continue;

      const [startH, startM] = pt.start_time.split(':').map(Number);
      const [endH, endM] = pt.end_time.split(':').map(Number);
      const startInMinutes = startH * 60 + startM;
      const endInMinutes = endH * 60 + endM;

      if (timeInMinutes >= startInMinutes && timeInMinutes <= endInMinutes) {
        return pt.period;
      }
    }
    return -1;
  };

  const currentDay = new Date().getDay() - 1; // 0:月, 1:火, ... 4:金
  const currentPeriod = getCurrentPeriod();

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

    const fetchCourses = async () => {
      if (!auth.currentUser) return;
      try {
        // 授業時間の取得
        const times = await getPeriodTimes();
        if (isActive) {
          times.sort((a: any, b: any) => a.period - b.period);
          setPeriodTimes(times);
        }

        // 設定値の取得
        const settings = await getSettings();
        if (isActive) {
          if (settings['timetable_days']) setDisplayDays(Number(settings['timetable_days']));
          if (settings['timetable_periods']) setDisplayPeriods(Number(settings['timetable_periods']));
        }

        const currentTerm = await getCurrentTerm();
        if (!currentTerm || currentTerm.id === undefined) {
          if (isActive) setCourses([]);
          return;
        }

        // 現在の学期に紐づく授業のみ取得
        const classList = await getClasses(currentTerm.id);
        if (isActive) {
          setCourses(classList);
        }
      } catch (error) {
        console.error("Failed to fetch courses:", error);
      }
    };

    fetchCourses();

    return () => {
      isActive = false;
    };
  }, [refreshKey]));

  return (
    <View style={styles.container}>
      {/* ツールバー */}
      <View style={styles.toolbar}>
        <Text style={styles.toolbarTitle}>時間割</Text>
        <TouchableOpacity 
          style={[styles.toggleHighlightButton, isHighlightCurrent && styles.toggleHighlightButtonActive]}
          onPress={() => setIsHighlightCurrent(!isHighlightCurrent)}
        >
          <Ionicons 
            name={isHighlightCurrent ? "flash" : "flash-outline"} 
            size={16} 
            color={isHighlightCurrent ? Colors.background.white : Colors.text.secondary} 
          />
          <Text style={[styles.toggleHighlightText, isHighlightCurrent && styles.toggleHighlightTextActive]}>
            現在の授業を強調
          </Text>
        </TouchableOpacity>
      </View>

      {/* テーブルのヘッダー行（曜日） */}
      <View style={styles.headerRow}>
        {/* 左上の空白セル */}
        <View style={styles.cornerCell} />
        {WEEKDAYS.map((day, index) => (
          <View key={index} style={styles.headerCell}>
            <Text style={styles.headerText}>{day}</Text>
          </View>
        ))}
      </View>

      {/* テーブルのボディ（時限ごとの行） */}
      <ScrollView style={{ flex: 1 }} nestedScrollEnabled={true}>
        {PERIODS.map((period, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {/* 左側の時限セル */}
          <View style={styles.periodCell}>
            <Text style={styles.periodText}>{period}</Text>
          </View>
          {WEEKDAYS.map((day, colIndex) => {
            const course = courses.find((c) => c.day_of_week == colIndex && c.period == period);
            const hasCourse = !!course;
            const isCurrent = isHighlightCurrent && colIndex === currentDay && period === currentPeriod;

            // 前後の授業と同じかどうかの判定（名前で判定）
            let isContinuingFromPrev = false;
            let isContinuingToNext = false;
            if (hasCourse) {
              isContinuingFromPrev = !!courses.find((c) => c.day_of_week == colIndex && c.period == period - 1 && c.name === course.name);
              isContinuingToNext = !!courses.find((c) => c.day_of_week == colIndex && c.period == period + 1 && c.name === course.name);
            }

            return (
              <View key={colIndex} style={[styles.courseCell, isCurrent && styles.currentCourseCell]}>
                {hasCourse ? (
                  <TouchableOpacity 
                    style={[
                      styles.courseContent, 
                      isCurrent && styles.currentCourseContent,
                      isContinuingFromPrev && styles.courseContentContinued,
                      isContinuingToNext && styles.courseContentContinuing,
                    ]}
                    disabled={!(isSelectMode || isEditMode)}
                    onPress={() => {
                      if ((isSelectMode || isEditMode) && onSelectClass) {
                        onSelectClass(course);
                      }
                    }}
                  >
                    <Text style={styles.courseNameText} numberOfLines={isContinuingFromPrev ? 2 : 4}>
                      {!isContinuingFromPrev ? course.name : "〃"}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  // 授業が未登録 かつ 編集モードの場合のみ追加ボタンを表示
                  isEditMode && (
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={() => {
                        const prevCourse = courses.find((c) => c.day_of_week == colIndex && c.period == period - 1);
                        onAddCourse?.(day, period, prevCourse?.name);
                      }}
                    >
                      <Ionicons name="add" size={20} color={Colors.text.secondary} />
                    </TouchableOpacity>
                  )
                )}
              </View>
            );
          })}
        </View>
      ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background.white,
    borderRadius: 16,
    padding: 12,
    // 枠線を少し丸める場合は overflow hidden をつけると綺麗に収まります
    overflow: "hidden",
    flex: 1, // スクロール領域を確保するために追加
  },
  // --- 行のスタイル ---
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: Colors.background.light,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: Colors.background.light,
  },
  // --- セルのスタイル ---
  cornerCell: {
    width: 20, // 時限セルの幅に合わせる (30 -> 20)
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 4, // ヘッダーの高さを削減 (8 -> 4)
    borderRightWidth: 1,
    borderRightColor: Colors.background.light,
  },
  headerCell: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 4, // ヘッダーの高さを削減 (8 -> 4)
    borderRightWidth: 1,
    borderRightColor: Colors.background.light,
  },
  periodCell: {
    width: 20, // 固定幅 (30 -> 20)
    justifyContent: "center", // 中央揃え
    alignItems: "center",
    minHeight: 110, // 授業枠の高さをさらに拡大 (80 -> 110)
    paddingVertical: 8,
    borderRightWidth: 1,
    borderRightColor: Colors.background.light,
  },
  courseCell: {
    flex: 1,
    justifyContent: "center", // コンテンツを中央に
    alignItems: "center",
    minHeight: 110, // 授業枠の高さをさらに拡大 (80 -> 110)
    paddingVertical: 8,
    borderRightWidth: 1,
    borderRightColor: Colors.background.light,
  },
  // --- テキストのスタイル ---
  headerText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.text.secondary,
  },
  periodText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.text.secondary,
  },
  // --- 授業内容 ---
  courseContent: {
    flex: 1,
    width: "90%",
    marginVertical: 4,
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.purple.primary,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "transparent", // 通常時は透明な枠線にしてレイアウトのズレを防ぐ
  },
  currentCourseContent: {
    backgroundColor: Colors.purple.dark, // 強調時は一番濃い紫にする
    borderColor: Colors.yellow.dark, // 強調時は枠線の色も変える
  },
  // --- 連続する授業の見た目 ---
  courseContentContinuing: {
    marginBottom: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  courseContentContinued: {
    marginTop: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)', // 微かな区切り線
  },
  currentCourseCell: {
    backgroundColor: "rgba(76, 77, 220, 0.1)", // 現在の授業マスの背景を薄い紫色に
  },
  courseNameText: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: Colors.background.white,
    textAlign: "center",
  },
  // --- 追加ボタン ---
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.background.light,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  // --- ツールバー ---
  toolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  toolbarTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.text.primary,
  },
  toggleHighlightButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.background.light,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  toggleHighlightButtonActive: {
    backgroundColor: Colors.yellow.superdark,
  },
  toggleHighlightText: {
    fontSize: 12,
    fontWeight: "bold",
    color: Colors.text.secondary,
  },
  toggleHighlightTextActive: {
    color: Colors.background.white,
  },
});
