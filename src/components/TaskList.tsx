import React from "react";
import { StyleSheet, Text, View, StyleProp, ViewStyle } from "react-native";
import { Colors } from "@/constants/colors";
import { Ionicons } from '@expo/vector-icons';

export interface Task {
  id: number;
  name: string;
  due_date: string;
  is_completed: boolean;
  format?: string;
}

// ダミーデータ（Propsが渡されなかった場合のデフォルト）
const DUMMY_TASKS: Task[] = [
  { id: 1, name: "情報倫理", due_date: "今日 23:59", is_completed: false },
  { id: 2, name: "コミュA 小テスト", due_date: "今日 23:59", is_completed: false },
  { id: 3, name: "データサイエンス基礎数理 課題", due_date: "昨日 23:59", is_completed: true },
  { id: 4, name: "コンピュータ概論 レポート", due_date: "昨日 23:59", is_completed: true },
];

interface TaskListProps {
  tasks?: Task[];
  title?: string; // 「今週の未完了課題」や「今月の未完了課題」などを外から渡せるように
  style?: StyleProp<ViewStyle>;
}

export default function TaskList({ tasks = DUMMY_TASKS, title = "今週の未完了課題", style }: TaskListProps) {
  // 未完了の課題数をカウント
  const uncompletedCount = tasks.filter((t) => !t.is_completed).length;

  return (
    <View style={[styles.container, style]}>
      {/* 未完了課題カウント（サマリーバナー） */}
      <View style={styles.summaryBanner}>
        <Text style={styles.summaryLabel}>{title}</Text>
        <View style={styles.summaryCount}>
          <Text style={styles.summaryPrefix}>残り</Text>
          <Text style={styles.summaryNumber}>{uncompletedCount}</Text>
          <Text style={styles.summarySuffix}>つ</Text>
        </View>
      </View>

      {/* タスクリスト */}
      {tasks.map((task) => (
        <View
          key={task.id}
          style={[
            styles.taskCard,
            task.is_completed && styles.taskCardCompleted,
          ]}
        >
          <Text
            style={[
              styles.taskTitle,
              task.is_completed && styles.taskTitleCompleted,
            ]}
          >
            {task.name}
          </Text>
          <View style={styles.taskDeadline}>
            <Ionicons name="time-outline" size={14} color={task.is_completed ? "#6c757d" : "#333"} style={{ marginRight: 4 }} />
            <Text style={[styles.deadlineText, task.is_completed && styles.taskTextCompleted]}>
              ~{task.due_date.replace('今日 ', '').replace('昨日 ', '')} {/* プレビュー用の簡易フォーマット */}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: Colors.background.white,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    padding: 16,
  },
  // --- 未完了課題バナー ---
  summaryBanner: {
    backgroundColor: Colors.purple.primary,
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
  taskCardCompleted: {
    opacity: 0.5,
    backgroundColor: "#F8F9FA",
    borderLeftColor: "#CED4DA",
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 4,
  },
  taskTitleCompleted: {
    color: "#6c757d",
    textDecorationLine: "line-through",
  },
  taskDeadline: {
    flexDirection: "row",
    alignItems: "center",
  },
  clockIcon: {
    fontSize: 14,
    marginRight: 4,
    color: "#333",
  },
  deadlineText: {
    fontSize: 14,
    color: "#333",
  },
  taskTextCompleted: {
    color: "#6c757d",
  },
});
