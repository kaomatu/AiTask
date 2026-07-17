import React, { useState, useMemo, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";

// 曜日ラベル（日曜始まり）
const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

/**
 * 指定した日付を含む週の日曜日を返す
 */
function getSundayOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // 日曜に戻す
  return d;
}

/**
 * 指定した日曜日から始まる1週間の日付配列を生成する
 */
function generateWeekDates(sunday: Date): Date[] {
  const week: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    week.push(d);
  }
  return week;
}

/**
 * 件数に応じたバッジ背景色を返す
 */
function getBadgeColor(count: number): string {
  if (count >= 4) return Colors.yellow.superdark;
  if (count >= 2) return Colors.yellow.dark;
  return Colors.yellow.medium;
}

/** 件数に応じたバッジテキスト色を返す */
function getBadgeTextColor(count: number): string {
  return count >= 4 ? Colors.text.white : Colors.text.primary;
}

// ---------------------------------------------------------
// Props 定義
// ---------------------------------------------------------
interface WeekCalendarProps {
  /**
   * 各日付の未完了タスク数マップ
   * key: 日にち (1〜31)、value: タスク件数
   *
   * 【後で差し替えポイント】
   * MonthCalendar と同じ形式。
   * 週をまたいで別月の日にちが含まれる場合は、
   * 将来的に key を "YYYY-MM-DD" 等に変更するか、
   * 親側でマージして渡す。
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
   * 表示週が変わったときのコールバック
   * 【後で差し替えポイント】
   * 週の日曜日の Date を渡す
   */
  onWeekChange?: (sundayDate: Date) => void;

  /**
   * 日付がタップされたときのコールバック
   */
  onDateSelect?: (date: Date) => void;
}

// ---------------------------------------------------------
// メインコンポーネント
// ---------------------------------------------------------
export default function WeekCalendar({
  taskCounts = {},
  completedTaskCounts = {},
  selectedDate,
  onWeekChange,
  onDateSelect,
}: WeekCalendarProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 表示中の週の日曜日をstateで管理（初期値は今週の日曜日）
  const [currentSunday, setCurrentSunday] = useState(() =>
    getSundayOfWeek(today)
  );

  // 前週へ
  const goToPrevWeek = useCallback(() => {
    const prevSunday = new Date(currentSunday);
    prevSunday.setDate(prevSunday.getDate() - 7);
    setCurrentSunday(prevSunday);
    onWeekChange?.(prevSunday);
  }, [currentSunday, onWeekChange]);

  // 次週へ
  const goToNextWeek = useCallback(() => {
    const nextSunday = new Date(currentSunday);
    nextSunday.setDate(nextSunday.getDate() + 7);
    setCurrentSunday(nextSunday);
    onWeekChange?.(nextSunday);
  }, [currentSunday, onWeekChange]);

  // 1週間の日付配列をメモ化
  const weekDates = useMemo(
    () => generateWeekDates(currentSunday),
    [currentSunday]
  );

  // ヘッダーに表示する月名
  // 新しい月の方を優先させるため、週の最後の日付（土曜日）を基準にする
  // 今年以外は年も表示
  const headerTitle = useMemo(() => {
    const headerDate = weekDates[6]; // 土曜日を基準にする
    const month = headerDate.getMonth() + 1;
    const year = headerDate.getFullYear();
    return year === today.getFullYear()
      ? `${month}月`
      : `${year}年${month}月`;
  }, [weekDates, today]);

  return (
    <View style={styles.container}>
      {/* ヘッダー（矢印 + 月タイトル） */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.arrowButton}
          onPress={goToPrevWeek}
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
          onPress={goToNextWeek}
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

      {/* 日にち行 */}
      <View style={styles.dateRow}>
        {weekDates.map((date, index) => {
          const day = date.getDate();
          const count = taskCounts[day] ?? 0;
          const completedCount = completedTaskCounts[day] ?? 0;
          const isToday = date.getTime() === today.getTime();
          const isSelected = selectedDate ? (
            date.getFullYear() === selectedDate.getFullYear() &&
            date.getMonth() === selectedDate.getMonth() &&
            date.getDate() === selectedDate.getDate()
          ) : false;

          return (
            <View key={index} style={styles.dateCell}>
              <TouchableOpacity
                style={styles.dateCellInner}
                activeOpacity={0.6}
                onPress={() => onDateSelect?.(date)}
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
                      <Text
                        style={[
                          styles.badgeText,
                          { color: getBadgeTextColor(count) },
                        ]}
                      >
                        {count}
                      </Text>
                    </View>
                  ) : (
                    completedCount === 0 && <View style={styles.badgePlaceholder} />
                  )}
                </View>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------
// スタイル
// ---------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background.white,
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 12,
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
  // --- 曜日ヘッダー ---
  weekdayRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  // --- 日にち行 ---
  dateRow: {
    flexDirection: "row",
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
    paddingTop: 4,
    width: "100%",
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
    fontSize: 18,
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
