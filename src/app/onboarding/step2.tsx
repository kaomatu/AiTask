import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Alert } from '@/utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';

export default function OnboardingStep2() {
  const router = useRouter();
  const db = useSQLiteContext();
  const [timetableDays, setTimetableDays] = useState<number>(5);
  const [timetablePeriods, setTimetablePeriods] = useState<number>(5);

  useEffect(() => {
    // 既存の設定があれば読み込む
    const fetchSettings = async () => {
      try {
        const rows = await db.getAllAsync<{key: string, value: string}>("SELECT * FROM app_settings", []);
        for (const row of rows) {
          if (row.key === 'timetable_days') setTimetableDays(Number(row.value));
          if (row.key === 'timetable_periods') setTimetablePeriods(Number(row.value));
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchSettings();
  }, []);

  const handleUpdateDays = (delta: number) => {
    setTimetableDays(prev => Math.min(Math.max(prev + delta, 1), 7));
  };

  const handleUpdatePeriods = (delta: number) => {
    setTimetablePeriods(prev => Math.min(Math.max(prev + delta, 1), 10));
  };

  const saveSetting = async (key: string, value: string) => {
    await db.runAsync(
      "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
      [key, value, value]
    );
  };

  const handleNext = async () => {
    try {
      await saveSetting('timetable_days', String(timetableDays));
      await saveSetting('timetable_periods', String(timetablePeriods));
      router.push('/onboarding/step3');
    } catch (e) {
      console.error(e);
      Alert.alert('エラー', '保存に失敗しました');
    }
  };

  const getDaysString = (num: number) => {
    const days = ['月', '火', '水', '木', '金', '土', '日'];
    return days.slice(0, num).join(' ');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>時間割の枠を作成</Text>
        <Text style={styles.subtitle}>表示する曜日と時限数を設定してください。</Text>
        
        <View style={styles.settingCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingLabelContainer}>
              <Text style={styles.settingLabel}>表示する曜日</Text>
              <Text style={styles.settingSubLabel}>{getDaysString(timetableDays)}</Text>
            </View>
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepperButton} onPress={() => handleUpdateDays(-1)}>
                <Ionicons name="remove" size={20} color={Colors.text.primary} />
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{timetableDays}日</Text>
              <TouchableOpacity style={styles.stepperButton} onPress={() => handleUpdateDays(1)}>
                <Ionicons name="add" size={20} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLabelContainer}>
              <Text style={styles.settingLabel}>表示する時限数</Text>
            </View>
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepperButton} onPress={() => handleUpdatePeriods(-1)}>
                <Ionicons name="remove" size={20} color={Colors.text.primary} />
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{timetablePeriods}限</Text>
              <TouchableOpacity style={styles.stepperButton} onPress={() => handleUpdatePeriods(1)}>
                <Ionicons name="add" size={20} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={{ flex: 1 }} />

        <TouchableOpacity style={styles.button} onPress={handleNext}>
          <Text style={styles.buttonText}>次へ</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.white },
  content: { flex: 1, padding: 24, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: 'bold', color: Colors.purple.primary, marginBottom: 12 },
  subtitle: { fontSize: 16, color: Colors.text.secondary, marginBottom: 32 },
  settingCard: {
    backgroundColor: Colors.background.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background.light,
  },
  settingLabelContainer: { flex: 1 },
  settingLabel: { fontSize: 16, color: Colors.text.primary, fontWeight: '500' },
  settingSubLabel: { fontSize: 12, color: Colors.text.secondary, marginTop: 4 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.light,
    borderRadius: 8,
  },
  stepperButton: { padding: 12 },
  stepperValue: { fontSize: 16, fontWeight: 'bold', width: 40, textAlign: 'center' },
  button: { backgroundColor: Colors.purple.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
