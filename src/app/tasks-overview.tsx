import React, { useState, useCallback, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from "react-native";
import { Alert } from '@/utils/alert';
import { SafeAreaView } from "react-native-safe-area-context";
import { useSQLiteContext } from "expo-sqlite";
import { useFocusEffect, Stack, useRouter } from "expo-router";
import { getTasksWithDetails, toggleTaskComplete, saveTask, syncOfflineAttachments } from "../services/dbService";
import { auth } from "../config/firebase";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import TaskList from "@/components/TaskList";
import Timetable from "@/components/Timetable";
import { generateGhostTasksForPeriod } from "@/utils/taskUtils";
import TaskCreateModal from "@/components/TaskCreateModal";

export default function TasksOverviewScreen() {
  const [taskViewMode, setTaskViewMode] = useState<'incomplete' | 'completed'>('incomplete');
  const [tasks, setTasks] = useState<any[]>([]);
  const [completedTasks, setCompletedTasks] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | 'all' | null>(null);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await syncOfflineAttachments();
    } catch (e) {
      console.warn("Refresh sync warning:", e);
    } finally {
      setRefreshKey(prev => prev + 1);
      setIsRefreshing(false);
    }
  };

  const db = useSQLiteContext();
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const fetchTasks = async () => {
        if (!auth.currentUser) return;
        try {
          syncOfflineAttachments().catch(() => {});
          const rows = await getTasksWithDetails();
          if (!isActive) return;

          // 未完了タスク
          const incompleteTasks = rows.filter(t => t.is_completed === 0);
          
          // 今日から約3ヶ月後（90日）までのゴーストタスクを生成して一覧に含める
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const threeMonthsLater = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
          
          const tasksWithGhosts = generateGhostTasksForPeriod(incompleteTasks, today, threeMonthsLater);
          
          setTasks(tasksWithGhosts);

          // 完了タスク (新しい順にソート)
          const comp = rows.filter(t => t.is_completed === 1).sort((a, b) => {
            const aTime = a.updated_at ? new Date(a.updated_at).getTime() : new Date(a.due_date).getTime();
            const bTime = b.updated_at ? new Date(b.updated_at).getTime() : new Date(b.due_date).getTime();
            return bTime - aTime;
          });
          setCompletedTasks(comp);

        } catch (err) {
          console.error("Failed to fetch tasks in overview:", err);
        }
      };
      fetchTasks();
      return () => { isActive = false; };
    }, [refreshKey])
  );

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
          await db.runAsync(
            `INSERT INTO tasks (name, class_id, location_id, format, created_at, due_date, updated_at, details, is_completed, is_recurring)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
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
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error("Failed to toggle task completion:", error);
      Alert.alert("エラー", "タスクの更新に失敗しました。");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* カスタムヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back-circle-outline" size={32} color={Colors.purple.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>タスク一覧</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        {/* タブ切り替え */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tabButton, taskViewMode === 'incomplete' && styles.tabButtonActive]}
            onPress={() => setTaskViewMode('incomplete')}
          >
            <Text style={[styles.tabText, taskViewMode === 'incomplete' && styles.tabTextActive]}>現在未完了のタスク</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabButton, taskViewMode === 'completed' && styles.tabButtonActive]}
            onPress={() => setTaskViewMode('completed')}
          >
            <Text style={[styles.tabText, taskViewMode === 'completed' && styles.tabTextActive]}>過去のタスク</Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          ref={scrollViewRef} 
          style={styles.scrollContainer} 
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[Colors.purple.primary]} />
          }
        >
          {taskViewMode === 'incomplete' ? (
            <>
              <View style={styles.allButtonContainer}>
                <TouchableOpacity 
                  style={[styles.allButton, selectedClassId === 'all' && styles.allButtonActive]}
                  onPress={() => {
                    setSelectedClassId('all');
                    setTimeout(() => {
                      scrollViewRef.current?.scrollToEnd({ animated: true });
                    }, 100);
                  }}
                >
                  <Ionicons name="list" size={18} color={selectedClassId === 'all' ? '#FFF' : Colors.purple.primary} style={{ marginRight: 8 }} />
                  <Text style={[styles.allButtonText, selectedClassId === 'all' && styles.allButtonTextActive]}>
                    すべての未完了タスクを表示
                  </Text>
                </TouchableOpacity>
              </View>

              <Timetable 
                isEditMode={false}
                isSelectMode={true}
                refreshKey={refreshKey}
                onSelectClass={(classItem) => {
                  setSelectedClassId(classItem.id);
                  // レンダリングが終わった頃に一番下までスクロールさせる
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 100);
                }} 
              />
              {selectedClassId !== null && (
                <View style={styles.taskListWrapper}>
                  <TaskList 
                    tasks={selectedClassId === 'all' ? tasks : tasks.filter(t => t.class_id === selectedClassId)}
                    hideHeader={true}
                    onToggleComplete={handleToggleComplete}
                    onTaskUpdated={() => setRefreshKey(prev => prev + 1)}
                    style={{ backgroundColor: 'transparent', paddingHorizontal: 0, paddingBottom: 0 }}
                  />
                </View>
              )}
            </>
          ) : (
            <View style={styles.taskListWrapper}>
              <TaskList 
                tasks={completedTasks}
                hideHeader={true}
                onToggleComplete={handleToggleComplete}
                onTaskUpdated={() => setRefreshKey(prev => prev + 1)}
                style={{ backgroundColor: 'transparent', paddingHorizontal: 0, paddingBottom: 0 }}
              />
            </View>
          )}
        </ScrollView>
      </View>
      <TaskCreateModal onTaskCreated={() => setRefreshKey(prev => prev + 1)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.light,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: Colors.purple.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#FFF',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  taskListWrapper: {
    marginTop: 16,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  allButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  allButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: Colors.purple.primary + '15',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.purple.primary + '30',
  },
  allButtonActive: {
    backgroundColor: Colors.purple.primary,
    borderColor: Colors.purple.primary,
  },
  allButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.purple.primary,
  },
  allButtonTextActive: {
    color: '#FFF',
  }
});
