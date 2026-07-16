import BottomNavBar from "@/components/BottomNavBar";
import TaskList from "@/components/TaskList";
import WeekCalendar from "@/components/WeekCalendar";
import { Colors } from "@/constants/colors";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { StyleSheet, View, TouchableOpacity, Animated, Dimensions, Text } from "react-native";
import { Alert } from '@/utils/alert';
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useSQLiteContext } from "expo-sqlite";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { generateGhostTasksForPeriod } from "@/utils/taskUtils";

export default function CalendarWeekScreen() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [taskCounts, setTaskCounts] = useState<Record<number, number>>({});
  const [completedTaskCounts, setCompletedTaskCounts] = useState<Record<number, number>>({});
  const [refreshKey, setRefreshKey] = useState(0);
  
  // 今週の日曜日を取得
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const getSunday = (d: Date) => {
    const nd = new Date(d);
    nd.setHours(0, 0, 0, 0);
    nd.setDate(nd.getDate() - nd.getDay());
    return nd;
  };
  const [currentSunday, setCurrentSunday] = useState(() => getSunday(today));
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const scrollY = useRef(new Animated.Value(0)).current;
  const [calendarPointerEvents, setCalendarPointerEvents] = useState<'auto' | 'none'>('auto');
  const [calendarHeight, setCalendarHeight] = useState(200);

  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const fetchTasks = async () => {
        try {
          // 現在の週の日曜日の始まり
          const startOfWeek = new Date(currentSunday);
          startOfWeek.setHours(0, 0, 0, 0);
          
          // 現在の週の土曜日の終わり
          const endOfWeek = new Date(currentSunday);
          endOfWeek.setDate(endOfWeek.getDate() + 6);
          endOfWeek.setHours(23, 59, 59, 999);

          const rows: any[] = await db.getAllAsync(
            `SELECT t.id, t.name, t.due_date, t.is_completed, t.format, c.name as class_name, loc.name as location_name, loc.url as location_url, loc.color as location_color, t.details, t.is_recurring 
             FROM tasks t 
             LEFT JOIN classes c ON t.class_id = c.id 
             LEFT JOIN task_locations loc ON t.location_id = loc.id
             ORDER BY t.due_date ASC`, 
            []
          );
          if (!isActive) return;

          // 週の範囲でゴーストタスクを生成
          const tasksForWeek = generateGhostTasksForPeriod(rows, startOfWeek, endOfWeek);

          setTasks(tasksForWeek);

          // カレンダー用に日にちごとの件数を計算
          const counts: Record<number, number> = {};
          const completedCounts: Record<number, number> = {};
          for (const task of tasksForWeek) {
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
          console.error("Failed to fetch tasks for week:", err);
        }
      };
      fetchTasks();
      return () => { isActive = false; };
    }, [currentSunday, refreshKey])
  );

  // タスクの完了切り替えとクローン生成ロジック
  const handleToggleComplete = async (taskId: number, currentCompletedState: number) => {
    try {
      const newCompletedState = currentCompletedState === 1 ? 0 : 1;
      await db.runAsync(
        "UPDATE tasks SET is_completed = ?, updated_at = ? WHERE id = ?",
        [newCompletedState, new Date().toISOString(), taskId]
      );
      if (newCompletedState === 1) {
        const task: any = await db.getFirstAsync("SELECT * FROM tasks WHERE id = ?", [taskId]);
        if (task && task.is_recurring === 1) {
          const nextDueDate = new Date(task.due_date);
          nextDueDate.setDate(nextDueDate.getDate() + 7);
          const createdAt = new Date().toISOString();
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
      // 20pxスクロールした時点ですぐに貫通させる
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
      {/* 戻るボタン */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back-circle-outline" size={32} color={Colors.text.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.frame}>
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
                  title="今週の課題"
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
          <WeekCalendar 
            taskCounts={taskCounts} 
            completedTaskCounts={completedTaskCounts}
            selectedDate={selectedDate}
            onWeekChange={(sundayDate) => setCurrentSunday(sundayDate)}
            onDateSelect={(date) => setSelectedDate(date)}
          />
        </Animated.View>

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
