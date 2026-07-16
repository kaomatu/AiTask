import React, { useState, useEffect } from "react";
import { StyleSheet, Text, View, StyleProp, ViewStyle, TouchableOpacity, Modal, Pressable, ScrollView, Image, Linking, Switch, TouchableWithoutFeedback, DeviceEventEmitter } from "react-native";
import { Alert } from '@/utils/alert';
import { useSQLiteContext } from "expo-sqlite";
import { Colors } from "@/constants/colors";
import { Ionicons } from '@expo/vector-icons';
import { getTaskAttachments, deleteTask } from "../services/dbService";

export interface Task {
  id: number | string;
  name: string;
  due_date: string;
  is_completed: number; // SQLite returns 0 or 1
  format?: string;
  class_name?: string;
  location_name?: string;
  location_url?: string;
  location_color?: string;
  details?: string;
  is_recurring?: number;
  is_ghost?: boolean; // 未来の予定として動的に作られたタスク
}

const formatFriendlyDate = (isoString: string) => {
  const d = new Date(isoString);
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const day = dayNames[d.getDay()];
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${month}月${date}日(${day}) ${hours}:${minutes}`;
};

interface TaskListProps {
  tasks?: Task[];
  title?: string;
  summaryCount?: number; // 全体の未完了件数
  totalCount?: number; // 全体の件数（週や月全体）
  selectedDate?: Date;   // カレンダーで選択された日
  style?: StyleProp<ViewStyle>;
  onToggleComplete?: (taskId: number, currentCompletedState: number) => void;
  onTaskUpdated?: () => void;
  roundedBottom?: boolean;
  hideHeader?: boolean;
}

export default function TaskList({ tasks = [], title = "今週の課題", summaryCount, totalCount, selectedDate, style, onToggleComplete, onTaskUpdated, roundedBottom = false, hideHeader = false }: TaskListProps) {
  const db = useSQLiteContext();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [fullScreenImageUri, setFullScreenImageUri] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    const fetchAttachments = async () => {
      if (!selectedTask) {
        setAttachments([]);
        return;
      }
      try {
        const rows = await getTaskAttachments(Number(selectedTask.id));
        if (isActive) {
          setAttachments(rows);
        }
      } catch (err) {
        console.error("Failed to fetch attachments:", err);
      }
    };
    fetchAttachments();
    return () => { isActive = false; };
  }, [selectedTask]);

  const uncompletedCount = tasks.filter((t) => t.is_completed === 0).length;

  const handleDeleteTask = (taskId: number | string) => {
    Alert.alert(
      "タスクの削除",
      "このタスクを削除してもよろしいですか？",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除する",
          style: "destructive",
          onPress: async () => {
            try {
              // Firestoreから削除
              await deleteTask(Number(taskId));

              // SQLiteからも削除 (下位互換)
              await db.runAsync("DELETE FROM task_attachments WHERE task_id = ?", [taskId]);
              await db.runAsync("DELETE FROM tasks WHERE id = ?", [taskId]);
              setSelectedTask(null);
              if (onTaskUpdated) onTaskUpdated();
            } catch (err) {
              console.error("Failed to delete task:", err);
              Alert.alert("エラー", "タスクの削除に失敗しました。");
            }
          }
        }
      ]
    );
  };

  return (
    <View style={[
      styles.container, 
      roundedBottom && styles.containerRoundedBottom,
      style
    ]}>
      {!hideHeader && (
        <View style={styles.summaryBanner}>
          <Text style={styles.summaryLabel}>{title}</Text>
          <View style={styles.summaryCount}>
            <Text style={styles.summaryPrefix}>残り</Text>
            <Text style={styles.summaryNumber}>{summaryCount !== undefined ? summaryCount : uncompletedCount}</Text>
            {totalCount !== undefined ? (
              <Text style={styles.summarySuffix}>/ {totalCount}</Text>
            ) : (
              <Text style={styles.summarySuffix}>つ</Text>
            )}
          </View>
        </View>
      )}

      {selectedDate && (
        <View style={styles.dateHeader}>
          <Text style={styles.dateHeaderText}>
            {`${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日 (${['日', '月', '火', '水', '木', '金', '土'][selectedDate.getDay()]})`}
          </Text>
        </View>
      )}

      {tasks.length === 0 ? (
        <Text style={styles.emptyListText}>課題はありません🎉</Text>
      ) : (
        tasks.map((task) => (
          <View
            key={task.id}
            style={[
              styles.taskCard,
              task.location_color ? { borderLeftColor: task.location_color } : null,
              task.is_completed === 1 && styles.taskCardCompleted,
              task.is_ghost && styles.taskCardGhost,
            ]}
          >
            <TouchableOpacity 
              style={styles.checkboxContainer}
              onPress={() => !task.is_ghost && onToggleComplete && onToggleComplete(task.id as number, task.is_completed)}
            >
              <Ionicons 
                name={task.is_completed === 1 ? "checkmark-circle" : "ellipse-outline"} 
                size={24} 
                color={task.is_ghost ? "#ccc" : (task.is_completed === 1 ? Colors.purple.primary : "#ccc")} 
              />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.taskContent}
              onPress={() => setSelectedTask(task)}
            >
              <Text
                style={[
                  styles.taskTitle,
                  task.is_completed === 1 && styles.taskTitleCompleted,
                  task.is_ghost && styles.taskNameGhost,
                ]}
              >
                {task.name}
              </Text>
              {task.class_name && (
                <Text style={styles.courseNameText}>{task.class_name}</Text>
              )}
              <View style={styles.taskDeadline}>
                <Ionicons name="time-outline" size={14} color={task.is_completed === 1 ? "#6c757d" : "#333"} style={{ marginRight: 4 }} />
                <Text style={[styles.deadlineText, task.is_completed === 1 && styles.taskTextCompleted]}>
                  {formatFriendlyDate(task.due_date)}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        ))
      )}

      <Modal
        visible={!!selectedTask}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedTask(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedTask(null)} />
          <View style={styles.modalContent}>
            {selectedTask && (
                <>
                  <View style={styles.modalHeader}>
                    <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
                      <Text style={styles.modalTitle} numberOfLines={1}>{selectedTask.name}</Text>
                      {selectedTask.is_ghost && (
                        <View style={styles.ghostBadge}>
                          <Text style={styles.ghostBadgeText}>予定</Text>
                        </View>
                      )}
                    </View>
                    <TouchableOpacity onPress={() => setSelectedTask(null)} style={styles.closeButton}>
                      <Ionicons name="close" size={24} color="#666" />
                    </TouchableOpacity>
                  </View>

                  {selectedTask.is_ghost && (
                    <View style={styles.ghostWarningContainer}>
                      <Ionicons name="information-circle-outline" size={20} color="#FFC107" />
                      <Text style={styles.ghostWarningText}>これは未来の予定です。直近の課題を完了すると操作できるようになります。</Text>
                    </View>
                  )}

                  <ScrollView 
                    style={styles.modalBody}
                    contentContainerStyle={{ paddingBottom: 24 }}
                    showsVerticalScrollIndicator={true}
                  >
                    <View style={styles.detailRow}>
                      <Ionicons name="book-outline" size={20} color={Colors.purple.primary} style={styles.detailIcon} />
                      <View style={styles.detailTextContainer}>
                        <Text style={styles.detailLabel}>授業</Text>
                        <Text style={[styles.detailValue, !selectedTask.class_name && styles.emptyText]}>
                          {selectedTask.class_name || "設定なし"}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.detailRow}>
                      <Ionicons name="document-text-outline" size={20} color={Colors.purple.primary} style={styles.detailIcon} />
                      <View style={styles.detailTextContainer}>
                        <Text style={styles.detailLabel}>形式</Text>
                        <Text style={[styles.detailValue, !selectedTask.format && styles.emptyText]}>
                          {selectedTask.format || "指定なし"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.detailRow}>
                      <Ionicons name="location-outline" size={20} color={Colors.purple.primary} style={styles.detailIcon} />
                      <View style={styles.detailTextContainer}>
                        <Text style={styles.detailLabel}>提出場所</Text>
                        {selectedTask.location_url ? (
                          <TouchableOpacity onPress={() => Linking.openURL(selectedTask.location_url!)}>
                            <Text style={[styles.detailValue, { color: Colors.purple.primary, textDecorationLine: 'underline' }]}>
                              {selectedTask.location_name || "指定なし"}
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <Text style={[styles.detailValue, !selectedTask.location_name && styles.emptyText]}>
                            {selectedTask.location_name || "指定なし"}
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.detailRow}>
                      <Ionicons name="time-outline" size={20} color={Colors.purple.primary} style={styles.detailIcon} />
                      <View style={styles.detailTextContainer}>
                        <Text style={styles.detailLabel}>締切</Text>
                        <Text style={styles.detailValue}>{formatFriendlyDate(selectedTask.due_date)}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.detailRow}>
                      <Ionicons name="repeat-outline" size={20} color={Colors.purple.primary} style={styles.detailIcon} />
                      <View style={styles.detailTextContainer}>
                        <Text style={styles.detailLabel}>繰り返し</Text>
                        <Text style={[styles.detailValue, !selectedTask.is_recurring && styles.emptyText]}>
                          {selectedTask.is_recurring === 1 ? "1週間毎に繰り返す" : "なし"}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.detailBlock}>
                      <View style={styles.detailBlockHeader}>
                        <Ionicons name="reader-outline" size={20} color={Colors.purple.primary} style={styles.detailIcon} />
                        <Text style={styles.detailLabel}>メモ・詳細</Text>
                      </View>
                      {selectedTask.details && selectedTask.details.trim().length > 0 ? (
                        <Text style={styles.detailBodyText}>{selectedTask.details}</Text>
                      ) : (
                        <Text style={[styles.detailBodyText, styles.emptyText]}>メモはありません</Text>
                      )}
                    </View>

                    <View style={styles.detailBlock}>
                      <View style={styles.detailBlockHeader}>
                        <Ionicons name="image-outline" size={20} color={Colors.purple.primary} style={styles.detailIcon} />
                        <Text style={styles.detailLabel}>添付写真</Text>
                      </View>
                      {attachments && attachments.length > 0 ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.attachmentScroll}>
                          {attachments.map((img, index) => (
                            <TouchableOpacity key={index} onPress={() => setFullScreenImageUri(img.file_uri)}>
                              <Image source={{ uri: img.file_uri }} style={styles.attachmentThumbnail} />
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      ) : (
                        <Text style={[styles.detailBodyText, styles.emptyText]}>添付写真はありません</Text>
                      )}
                    </View>
                    
                    {!selectedTask.is_ghost && (
                      <View style={styles.modalActions}>
                        <TouchableOpacity 
                          style={styles.actionButton}
                          onPress={() => {
                            if (onToggleComplete) {
                              onToggleComplete(selectedTask.id as number, selectedTask.is_completed);
                              setSelectedTask(null);
                            }
                          }}
                        >
                          <Ionicons 
                            name={selectedTask.is_completed === 1 ? "refresh-outline" : "checkmark-circle-outline"} 
                            size={24} 
                            color={Colors.purple.primary} 
                          />
                          <Text style={styles.actionButtonText}>
                            {selectedTask.is_completed === 1 ? "未完了に戻す" : "完了にする"}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          style={styles.actionButton}
                          onPress={() => {
                            DeviceEventEmitter.emit('OPEN_TASK_EDIT', { task: selectedTask, attachments });
                            setSelectedTask(null);
                          }}
                        >
                          <Ionicons name="pencil-outline" size={24} color={Colors.purple.primary} />
                          <Text style={styles.actionButtonText}>
                            編集する
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          style={[styles.actionButton, styles.actionButtonDanger]}
                          onPress={() => handleDeleteTask(selectedTask.id)}
                        >
                          <Ionicons name="trash-outline" size={24} color="#dc3545" />
                          <Text style={[styles.actionButtonText, { color: "#dc3545" }]}>
                            削除する
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </ScrollView>
                </>
              )}
            </View>
          </View>
      </Modal>

      <Modal
        visible={!!fullScreenImageUri}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFullScreenImageUri(null)}
      >
        <Pressable 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }} 
          onPress={() => setFullScreenImageUri(null)}
        >
          {fullScreenImageUri && (
            <Image
              source={{ uri: fullScreenImageUri }}
              style={{ width: '100%', height: '100%', resizeMode: 'contain' }}
            />
          )}
          <TouchableOpacity 
            style={{ position: 'absolute', top: 50, right: 20, padding: 10 }}
            onPress={() => setFullScreenImageUri(null)}
          >
            <Ionicons name="close" size={32} color="#fff" />
          </TouchableOpacity>
        </Pressable>
      </Modal>
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
  containerRoundedBottom: {
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
  },
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
    alignItems: 'baseline',
  },
  summaryPrefix: {
    fontSize: 16,
    color: "#fff",
    fontWeight: '500',
    marginRight: 4,
  },
  summaryNumber: {
    fontSize: 40,
    fontWeight: '800',
    color: "#fff",
  },
  summarySuffix: {
    fontSize: 16,
    color: "#fff",
    fontWeight: '500',
    marginLeft: 2,
  },
  dateHeader: {
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  dateHeaderText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  taskCard: {
    backgroundColor: "#FFF9E6",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 10,
    borderLeftWidth: 8,
    borderLeftColor: "#F5D76E",
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  taskCardCompleted: {
    opacity: 0.6,
    backgroundColor: "#F8F9FA",
    borderLeftColor: "#CED4DA",
  },
  taskCardGhost: {
    opacity: 0.7,
    backgroundColor: '#FAFAFA',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderLeftColor: '#E0E0E0',
  },
  checkboxContainer: {
    marginRight: 12,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  taskTitleCompleted: {
    color: "#aaa",
    textDecorationLine: "line-through",
  },
  taskNameGhost: {
    color: '#666',
  },
  courseNameText: {
    fontSize: 12,
    color: Colors.purple.primary,
    marginBottom: 6,
    fontWeight: '600',
  },
  taskDeadline: {
    flexDirection: "row",
    alignItems: "center",
  },
  deadlineText: {
    fontSize: 14,
    color: "#333",
  },
  taskTextCompleted: {
    color: "#6c757d",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    maxHeight: '80%',
    backgroundColor: Colors.background.white,
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  ghostBadge: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  ghostBadgeText: {
    fontSize: 12,
    color: '#666',
    fontWeight: 'bold',
  },
  ghostWarningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9E6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  ghostWarningText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: '#856404',
    lineHeight: 18,
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    marginTop: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  detailBlock: {
    marginBottom: 16,
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
  },
  detailBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailBodyText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    marginLeft: 32,
  },
  attachmentScroll: {
    marginTop: 8,
    marginLeft: 32,
  },
  attachmentThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: '#e0e0e0',
  },
  detailIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  detailTextContainer: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    lineHeight: 22,
  },
  emptyText: {
    color: '#aaa',
    fontStyle: 'italic',
  },
  emptyListText: {
    textAlign: "center",
    color: "#888",
    fontSize: 16,
    marginVertical: 20,
  },
  modalActions: {
    flexDirection: 'column',
    marginTop: 20,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
  },
  actionButtonDanger: {
    backgroundColor: '#FFF5F5',
  },
  actionButtonText: {
    marginLeft: 8,
    fontWeight: 'bold',
    color: Colors.purple.primary,
  }
});
