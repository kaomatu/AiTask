import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import { Alert } from '@/utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Timetable from '@/components/Timetable';
import CourseEditModal from '@/components/CourseEditModal';
import { Colors } from '@/constants/colors';
import { useAuth } from '../../context/AuthContext';
import { saveSetting, getCurrentTerm, createDefaultTerm, saveClass, deleteClass } from '../../services/dbService';

export default function OnboardingStep3() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { setOnboardingCompleted } = useAuth();
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
      let termId = 1;
      const currentTerm: any = await getCurrentTerm();
      if (currentTerm) {
        termId = currentTerm.id;
      } else {
        const result = await createDefaultTerm();
        termId = result.id;
      }

      await saveClass({
        id: editingCourseId,
        term_id: termId,
        name: courseName,
        day_of_week: editingDayOfWeek,
        period: editingPeriod
      });

      // SQLite にも保存 (下位互換性のため)
      if (editingCourseId) {
        await db.runAsync(
          "UPDATE classes SET name = ? WHERE id = ?",
          [courseName, editingCourseId]
        );
      } else {
        const existing: any = await db.getFirstAsync(
          "SELECT id FROM classes WHERE term_id = ? AND day_of_week = ? AND period = ?",
          [termId, editingDayOfWeek, editingPeriod]
        );
        if (existing) {
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
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error(error);
      Alert.alert('エラー', '授業の保存に失敗しました');
    }
  };

  // 授業の削除
  const handleDeleteCourse = () => {
    if (!editingCourseId) return;
    
    Alert.alert('確認', 'この授業を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { 
        text: '削除', 
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteClass(editingCourseId);
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

  const handleFinish = async () => {
    try {
      await saveSetting('onboarding_completed', 'true');
      
      await db.runAsync(
        "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
        ['onboarding_completed', 'true', 'true']
      );

      setOnboardingCompleted(true);
      router.replace('/');
    } catch (e) {
      console.error(e);
      Alert.alert('エラー', 'オンボーディングの完了処理に失敗しました');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back-circle-outline" size={32} color={Colors.text.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>時間割の登録</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.content}>
        <Timetable 
          isEditMode={true} 
          refreshKey={refreshKey}
          onAddCourse={handleAddCourse}
          onSelectClass={handleSelectClass}
        />
      </View>

      {/* オンボーディング専用のアクション領域 */}
      <View style={styles.actionContainer}>
        <TouchableOpacity style={styles.finishButton} onPress={handleFinish}>
          <Text style={styles.finishButtonText}>これで完成。または後で入力する...</Text>
        </TouchableOpacity>
        <Text style={styles.noticeText}>※ 時間割は設定画面からいつでも変更、追加ができます！</Text>
      </View>

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
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: Colors.text.white,
    fontSize: 20,
    fontWeight: 'bold',
  },
  backButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
    paddingHorizontal: Platform.OS === 'web' ? 16 : 0,
  },
  actionContainer: {
    backgroundColor: Colors.background.white,
    padding: 16,
    paddingBottom: 32,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    alignItems: 'center',
  },
  finishButton: {
    backgroundColor: Colors.purple.primary,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  finishButtonText: {
    color: Colors.text.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  noticeText: {
    color: Colors.text.secondary,
    fontSize: 12,
    textAlign: 'center',
  }
});
