import React, { useState, useMemo, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";

// 曜日ラベル（日曜始まり）
const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

/**
 * 指定した年月のカレンダーグリッドデータを生成する
 * 各週を1行として、7列の2次元配列を返す
 * 空のセルは null
 */
function generateCalendarGrid(year: number, month: number) {
  // month: 0-indexed (0=1月, 6=7月, ...)
  const firstDay = new Date(year, month, 1).getDay(); // 月初の曜日 (0=日, 6=土)
  const daysInMonth = new Date(year, month + 1, 0).getDate(); // その月の日数

  const grid: (number | null)[][] = [];
  let currentDay = 1;

  // 最大6週分ループ
  for (let week = 0; week < 6; week++) {
    const row: (number | null)[] = [];
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      if (week === 0 && dayOfWeek < firstDay) {
        row.push(null);
      } else if (currentDay > daysInMonth) {
        row.push(null);
      } else {
        row.push(currentDay);
        currentDay++;
      }
    }
    if (row.every((cell) => cell === null)) break;
    grid.push(row);
  }

  return grid;
}

/**
 * 件数に応じたバッジ背景色を返す
 * 後でより細かいロジック（締め切り近い等）に差し替え可能
 */
function getBadgeColor(count: number): string {
  if (count >= 4) return Colors.yellow.superdark; // 4件以上 → オレンジ系
  if (count >= 2) return Colors.yellow.dark;      // 2〜3件 → 濃い黄色
  return Colors.yellow.medium;                    // 1件     → 中間の黄色
}

/** 件数に応じたバッジテキスト色を返す */
function getBadgeTextColor(count: number): string {
  return count >= 4 ? Colors.text.white : Colors.text.primary; // 4件以上は白文字
}

// ---------------------------------------------------------
// Props 定義
// ---------------------------------------------------------
interface MonthCalendarProps {
  /**
   * 各日付の未完了タスク数マップ
   * key: 日にち (1〜31)、value: タスク件数
   *
   * 【後で差し替えポイント】
   * 現在は index.tsx からモックデータを渡している。
   * 実装時は DB や状態管理から取得した値をここに渡す。
   */
  taskCounts?: Record<number, number>;

  /**
   * 各日付の完了済みタスク数マップ
   */
  completedTaskCounts?: Record<number, number>;

  /**
   * 現在選択されている日付
   */
  selectedDate?: Date;

  /**
   * 表示月が変わったときのコールバック
   * 【後で差し替えポイント】
   * 親側でこの月に対応するタスクデータを取得して taskCounts を更新する際に使う
   */
  onMonthChange?: (year: number, month: number) => void;

  /**
   * 日付がタップされたときのコールバック
   */
  onDateSelect?: (date: Date) => void;
}

// ---------------------------------------------------------
// メインコンポーネント
// ---------------------------------------------------------
export default function MonthCalendar({
  taskCounts = {},
  completedTaskCounts = {},
  selectedDate,
  onMonthChange,
  onDateSelect,
}: MonthCalendarProps) {
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth(); // 0-indexed
  const todayDate = today.getDate();

  // 表示中の年月をstateで管理（初期値は今月）
  const [currentYear, setCurrentYear] = useState(todayYear);
  const [currentMonth, setCurrentMonth] = useState(todayMonth);

  // 前月へ
  const goToPrevMonth = useCallback(() => {
    let newYear = currentYear;
    let newMonth = currentMonth - 1;
    if (newMonth < 0) {
      newMonth = 11;
      newYear = currentYear - 1;
    }
    setCurrentYear(newYear);
    setCurrentMonth(newMonth);
    onMonthChange?.(newYear, newMonth);
  }, [currentYear, currentMonth, onMonthChange]);

  // 次月へ
  const goToNextMonth = useCallback(() => {
    let newYear = currentYear;
    let newMonth = currentMonth + 1;
    if (newMonth > 11) {
      newMonth = 0;
      newYear = currentYear + 1;
    }
    setCurrentYear(newYear);
    setCurrentMonth(newMonth);
    onMonthChange?.(newYear, newMonth);
  }, [currentYear, currentMonth, onMonthChange]);

  // カレンダーグリッドをメモ化
  const calendarGrid = useMemo(
    () => generateCalendarGrid(currentYear, currentMonth),
    [currentYear, currentMonth]
  );

  // ヘッダーの表示テキスト（今年以外は年も表示）
  const headerTitle =
    currentYear === todayYear
      ? `${currentMonth + 1}月`
      : `${currentYear}年${currentMonth + 1}月`;

  // 今月を表示中かどうか（今日のハイライト制御）
  const isCurrentMonth =
    currentYear === todayYear && currentMonth === todayMonth;

  return (
    <View style={styles.container}>
      {/* ヘッダー（矢印 + 月タイトル） */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.arrowButton}
          onPress={goToPrevMonth}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color={Colors.purple.primary}
          />
        </TouchableOpacity>

        <Text style={styles.monthTitle}>{headerTitle}</Text>

        <TouchableOpacity
          style={styles.arrowButton}
          onPress={goToNextMonth}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons
            name="chevron-forward"
            size={22}
            color={Colors.purple.primary}
          />
        </TouchableOpacity>
      </View>

      {/* 曜日ヘッダー */}
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, index) => (
          <View key={index} style={styles.weekdayCell}>
            <Text
              style={[
                styles.weekdayLabel,
                index === 0 && styles.sundayLabel,
                index === 6 && styles.saturdayLabel,
              ]}
            >
              {label}
            </Text>
          </View>
        ))}
      </View>

      {/* 日にちグリッド */}
      {calendarGrid.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.weekRow}>
          {week.map((day, dayIndex) => {
            const count = day !== null ? (taskCounts[day] ?? 0) : 0;
            const completedCount = day !== null ? (completedTaskCounts[day] ?? 0) : 0;
            // 今月表示中かつ今日の日付のみハイライト
            const isToday = isCurrentMonth && day === todayDate;
            const isSelected = selectedDate ? (
              currentYear === selectedDate.getFullYear() &&
              currentMonth === selectedDate.getMonth() &&
              day === selectedDate.getDate()
            ) : false;
            
            return (
              <View key={dayIndex} style={styles.dateCell}>
                {day !== null && (
                  <TouchableOpacity 
                    style={styles.dateCellInner}
                    activeOpacity={0.6}
                    onPress={() => {
                      onDateSelect?.(new Date(currentYear, currentMonth, day));
                    }}
                  >
                    {/* 日にち数字の背景用のコンテナ */}
                    <View style={[styles.dateNumberContainer, isSelected && styles.selectedCell]}>
                      <Text
                        style={[
                          styles.dateText,
                          isToday && !isSelected && styles.todayText,
                          isSelected && styles.selectedText
                        ]}
                      >
                        {day}
                      </Text>
                    </View>

                    {/* バッジ & 完了マークのコンテナ */}
                    <View style={styles.badgeContainer}>
                      {completedCount > 0 && (
                        <Ionicons name="checkmark-circle" size={14} color="#4CAF50" style={{ marginRight: count > 0 ? 2 : 0, marginTop: count > 0 ? 0 : 2 }} />
                      )}
                      {count > 0 ? (
                        <View
                          style={[
                            styles.badge,
                            { backgroundColor: getBadgeColor(count) },
                          ]}
                        >
                          <Text style={[styles.badgeText, { color: getBadgeTextColor(count) }]}>{count}</Text>
                        </View>
                      ) : (
                        completedCount === 0 && <View style={styles.badgePlaceholder} />
                      )}
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------
// スタイル
// ---------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background.white,
    borderRadius: 16,
    padding: 16,
  },
  // --- ヘッダー ---
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  arrowButton: {
    padding: 4,
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.text.primary,
    textAlign: "center",
    flex: 1,
  },
  // --- 曜日・日付グリッド ---
  weekdayRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  weekRow: {
    flexDirection: "row",
    marginVertical: 4,
  },
  weekdayCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 8,
  },
  dateCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    minHeight: 56, // 行の高さ確保
    paddingTop: 4,
  },
  dateCellInner: {
    alignItems: "center",
    justifyContent: "flex-start",
    width: "100%",
  },
  dateNumberContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: "hidden", // 追加: はみ出さないようにして確実に丸にする
  },
  selectedCell: {
    backgroundColor: Colors.purple.primary,
  },
  weekdayLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text.secondary,
  },
  sundayLabel: {
    color: Colors.calendar.sunday,
  },
  saturdayLabel: {
    color: Colors.calendar.saturday,
  },
  dateText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.text.primary,
  },
  todayText: {
    color: Colors.purple.primary,
    fontWeight: "700",
  },
  selectedText: {
    color: Colors.background.white,
    fontWeight: "700",
  },
  // --- タスク件数バッジ ---
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 18,
    marginTop: 2,
  },
  badge: {
    minWidth: 20,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  badgePlaceholder: {
    height: 16,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.text.primary,
  },
});
