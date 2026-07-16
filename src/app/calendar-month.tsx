import BottomNavBar from "@/components/BottomNavBar";
import TaskList from "@/components/TaskList";
import MonthCalendar from "@/components/MonthCalendar";
import { Colors } from "@/constants/colors";
import React, { useState, useRef, useCallback, useEffect } from "react";
import { StyleSheet, View, TouchableOpacity, Animated, Dimensions, Text, useWindowDimensions, ScrollView } from "react-native";
import { Alert } from '@/utils/alert';
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useSQLiteContext } from "expo-sqlite";
import { getTasksWithDetails, toggleTaskComplete, saveTask } from "../services/dbService";
import { auth } from "../config/firebase";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { generateGhostTasksForPeriod } from "@/utils/taskUtils";

export default function CalendarMonthScreen() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [taskCounts, setTaskCounts] = useState<Record<number, number>>({});
  const [completedTaskCounts, setCompletedTaskCounts] = useState<Record<number, number>>({});
  const [refreshKey, setRefreshKey] = useState(0);
  
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-indexed
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [calendarPointerEvents, setCalendarPointerEvents] = useState<'auto' | 'none'>('auto');
  const [calendarHeight, setCalendarHeight] = useState(300);

  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const router = useRouter();

  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const fetchTasks = async () => {
        if (!auth.currentUser) return;
        try {
          // 月の初日と末日
          const startOfMonth = new Date(currentYear, currentMonth, 1);
          startOfMonth.setHours(0, 0, 0, 0);
          
          const endOfMonth = new Date(currentYear, currentMonth + 1, 0); 
          endOfMonth.setHours(23, 59, 59, 999);

          // すべての未完了タスク（または未完了の繰り返しタスク）を取得
          // ※ここで期間を絞ってしまうと、過去から繰り返されているタスクのゴーストが生成できなくなる
          const rows = await getTasksWithDetails();
          if (!isActive) return;

          // ゴーストタスクの生成（表示している月のみにフィルタ）
          const tasksForMonth = generateGhostTasksForPeriod(rows, startOfMonth, endOfMonth);

          setTasks(tasksForMonth);

          // カレンダー用に日にちごとの件数を計算
          const counts: Record<number, number> = {};
          const completedCounts: Record<number, number> = {};
          for (const task of tasksForMonth) {
            const date = new Date(task.due_date);
            const day = date.getDate();
            if (task.is_completed === 0) {
              counts[day] = (counts[day] || 0) + 1;
            } else {
              completedCounts[day] = (completedCounts[day] || 0) + 1;
            }
          }
          setTaskCounts(counts);
          setCompletedTaskCounts(completedCounts);
        } catch (err) {
          console.error("Failed to fetch tasks for month:", err);
        }
      };
      fetchTasks();
      return () => { isActive = false; };
    }, [currentYear, currentMonth, refreshKey])
  );

  // タスクの完了切り替えとクローン生成ロジック
  const handleToggleComplete = async (taskId: number, currentCompletedState: number) => {
    try {
      const newCompletedState = currentCompletedState === 1 ? 0 : 1;
      const nowStr = new Date().toISOString();
      
      // 1. Firestoreで更新
      await toggleTaskComplete(taskId, newCompletedState, nowStr);

      // SQLite にも保存 (下位互換性のため)
      await db.runAsync(
        "UPDATE tasks SET is_completed = ?, updated_at = ? WHERE id = ?",
        [newCompletedState, nowStr, taskId]
      );

      if (newCompletedState === 1) {
        const tasks = await getTasksWithDetails();
        const task = tasks.find(t => t.id === taskId);
        
        if (task && task.is_recurring === 1) {
          const nextDueDate = new Date(task.due_date);
          nextDueDate.setDate(nextDueDate.getDate() + 7);
          
          const createdAt = new Date().toISOString();
          
          await saveTask({
            name: task.name,
            class_id: task.class_id,
            location_id: task.location_id,
            format: task.format,
            created_at: createdAt,
            due_date: nextDueDate.toISOString(),
            updated_at: createdAt,
            details: task.details,
            is_completed: 0,
            is_recurring: 1
          });

          // SQLite にも保存
          const query = `INSERT INTO tasks (name, class_id, location_id, format, created_at, due_date, updated_at, details, is_completed, is_recurring)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`;
          await db.runAsync(
            query,
            [
              String(task.name),
              task.class_id != null ? Number(task.class_id) : null,
              task.location_id != null ? Number(task.location_id) : null,
              String(task.format),
              String(createdAt),
              String(nextDueDate.toISOString()),
              String(createdAt),
              task.details != null ? String(task.details) : '',
              Number(task.is_recurring)
            ]
          );
        }
      }
      
      // UIの更新
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error("Failed to toggle task completion:", error);
      Alert.alert("エラー", "タスクの更新に失敗しました。");
    }
  };

  // スクロール量に応じたカレンダーの透明度
  const calendarOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // カレンダーが透明になったらタッチイベントを貫通させる
  useEffect(() => {
    const listenerId = scrollY.addListener(({ value }) => {
      if (value > 20 && calendarPointerEvents === 'auto') {
        setCalendarPointerEvents('none');
      } else if (value <= 20 && calendarPointerEvents === 'none') {
        setCalendarPointerEvents('auto');
      }
    });
    return () => {
      scrollY.removeListener(listenerId);
    };
  }, [calendarPointerEvents, scrollY]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* ホームに戻るボタン */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.push('/')}>
          <Ionicons name="home-outline" size={28} color={Colors.text.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.frame}>
        {isLargeScreen ? (
          // PC・タブレット用の2カラムレイアウト
          <View style={styles.largeScreenContainer}>
            <View style={styles.leftColumn}>
              <MonthCalendar 
                taskCounts={taskCounts} 
                completedTaskCounts={completedTaskCounts}
                selectedDate={selectedDate}
                onMonthChange={(year, month) => {
                  setCurrentYear(year);
                  setCurrentMonth(month);
                }}
                onDateSelect={(date) => setSelectedDate(date)}
              />
            </View>
            <View style={styles.rightColumn}>
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 }]}
                showsVerticalScrollIndicator={false}
              >
                {(() => {
                  const tasksForDate = tasks.filter(t => new Date(t.due_date).toDateString() === selectedDate.toDateString());
                  const incompleteTasks = tasksForDate.filter(t => t.is_completed === 0);
                  const completedTasks = tasksForDate.filter(t => t.is_completed === 1).sort((a, b) => {
                    const aTime = a.updated_at ? new Date(a.updated_at).getTime() : new Date(a.due_date).getTime();
                    const bTime = b.updated_at ? new Date(b.updated_at).getTime() : new Date(b.due_date).getTime();
                    return bTime - aTime;
                  });

                  return (
                    <View style={styles.listCard}>
                      <TaskList 
                        title="今月の課題"
                        summaryCount={tasks.filter(t => t.is_completed === 0).length}
                        totalCount={tasks.length}
                        selectedDate={selectedDate}
                        tasks={incompleteTasks} 
                        onToggleComplete={handleToggleComplete}
                        onTaskUpdated={() => setRefreshKey(prev => prev + 1)}
                        style={{ backgroundColor: 'transparent', marginHorizontal: 0, shadowOpacity: 0, elevation: 0, paddingBottom: completedTasks.length > 0 ? 0 : 24 }}
                      />
                      {completedTasks.length > 0 && (
                        <View style={styles.completedSeparator}>
                          <View style={styles.completedSeparatorLine} />
                          <Text style={styles.completedSeparatorText}>完了済み</Text>
                          <View style={styles.completedSeparatorLine} />
                        </View>
                      )}
                      {completedTasks.length > 0 && (
                        <TaskList 
                          tasks={completedTasks} 
                          hideHeader={true}
                          onToggleComplete={handleToggleComplete}
                          onTaskUpdated={() => setRefreshKey(prev => prev + 1)}
                          style={{ backgroundColor: 'transparent', marginHorizontal: 0, shadowOpacity: 0, elevation: 0, paddingTop: 0 }}
                        />
                      )}
                    </View>
                  );
                })()}
              </ScrollView>
            </View>
          </View>
        ) : (
          // モバイル用のレイアウト
          <>
            <Animated.ScrollView
              style={[styles.scroll, { zIndex: 1, elevation: 1 }]}
              contentContainerStyle={styles.scrollContent}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                { useNativeDriver: true }
              )}
              scrollEventThrottle={16}
            >
              {/* スペーサー: タスクが少ない時はflex:1で広がりTaskListを下へ押しやる。
                  タスクが多い時は最低でもカレンダーの高さ分を確保し、カレンダーの裏に隠れるのを防ぐ */}
              <View style={{ flex: 1, minHeight: Math.max(calendarHeight + 16, 420) }} />

              {(() => {
                const tasksForDate = tasks.filter(t => new Date(t.due_date).toDateString() === selectedDate.toDateString());
                const incompleteTasks = tasksForDate.filter(t => t.is_completed === 0);
                const completedTasks = tasksForDate.filter(t => t.is_completed === 1).sort((a, b) => {
                  const aTime = a.updated_at ? new Date(a.updated_at).getTime() : new Date(a.due_date).getTime();
                  const bTime = b.updated_at ? new Date(b.updated_at).getTime() : new Date(b.due_date).getTime();
                  return bTime - aTime;
                });

                return (
                  <View style={[styles.listCard, { marginBottom: 90 + insets.bottom }]}>
                    <TaskList 
                      title="今月の課題"
                      summaryCount={tasks.filter(t => t.is_completed === 0).length}
                      totalCount={tasks.length}
                      selectedDate={selectedDate}
                      tasks={incompleteTasks} 
                      onToggleComplete={handleToggleComplete}
                      onTaskUpdated={() => setRefreshKey(prev => prev + 1)}
                      style={{ backgroundColor: 'transparent', marginHorizontal: 0, shadowOpacity: 0, elevation: 0, paddingBottom: completedTasks.length > 0 ? 0 : 24 }}
                    />
                    {completedTasks.length > 0 && (
                      <View style={styles.completedSeparator}>
                        <View style={styles.completedSeparatorLine} />
                        <Text style={styles.completedSeparatorText}>完了済み</Text>
                        <View style={styles.completedSeparatorLine} />
                      </View>
                    )}
                    {completedTasks.length > 0 && (
                      <TaskList 
                        tasks={completedTasks} 
                        hideHeader={true}
                        onToggleComplete={handleToggleComplete}
                        onTaskUpdated={() => setRefreshKey(prev => prev + 1)}
                        style={{ backgroundColor: 'transparent', marginHorizontal: 0, shadowOpacity: 0, elevation: 0, paddingTop: 0 }}
                      />
                    )}
                  </View>
                );
              })()}
            </Animated.ScrollView>

            <Animated.View 
              pointerEvents={calendarPointerEvents}
              onLayout={(e) => setCalendarHeight(e.nativeEvent.layout.height)}
              style={[
                styles.paddedSection, 
                { 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  right: 0, 
                  zIndex: 10, 
                  elevation: 10, 
                  opacity: calendarOpacity,
                  backgroundColor: Colors.purple.primary,
                  paddingBottom: 16,
                }
              ]}
            >
              <MonthCalendar 
                taskCounts={taskCounts} 
                completedTaskCounts={completedTaskCounts}
                selectedDate={selectedDate}
                onMonthChange={(year, month) => {
                  setCurrentYear(year);
                  setCurrentMonth(month);
                }}
                onDateSelect={(date) => setSelectedDate(date)}
              />
            </Animated.View>
          </>
        )}

        <BottomNavBar onTaskCreated={() => setRefreshKey(prev => prev + 1)} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.purple.primary,
  },
  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 4,
  },
  frame: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  paddedSection: {
    paddingHorizontal: 16,
  },
  completedSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  completedSeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  completedSeparatorText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: '#888',
    fontWeight: 'bold',
  },
  // --- PC向け2カラム用スタイル ---
  largeScreenContainer: {
    flex: 1,
    flexDirection: 'row',
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 24,
    paddingBottom: 90,
  },
  leftColumn: {
    flex: 3, // 月表示はカレンダーを広め(60%)、タスクリストを狭め(40%)に分配
    height: '100%',
  },
  rightColumn: {
    flex: 2,
    height: '100%',
  },
  listCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    marginHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    overflow: 'hidden',
  }
});
