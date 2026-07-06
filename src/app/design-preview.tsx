/**
 * ===================================
 * デザイン確認用の仮画面（後で削除してOK）
 * このファイルを消すだけでプレビューは消えます
 * ===================================
 */
import React, { useState } from "react";
import {
  Dimensions,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import TaskList from "@/components/TaskList";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// --- 週表示用データ ---
const WEEK_DAYS = ["日", "月", "火", "水", "木", "金", "土"];
const WEEK_DATES = [
  { day: 16, tasks: 3, isToday: false, hasDeadline: false },
  { day: 17, tasks: 0, isToday: false, hasDeadline: false },
  { day: 18, tasks: 1, isToday: true, hasDeadline: false },
  { day: 19, tasks: 0, isToday: false, hasDeadline: false },
  { day: 20, tasks: 4, isToday: false, hasDeadline: true },
  { day: 21, tasks: 2, isToday: false, hasDeadline: false },
  { day: 22, tasks: 1, isToday: false, hasDeadline: false },
];

// --- 月表示用データ ---
const MONTH_CALENDAR: ({ day: number; tasks: number; isToday?: boolean; hasDeadline?: boolean } | null)[][] = [
  [
    { day: 1, tasks: 1 },
    { day: 2, tasks: 0 },
    { day: 3, tasks: 1 },
    { day: 4, tasks: 0 },
    { day: 5, tasks: 0 },
    { day: 6, tasks: 0 },
    { day: 7, tasks: 0 },
  ],
  [
    { day: 8, tasks: 0 },
    { day: 9, tasks: 0 },
    { day: 10, tasks: 1 },
    { day: 11, tasks: 0 },
    { day: 12, tasks: 0 },
    { day: 13, tasks: 0 },
    { day: 14, tasks: 0 },
  ],
  [
    { day: 15, tasks: 0 },
    { day: 16, tasks: 0 },
    { day: 17, tasks: 1, isToday: true },
    { day: 18, tasks: 0 },
    { day: 19, tasks: 4, hasDeadline: true },
    { day: 20, tasks: 1, hasDeadline: true },
    { day: 21, tasks: 0 },
  ],
  [
    { day: 22, tasks: 0 },
    { day: 23, tasks: 0 },
    { day: 24, tasks: 1 },
    { day: 25, tasks: 0 },
    { day: 26, tasks: 0 },
    { day: 27, tasks: 0 },
    { day: 28, tasks: 0 },
  ],
  [
    { day: 29, tasks: 0 },
    { day: 30, tasks: 0 },
    { day: 31, tasks: 1 },
    null,
    null,
    null,
    null,
  ],
];

// ============================
// メインコンポーネント
// ============================
export default function DesignPreview() {
  const [viewMode, setViewMode] = useState<"week" | "month">("week");

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* ヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton}>
          <View style={styles.backCircle}>
            <Text style={styles.backArrow}>{"‹"}</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>5月</Text>
        {/* 表示切替ボタン（デザイン確認用） */}
        <TouchableOpacity
          style={styles.toggleButton}
          onPress={() => setViewMode(viewMode === "week" ? "month" : "week")}
        >
          <Text style={styles.toggleText}>
            {viewMode === "week" ? "月表示" : "週表示"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* カレンダーエリア */}
        <View style={styles.calendarCard}>
          {viewMode === "week" ? <WeekCalendar /> : <MonthCalendar />}
        </View>

        {/* タスクリスト表示 */}
        <TaskList title={viewMode === "week" ? "今週の未完了課題" : "今月の未完了課題"} />

        {/* 下部の余白（FABボタンに被らないように） */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB（＋ボタン） */}
      <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.fab}>
          <Text style={styles.fabText}>＋</Text>
        </TouchableOpacity>
      </View>

      {/* ボトムタブバー */}
      <View style={styles.bottomTab}>
        <TouchableOpacity style={styles.tabItem}>
          <Text style={styles.tabIcon}>📅</Text>
        </TouchableOpacity>
        <View style={styles.tabSpacer} />
        <TouchableOpacity style={styles.tabItem}>
          <Text style={styles.tabIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ============================
// 週カレンダー
// ============================
function WeekCalendar() {
  return (
    <View>
      {/* 曜日ヘッダー */}
      <View style={styles.weekRow}>
        {WEEK_DAYS.map((d, i) => (
          <View key={i} style={styles.weekDayCell}>
            <Text
              style={[
                styles.weekDayLabel,
                i === 0 && { color: "#E74C3C" },
                i === 6 && { color: "#3498DB" },
              ]}
            >
              {d}
            </Text>
          </View>
        ))}
      </View>

      {/* 日付行 */}
      <View style={styles.weekRow}>
        {WEEK_DATES.map((item, i) => (
          <View key={i} style={styles.weekDateCell}>
            <View
              style={[
                styles.dateCircle,
                item.isToday && styles.todayCircle,
                item.hasDeadline && styles.deadlineCircle,
              ]}
            >
              <Text
                style={[
                  styles.dateNumber,
                  item.isToday && styles.todayText,
                  item.hasDeadline && styles.deadlineText,
                ]}
              >
                {item.day}
              </Text>
            </View>
            {item.tasks > 0 && (
              <View
                style={[
                  styles.taskBadge,
                  item.hasDeadline && styles.deadlineBadge,
                ]}
              >
                <Text style={styles.taskBadgeText}>{item.tasks}</Text>
              </View>
            )}
            {item.isToday && <View style={styles.todayDot} />}
          </View>
        ))}
      </View>
    </View>
  );
}

// ============================
// 月カレンダー
// ============================
function MonthCalendar() {
  return (
    <View>
      {/* 曜日ヘッダー */}
      <View style={styles.weekRow}>
        {WEEK_DAYS.map((d, i) => (
          <View key={i} style={styles.weekDayCell}>
            <Text
              style={[
                styles.weekDayLabel,
                i === 0 && { color: "#E74C3C" },
                i === 6 && { color: "#3498DB" },
              ]}
            >
              {d}
            </Text>
          </View>
        ))}
      </View>

      {/* 月の日付グリッド */}
      {MONTH_CALENDAR.map((week, weekIdx) => (
        <View key={weekIdx} style={styles.monthRow}>
          {week.map((item, dayIdx) => (
            <View key={dayIdx} style={styles.monthDateCell}>
              {item ? (
                <>
                  <Text
                    style={[
                      styles.monthDateNumber,
                      item.isToday && styles.monthTodayText,
                    ]}
                  >
                    {item.day}
                  </Text>
                  {item.tasks > 0 && (
                    <View
                      style={[　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　
                        styles.taskBadge,
                        item.hasDeadline && styles.deadlineBadge,
                      ]}
                    >
                      <Text style={styles.taskBadgeText}>{item.tasks}</Text>
                    </View>
                  )}
                  {item.isToday && <View style={styles.todayDot} />}
                </>
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

// ============================
// スタイル
// ============================
const BLUE_PRIMARY = "#4A5BE8";
const BLUE_DARK = "#3A4BD6";
const BLUE_LIGHT = "#E8ECFF";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BLUE_PRIMARY,
  },

  // --- ヘッダー ---
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: {
    position: "absolute",
    left: 16,
  },
  backCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  backArrow: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "600",
    marginTop: -2,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  toggleButton: {
    position: "absolute",
    right: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  toggleText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },

  // --- スクロール ---
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },

  // --- カレンダーカード ---
  calendarCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },

  // --- 週カレンダー ---
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  weekDayCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
  },
  weekDayLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  weekDateCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  dateCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dateNumber: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  todayCircle: {
    backgroundColor: "#E74C3C",
  },
  todayText: {
    color: "#fff",
    fontWeight: "700",
  },
  deadlineCircle: {
    backgroundColor: "#F5A623",
  },
  deadlineText: {
    color: "#fff",
    fontWeight: "700",
  },

  // --- 月カレンダー ---
  monthRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginVertical: 6,
  },
  monthDateCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
    minHeight: 50,
  },
  monthDateNumber: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  monthTodayText: {
    color: "#E74C3C",
    fontWeight: "800",
  },

  // --- タスクバッジ ---
  taskBadge: {
    backgroundColor: "#F5E6A3",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
    minWidth: 24,
    alignItems: "center",
  },
  deadlineBadge: {
    backgroundColor: "#F5A623",
  },
  taskBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#333",
  },
  todayDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#E74C3C",
    marginTop: 3,
  },

  // --- 未完了課題バナー ---
  summaryBanner: {
    backgroundColor: BLUE_DARK,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  summaryLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  summaryCount: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  summaryPrefix: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
    marginRight: 4,
  },
  summaryNumber: {
    color: "#fff",
    fontSize: 40,
    fontWeight: "800",
  },
  summarySuffix: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 2,
  },

  // --- タスクカード ---
  taskCard: {
    backgroundColor: "#FFF9E6",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#F5D76E",
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 4,
  },
  taskDeadline: {
    flexDirection: "row",
    alignItems: "center",
  },
  clockIcon: {
    fontSize: 14,
    marginRight: 4,
  },


  // --- FABボタン ---
  fabContainer: {
    position: "absolute",
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: BLUE_PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 3,
    borderColor: "#fff",
  },
  fabText: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "300",
    marginTop: -1,
  },

  // --- ボトムタブ ---
  bottomTab: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingBottom: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  tabIcon: {
    fontSize: 26,
  },
  tabSpacer: {
    width: 60,
  },
});
