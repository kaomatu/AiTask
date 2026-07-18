import React, { useState, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal, 
  TouchableWithoutFeedback, 
  KeyboardAvoidingView, 
  Platform,
  TextInput,
  ScrollView,
  Switch,
  PanResponder,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Alert } from '@/utils/alert';
import { Colors } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useIsFocused } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import { useSQLiteContext } from 'expo-sqlite';
import { getTaskLocations, saveTask, deleteTaskAttachments, saveTaskAttachment } from '../services/dbService';
import { useRouter } from 'expo-router';
import { storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth } from '../config/firebase';
import { DeviceEventEmitter } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { extractFilenameFromUri } from '@/utils/fileUtils';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (最大許容送信データ量)

const getLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export interface TaskCreateModalRef {
  present: (course: any | null) => void;
  dismiss: () => void;
}

const FORMAT_OPTIONS = ['課題', 'レポート', '定期テスト', '小テスト', 'グループワーク'];

interface TaskCreateModalProps {
  onTaskCreated?: () => void;
}

const TaskCreateModal = forwardRef(function TaskCreateModal(props: TaskCreateModalProps, forwardedRef: React.ForwardedRef<TaskCreateModalRef>) {
  const db = useSQLiteContext();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [editTaskId, setEditTaskId] = useState<number | null>(null);
  
  // フォームステート
  const [taskName, setTaskName] = useState('');
  const [format, setFormat] = useState('課題');
  const [dueDate, setDueDate] = useState(new Date());
  const [dueHour, setDueHour] = useState(23);
  const [dueMinute, setDueMinute] = useState(55);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [location, setLocation] = useState('Moodle');
  const [details, setDetails] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [attachments, setAttachments] = useState<{uri: string, type: string, name?: string, file?: any}>([]);
  const [locationOptions, setLocationOptions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const insets = useSafeAreaInsets();

  const fetchLocations = async () => {
    try {
      const rows = await getTaskLocations();
      rows.sort((a, b) => a.id - b.id);
      const names = rows.map((r: any) => r.name);
      setLocationOptions(names);
      return names;
    } catch (err) {
      console.error("Failed to fetch locations:", err);
      return [];
    }
  };

  const isFocused = useIsFocused();

  useEffect(() => {
    fetchLocations().then(names => {
      if (names.length > 0 && !location) {
        setLocation(names[0]);
      }
    });

    const subscription = DeviceEventEmitter.addListener('OPEN_TASK_EDIT', ({ task, attachments: existingAttachments }) => {
      if (!isFocused) return; // フォーカスされていない画面のモーダルは開かない
      
      setEditTaskId(Number(task.id));
      setTaskName(task.name || '');
      setFormat(task.format || '課題');
      
      const d = new Date(task.due_date);
      setDueDate(d);
      setDueHour(d.getHours());
      setDueMinute(d.getMinutes());
      
      setLocation(task.location_name || '');
      setDetails(task.details || '');
      setIsRecurring(task.is_recurring === 1);
      
      if (task.class_name) {
        setSelectedCourse({ id: task.class_id, name: task.class_name });
      } else {
        setSelectedCourse(null);
      }
      
      if (existingAttachments && existingAttachments.length > 0) {
        setAttachments(existingAttachments.map((a: any) => ({ 
          uri: a.file_uri, 
          type: a.file_type,
          name: extractFilenameFromUri(a.file_uri)
        })));
      } else {
        setAttachments([]);
      }
      
      setVisible(true);
    });
    
    return () => {
      subscription.remove();
    };
  }, [isFocused]);

  useImperativeHandle(forwardedRef, () => ({
    present: async (course: any | null) => {
      setEditTaskId(null);
      setSelectedCourse(course);
      setTaskName('');
      setFormat('課題');
      setDueDate(new Date());
      setDueHour(23);
      setDueMinute(55);
      
      const names = await fetchLocations();
      if (names.length > 0) {
        setLocation(names[0]);
      } else {
        setLocation('');
      }
      
      setDetails('');
      setIsRecurring(false);
      setAttachments([]);
      setVisible(true);
    },
    dismiss: () => setVisible(false)
  }));

  // ファイルサイズを取得するヘルパー関数
  const getFileSize = async (uri: string, file?: any): Promise<number> => {
    try {
      if (Platform.OS === 'web') {
        if (file && file.size) return file.size;
        const res = await fetch(uri);
        const blob = await res.blob();
        return blob.size;
      } else {
        const info = await FileSystem.getInfoAsync(uri);
        if (info.exists) {
          return info.size;
        }
      }
    } catch (e) {
      console.warn("Failed to get file size:", e);
    }
    return 0;
  };

  // 画像を圧縮するヘルパー関数
  const compressImage = async (uri: string): Promise<string> => {
    if (Platform.OS === 'web') {
      return new Promise((resolve) => {
        const img = new window.Image();
        img.src = uri;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          const MAX_DIM = 1600;
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
          } else {
            resolve(uri);
          }
        };
        img.onerror = () => resolve(uri);
      });
    } else {
      try {
        const manipResult = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 1600 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );
        return manipResult.uri;
      } catch (e) {
        console.warn("Failed to compress image:", e);
        return uri;
      }
    }
  };

  const pickImage = async (useCamera: boolean) => {
    // 権限リクエスト
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('エラー', 'カメラへのアクセス許可が必要です。');
        return;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('エラー', '写真へのアクセス許可が必要です。');
        return;
      }
    }

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: false,
    };

    const result = useCamera 
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const originalUri = result.assets[0].uri;
      
      // 画像を詳細が失われない程度に圧縮
      const compressedUri = await compressImage(originalUri);
      const fileSize = await getFileSize(compressedUri);

      // 最大許容送信データ量の制限をチェック
      if (fileSize > MAX_FILE_SIZE) {
        Alert.alert(
          '送信不可',
          `選択された写真のサイズが上限（10MB）を超えています。\n（現在のサイズ: ${(fileSize / (1024 * 1024)).toFixed(2)} MB）`
        );
        return;
      }

      const fileName = decodeURIComponent(compressedUri.split('/').pop() || 'photo.jpg');
      setAttachments(prev => [...prev, { uri: compressedUri, type: 'image', name: fileName }]);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const isImg = asset.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(asset.name);
        
        let finalUri = asset.uri;
        let finalFile = (asset as any).file; // Web環境では File オブジェクトが存在する

        if (isImg) {
          // 画像なら圧縮処理を通す
          finalUri = await compressImage(asset.uri);
          finalFile = undefined; // 圧縮したため元のFileオブジェクトは使わない
        }

        const fileSize = await getFileSize(finalUri, finalFile);

        // 最大許容送信データ量の制限をチェック
        if (fileSize > MAX_FILE_SIZE) {
          Alert.alert(
            '送信不可',
            `選択されたファイルのサイズが上限（10MB）を超えています。\n（現在のサイズ: ${(fileSize / (1024 * 1024)).toFixed(2)} MB）`
          );
          return;
        }

        setAttachments(prev => [...prev, {
          uri: finalUri,
          type: isImg ? 'image' : 'document',
          name: asset.name,
          file: finalFile
        }]);
      }
    } catch (err) {
      console.error("Document Picker Error:", err);
      Alert.alert('エラー', 'ファイルの選択に失敗しました。');
    }
  };

  const handleAddAttachment = () => {
    if (Platform.OS === 'web') {
      // Web環境ではブラウザのファイル選択で画像もPDFも自由に選べるため、直接ドキュメントピッカーを開く
      pickDocument();
    } else {
      // モバイル環境（iOS/Android）ではカメラ起動などを含む選択アラートを提示
      Alert.alert(
        '添付ファイルを追加',
        '追加方法を選択してください',
        [
          { text: 'カメラで撮影', onPress: () => pickImage(true) },
          { text: '写真アルバムから選択', onPress: () => pickImage(false) },
          { text: 'ドキュメント/PDFを選択', onPress: () => pickDocument() },
          { text: 'キャンセル', style: 'cancel' }
        ]
      );
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!taskName.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      // SQLiteのtask_locationsを確認（デバッグ）
      try {
        const dbLocs = await db.getAllAsync("SELECT * FROM task_locations");
        console.log("📊 SQLite task_locations:", dbLocs);
      } catch (e) {
        console.error("📊 Failed to fetch task_locations from SQLite:", e);
      }

      const finalDate = new Date(dueDate);
      finalDate.setHours(dueHour, dueMinute, 0, 0);
      const isoDate = finalDate.toISOString();
      const createdAt = new Date().toISOString();
      
      let locId: number | null = null;
      if (location) {
        const locations = await getTaskLocations();
        const loc = locations.find((l: any) => l.name === location);
        if (loc) {
          locId = loc.id;
        }
      }
      
      const safeNumber = (val: any): number | null => {
        if (val === undefined || val === null) return null;
        const num = Number(val);
        return isNaN(num) ? null : num;
      };

      const classIdNum = selectedCourse?.id ? safeNumber(selectedCourse.id) : null;
      const locIdNum = locId != null ? safeNumber(locId) : null;

      let taskId: number;
      if (editTaskId) {
        // 更新処理 (Firestore = 正)
        const editTaskIdNum = safeNumber(editTaskId) || Date.now();
        await saveTask({
          id: editTaskIdNum,
          name: taskName || "",
          class_id: classIdNum,
          location_id: locIdNum,
          format: format || "",
          created_at: createdAt,
          due_date: isoDate,
          updated_at: createdAt,
          details: details ? String(details) : "",
          is_recurring: isRecurring ? 1 : 0
        });
        taskId = editTaskIdNum;
        
        // Firestoreの既存の添付ファイルを削除
        await deleteTaskAttachments(taskId);

        // SQLiteの更新 (下位互換 - ベストエフォート)
        try {
          const query = `UPDATE tasks SET name = ?, class_id = ?, location_id = ?, format = ?, due_date = ?, updated_at = ?, details = ?, is_recurring = ? WHERE id = ?`;
          await db.runAsync(query, [
            String(taskName || ""),
            classIdNum,
            locIdNum,
            String(format || ""),
            String(isoDate),
            String(createdAt),
            details ? String(details) : "",
            isRecurring ? 1 : 0,
            taskId
          ]);
          await db.runAsync("DELETE FROM task_attachments WHERE task_id = ?", [taskId]);
        } catch (sqliteErr) {
          console.warn("⚠️ SQLite更新スキップ（Firestoreには保存済み）:", sqliteErr);
        }
      } else {
        // 新規作成処理 (Firestore = 正)
        const saved = await saveTask({
          name: taskName || "",
          class_id: classIdNum,
          location_id: locIdNum,
          format: format || "",
          created_at: createdAt,
          due_date: isoDate,
          updated_at: createdAt,
          details: details ? String(details) : "",
          is_recurring: isRecurring ? 1 : 0
        });
        taskId = safeNumber(saved.id) || Date.now();

        // SQLiteに挿入 (下位互換 - ベストエフォート)
        try {
          const query = `INSERT INTO tasks (id, name, class_id, location_id, format, created_at, due_date, updated_at, details, is_completed, is_recurring)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`;
          await db.runAsync(
            query,
            [
              taskId,
              String(taskName || ""),
              classIdNum,
              locIdNum,
              String(format || ""),
              String(createdAt),
              String(isoDate),
              String(createdAt),
              details ? String(details) : "",
              isRecurring ? 1 : 0
            ]
          );
        } catch (sqliteErr) {
          console.warn("⚠️ SQLite挿入スキップ（Firestoreには保存済み）:", sqliteErr);
        }
      }
      
      // 2. 添付ファイルの保存 (Firebase Storage にアップロード)
      if (attachments.length > 0) {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('ユーザーが認証されていません');

        for (const attachment of attachments) {
          const originalName = attachment.name || attachment.uri.split('/').pop() || 'file';
          const filename = `${Date.now()}_${originalName}`;
          const storagePath = `users/${userId}/attachments/${taskId}/${filename}`;
          const storageRef = ref(storage, storagePath);

          // ファイルデータを取得してアップロード
          let blob: Blob;
          if (Platform.OS === 'web' && attachment.file) {
            // Web: 選択したFileオブジェクトをそのまま利用
            blob = attachment.file;
          } else {
            // Webの圧縮画像 または ネイティブ環境: fetchでBlob化（RNのfetchはfile://にも対応）
            const response = await fetch(attachment.uri);
            blob = await response.blob();
          }

          // Firebase Storage にアップロード
          await uploadBytes(storageRef, blob);
          const downloadUrl = await getDownloadURL(storageRef);
          console.log(`📤 アップロード完了: ${downloadUrl}`);

          // Firestoreにダウンロード URL を保存
          await saveTaskAttachment({
            task_id: taskId,
            file_uri: downloadUrl,
            file_type: attachment.type || ""
          });

          // SQLiteに保存 (下位互換 - ベストエフォート)
          try {
            await db.runAsync(
              `INSERT INTO task_attachments (task_id, file_uri, file_type) VALUES (?, ?, ?)`,
              [taskId, String(downloadUrl), String(attachment.type || "")]
            );
          } catch (sqliteErr) {
            console.warn("⚠️ SQLite添付保存スキップ:", sqliteErr);
          }
        }
      }

      console.log(`✅ タスク保存完了 (ID: ${taskId}) 添付ファイル: ${attachments.length}件`);
      
      // 親コンポーネントに通知
      props.onTaskCreated?.();

      // 状態をリセット
      setTaskName("");
      setDetails("");
      setAttachments([]);
      setIsRecurring(false);

      setVisible(false);
    } catch (error) {
      console.error("タスク保存エラー:", error);
      Alert.alert("エラー", "タスクの保存に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeModal = () => {
    setVisible(false);
  };

  const onChangeDate = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDueDate(selectedDate);
    }
  };

  // 下スワイプで閉じるためのPanResponder（ドラッグ判定）
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // 下方向へのスワイプの場合のみ反応
        return gestureState.dy > 0 && gestureState.dy > Math.abs(gestureState.dx);
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy > 50) { // 50px以上下にスワイプしたら閉じる
          closeModal();
        }
      },
    })
  ).current;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={closeModal}
    >
      {/* 背景の暗い部分（絶対配置で画面全体を覆う） */}
      <TouchableWithoutFeedback onPress={closeModal}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.keyboardAvoiding}
        pointerEvents="box-none"
      >
        <View style={[styles.sheet, { paddingBottom: insets.bottom > 0 ? insets.bottom : 24 }]}>
          {/* ドラッグ可能なインジケーター部分 */}
          <View style={styles.indicatorContainer} {...panResponder.panHandlers}>
            <View style={styles.indicator} />
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>{editTaskId ? '課題の編集' : '新しい課題'}</Text>
            {selectedCourse && (
              <View style={styles.courseBadge}>
                <Text style={styles.courseBadgeText}>{selectedCourse.name}</Text>
              </View>
            )}
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* 課題名 */}
            <TextInput
              style={styles.input}
              placeholder="課題名を入力..."
              placeholderTextColor={Colors.text.secondary}
              value={taskName}
              onChangeText={setTaskName}
              autoFocus={true}
            />

            {/* 形式 */}
            <Text style={styles.sectionLabel}>形式</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {FORMAT_OPTIONS.map(opt => (
                <TouchableOpacity 
                  key={opt} 
                  style={[styles.chip, format === opt && styles.chipSelected]}
                  onPress={() => setFormat(opt)}
                >
                  <Text style={[styles.chipText, format === opt && styles.chipTextSelected]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* 提出期限 */}
            <View style={styles.dateHeaderRow}>
              <Text style={[styles.sectionLabel, { marginTop: 0, marginBottom: 0 }]}>提出日</Text>
              <TouchableOpacity 
                style={styles.quickDateButton} 
                onPress={() => {
                  const nextWeek = new Date();
                  nextWeek.setDate(nextWeek.getDate() + 7);
                  setDueDate(nextWeek);
                }}
              >
                <Text style={styles.quickDateButtonText}>来週 (+7日)</Text>
              </TouchableOpacity>
            </View>
            {Platform.OS === 'web' ? (
              <View style={styles.webDateContainer}>
                <input
                  type="date"
                  value={getLocalDateString(dueDate)}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) {
                      const [year, month, day] = val.split('-').map(Number);
                      const newDate = new Date(dueDate);
                      newDate.setFullYear(year, month - 1, day);
                      setDueDate(newDate);
                    }
                  }}
                  style={{
                    paddingTop: 12,
                    paddingBottom: 12,
                    paddingLeft: 16,
                    paddingRight: 40,
                    fontSize: 16,
                    borderRadius: 12,
                    border: 'none',
                    backgroundColor: Colors.background.light,
                    color: Colors.text.primary,
                    width: '100%',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    outline: 'none',
                  }}
                />
              </View>
            ) : Platform.OS === 'ios' ? (
              <View style={styles.datePickerContainer}>
                <DateTimePicker
                  value={dueDate}
                  mode="date"
                  display="default"
                  onChange={onChangeDate}
                  locale="ja-JP"
                />
              </View>
            ) : (
              <View style={styles.androidDateRow}>
                <TouchableOpacity style={styles.androidDateBtn} onPress={() => setShowDatePicker(true)}>
                  <Text style={styles.androidDateText}>{dueDate.toLocaleDateString('ja-JP')}</Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={dueDate}
                    mode="date"
                    display="default"
                    onChange={onChangeDate}
                  />
                )}
              </View>
            )}

            {/* 提出時間 */}
            <View style={styles.timeHeader}>
              <Text style={[styles.sectionLabel, { marginTop: 0, marginBottom: 0 }]}>提出時間</Text>
              <View style={styles.timeDisplayContainer}>
                <Text style={styles.timeDisplay}>
                  {String(dueHour).padStart(2, '0')}:{String(dueMinute).padStart(2, '0')}
                </Text>
              </View>
            </View>
            <View style={styles.timePickerContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeChipRow}>
                {Array.from({ length: 24 }, (_, i) => i).map(h => (
                  <TouchableOpacity 
                    key={`h-${h}`} 
                    style={[styles.chip, dueHour === h && styles.chipSelected]}
                    onPress={() => setDueHour(h)}
                  >
                    <Text style={[styles.chipText, dueHour === h && styles.chipSelected ? styles.chipTextSelected : null]}>
                      {String(h).padStart(2, '0')}時
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeChipRow}>
                {Array.from({ length: 12 }, (_, i) => i * 5).map(m => (
                  <TouchableOpacity 
                    key={`m-${m}`} 
                    style={[styles.chip, dueMinute === m && styles.chipSelected]}
                    onPress={() => setDueMinute(m)}
                  >
                    <Text style={[styles.chipText, dueMinute === m && styles.chipSelected ? styles.chipTextSelected : null]}>
                      {String(m).padStart(2, '0')}分
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* 提出場所 */}
            <Text style={styles.sectionLabel}>提出場所</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {locationOptions.map(opt => (
                <TouchableOpacity 
                  key={opt} 
                  style={[styles.chip, location === opt && styles.chipSelected]}
                  onPress={() => setLocation(opt)}
                >
                  <Text style={[styles.chipText, location === opt && styles.chipTextSelected]}>{opt}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity 
                style={[styles.chip, { borderStyle: 'dashed', borderColor: Colors.purple.primary }]}
                onPress={() => {
                  closeModal();
                  router.push({ pathname: '/settings', params: { openLocations: 'true' } });
                }}
              >
                <Text style={[styles.chipText, { color: Colors.purple.primary }]}><Ionicons name="add" size={14} /> 追加する</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* 繰り返し設定 */}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>1週間毎に繰り返す</Text>
              <Switch
                value={isRecurring}
                onValueChange={setIsRecurring}
                trackColor={{ false: Colors.background.light, true: Colors.purple.light }}
                thumbColor={isRecurring ? Colors.purple.primary : Colors.text.secondary}
              />
            </View>

            {/* 詳細メモ */}
            <Text style={styles.sectionLabel}>詳細メモ</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder="メモやURLなど..."
              placeholderTextColor={Colors.text.secondary}
              value={details}
              onChangeText={setDetails}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            
            {/* 添付ファイル */}
            <View style={styles.attachmentHeader}>
              <Text style={styles.sectionLabel}>添付ファイル</Text>
              <TouchableOpacity onPress={handleAddAttachment} style={styles.addAttachmentBtn}>
                <Ionicons name="document-attach-outline" size={18} color={Colors.purple.primary} />
                <Text style={styles.addAttachmentText}>ファイルを追加</Text>
              </TouchableOpacity>
            </View>
            
            {attachments.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.attachmentScroll}>
                {attachments.map((att, index) => (
                  <View key={index} style={styles.attachmentWrapper}>
                    {att.type === 'image' ? (
                      <Image source={{ uri: att.uri }} style={styles.attachmentImage} />
                    ) : (
                      <View style={styles.attachmentDocumentBox}>
                        <Ionicons name="document-text-outline" size={32} color={Colors.purple.primary} />
                        <Text style={styles.attachmentDocumentName} numberOfLines={1} ellipsizeMode="middle">
                          {att.name || 'ファイル'}
                        </Text>
                      </View>
                    )}
                    <TouchableOpacity 
                      style={styles.attachmentRemoveBtn} 
                      onPress={() => removeAttachment(index)}
                    >
                      <Ionicons name="close" size={16} color={Colors.background.white} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
            
            <View style={{ height: 40 }} />
          </ScrollView>

          <View style={styles.footerContainer}>
            <TouchableOpacity 
              style={[styles.saveButton, (!taskName.trim() || isSubmitting) && styles.saveButtonDisabled]} 
              onPress={handleSave}
              disabled={!taskName.trim() || isSubmitting}
            >
              <Text style={styles.saveButtonText}>{isSubmitting ? "保存中..." : (editTaskId ? "更新する" : "保存")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {isSubmitting && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.purple.primary} />
            <Text style={styles.loadingText}>タスク保存中...</Text>
          </View>
        </View>
      )}
    </Modal>
  );
});

const styles = StyleSheet.create({
  keyboardAvoiding: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    backgroundColor: Colors.background.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 8,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 20,
  },
  indicatorContainer: {
    alignItems: 'center',
    paddingVertical: 12, // ドラッグしやすいように判定エリアを少し広めにとる
    marginBottom: 4,
  },
  indicator: {
    width: 80, // 40から80に倍増させて横長に
    height: 5, // 少しだけ太く
    backgroundColor: Colors.text.secondary,
    borderRadius: 3,
    opacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  courseBadge: {
    backgroundColor: Colors.purple.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  courseBadgeText: {
    color: Colors.purple.primary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  scrollContent: {
    flexShrink: 1,
  },
  input: {
    fontSize: 18,
    color: Colors.text.primary,
    backgroundColor: Colors.background.light,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  multilineInput: {
    minHeight: 100,
    fontSize: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text.secondary,
    marginBottom: 8,
    marginTop: 8,
  },
  chipRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  chip: {
    backgroundColor: Colors.background.light,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipSelected: {
    backgroundColor: Colors.purple.primary + '10',
    borderColor: Colors.purple.primary,
  },
  chipText: {
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: Colors.purple.primary,
  },
  dateHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  quickDateButton: {
    backgroundColor: Colors.purple.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  quickDateButtonText: {
    color: Colors.purple.primary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  datePickerContainer: {
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  webDateContainer: {
    marginBottom: 16,
  },
  timeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  timeDisplayContainer: {
    backgroundColor: Colors.purple.primary + '15',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
  },
  timeDisplay: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.purple.primary,
    fontVariant: ['tabular-nums'],
  },
  timePickerContainer: {
    marginBottom: 16,
  },
  timeChipRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  androidDateRow: {
    marginBottom: 16,
  },
  androidDateBtn: {
    backgroundColor: Colors.background.light,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  androidDateText: {
    fontSize: 16,
    color: Colors.text.primary,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background.light,
    marginBottom: 16,
  },
  switchLabel: {
    fontSize: 16,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 12,
    paddingBottom: 8,
  },
  saveButton: {
    backgroundColor: Colors.purple.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: Colors.background.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.text.secondary,
  },
  attachmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addAttachmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.purple.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  addAttachmentText: {
    color: Colors.purple.primary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  attachmentScroll: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  attachmentWrapper: {
    position: 'relative',
    marginRight: 12,
    marginTop: 8,
  },
  attachmentImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#E0E0E0', // プレースホルダー色
  },
  attachmentDocumentBox: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
  },
  attachmentDocumentName: {
    fontSize: 9,
    color: Colors.text.primary,
    marginTop: 4,
    width: '100%',
    textAlign: 'center',
  },
  attachmentRemoveBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingBox: {
    backgroundColor: Colors.background.white,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
  }
});

export default TaskCreateModal;
