import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Alert } from '@/utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Timetable from '@/components/Timetable';
import CourseEditModal from '@/components/CourseEditModal';
import { Colors } from '@/constants/colors';

export default function TimetableEditScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);

  // モーダル管理用State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDayString, setEditingDayString] = useState('');
  const [editingDayOfWeek, setEditingDayOfWeek] = useState(0);
  const [editingPeriod, setEditingPeriod] = useState(1);
  const [editingCourseId, setEditingCourseId] = useState<number | null>(null);
  const [editingCourseName, setEditingCourseName] = useState('');
  const [previousCourseName, setPreviousCourseName] = useState<string | undefined>(undefined);

  // 空のセル（追加）がタップされたとき
  const handleAddCourse = (dayString: string, period: number, prevCourseName?: string) => {
    const dayMap: { [key: string]: number } = {
      '月': 0, '火': 1, '水': 2, '木': 3, '金': 4, '土': 5, '日': 6
    };
    setEditingDayString(dayString);
    setEditingDayOfWeek(dayMap[dayString] ?? 0);
    setEditingPeriod(period);
    setEditingCourseId(null);
    setEditingCourseName('');
    setPreviousCourseName(prevCourseName);
    setModalVisible(true);
  };

  // 既存のセル（編集）がタップされたとき
  const handleSelectClass = (course: any) => {
    if (!course) return;
    const dayMapReverse: { [key: number]: string } = {
      0: '月', 1: '火', 2: '水', 3: '木', 4: '金', 5: '土', 6: '日'
    };
    setEditingDayString(dayMapReverse[course.day_of_week] || '月');
    setEditingDayOfWeek(course.day_of_week);
    setEditingPeriod(course.period);
    setEditingCourseId(course.id);
    setEditingCourseName(course.name);
    setPreviousCourseName(undefined);
    setModalVisible(true);
  };

  // 授業の保存（追加または更新）
  const handleSaveCourse = async (courseName: string) => {
    try {
      // 現在の学期を取得
      let termId = 1;
      const currentTerm: any = await db.getFirstAsync("SELECT id FROM terms WHERE is_current = 1");
      if (currentTerm) {
        termId = currentTerm.id;
      } else {
        const result = await db.runAsync(
          "INSERT INTO terms (name, start_date, end_date, is_current) VALUES (?, ?, ?, ?)",
          ["デフォルト学期", "2024-04-01", "2024-08-31", 1]
        );
        termId = result.lastInsertRowId;
      }

      if (editingCourseId) {
        // 更新
        await db.runAsync(
          "UPDATE classes SET name = ? WHERE id = ?",
          [courseName, editingCourseId]
        );
      } else {
        // 新規追加
        // 既に同じ曜日・時限に授業が存在しないかチェック
        const existing: any = await db.getFirstAsync(
          "SELECT id FROM classes WHERE term_id = ? AND day_of_week = ? AND period = ?",
          [termId, editingDayOfWeek, editingPeriod]
        );
        if (existing) {
          // 上書きするかどうか（通常はTimetable側のタップ判定でここには来ないが念のため）
          await db.runAsync(
            "UPDATE classes SET name = ? WHERE id = ?",
            [courseName, existing.id]
          );
        } else {
          await db.runAsync(
            "INSERT INTO classes (term_id, name, day_of_week, period) VALUES (?, ?, ?, ?)",
            [termId, courseName, editingDayOfWeek, editingPeriod]
          );
        }
      }

      setModalVisible(false);
      setRefreshKey(prev => prev + 1); // タイムテーブルを再取得させる
    } catch (error) {
      console.error(error);
      Alert.alert('エラー', '授業の保存に失敗しました');
    }
  };

  // 授業の削除
  const handleDeleteCourse = () => {
    if (!editingCourseId) return;
    
    Alert.alert('確認', 'この授業を削除しますか？紐づく課題にも影響が出る場合があります。', [
      { text: 'キャンセル', style: 'cancel' },
      { 
        text: '削除', 
        style: 'destructive',
        onPress: async () => {
          try {
            await db.runAsync("DELETE FROM classes WHERE id = ?", [editingCourseId]);
            setModalVisible(false);
            setRefreshKey(prev => prev + 1);
          } catch (e) {
            console.error(e);
            Alert.alert('エラー', '授業の削除に失敗しました');
          }
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ 
        headerTitle: '時間割の設定',
        headerBackTitle: '設定へ',
        headerTintColor: Colors.purple.primary,
        headerShown: false // カスタムヘッダーを使うため非表示
      }} />

      {/* 戻るボタンを含むヘッダー */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back-circle-outline" size={32} color={Colors.text.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
      </View>

      {/* 時間割本体 */}
      <View style={styles.content}>
        <Timetable 
          isEditMode={true} 
          refreshKey={refreshKey}
          onAddCourse={handleAddCourse}
          onSelectClass={handleSelectClass}
        />
      </View>

      {/* 編集用モーダル */}
      <CourseEditModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={handleSaveCourse}
        onDelete={handleDeleteCourse}
        initialCourseName={editingCourseName}
        previousCourseName={previousCourseName}
        dayString={editingDayString}
        period={editingPeriod}
      />
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
  content: {
    flex: 1,
  }
});
