import { Colors } from '@/constants/colors';
import { Alert } from '@/utils/alert';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { deleteUser, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import {
  createDefaultTerm,
  deleteAllUserData,
  deletePeriodTime,
  deleteTaskLocation,
  getClasses,
  getCurrentTerm,
  getPeriodTimes,
  getSettings,
  getTaskLocations,
  saveClass,
  savePeriodTime,
  saveSetting,
  saveTaskLocation
} from '../services/dbService';

interface TaskLocation {
  id: number;
  name: string;
  url: string | null;
  color: string | null;
}

const LOCATION_COLORS = ["#95A5A6", "#E74C3C", "#3498DB", "#2ECC71", "#F1C40F", "#9B59B6"];

const LOCATION_PRESETS = [
  { name: 'Slack', url: 'slack://', icon: 'logo-slack' as const, color: '#E74C3C' },
  { name: 'Zoom', url: 'zoomus://', icon: 'videocam-outline' as const, color: '#3498DB' },
  { name: 'Classroom', url: 'https://classroom.google.com', icon: 'logo-google' as const, color: '#2ECC71' },
  { name: 'Teams', url: 'msteams://', icon: 'people' as const, color: '#6264A7' },
];

// 開発者向けオプションを表示する許可されたメールアドレスのリスト
// ここにオーナーのメールアドレスを追加・変更してください（例: ['admin@example.com', 'your.email@gmail.com']）
const DEV_ALLOWED_EMAILS = ['admin@example.com', 'kaomatu403+aitask@gmail.com'];

export default function SettingsScreen() {
  const router = useRouter();
  const { openLocations } = useLocalSearchParams();
  const db = useSQLiteContext();
  const { signOut } = useAuth();

  const [timetableDays, setTimetableDays] = useState<number>(5);
  const [timetablePeriods, setTimetablePeriods] = useState<number>(5);
  const [locations, setLocations] = useState<TaskLocation[]>([]);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState(auth.currentUser?.email || '');
  const [periodTimes, setPeriodTimes] = useState<{ period: number; start_time: string; end_time: string }[]>([]);
  const [periodTimesInput, setPeriodTimesInput] = useState<{ period: number; start_time: string; end_time: string }[]>([]);
  const [isPeriodTimesExpanded, setIsPeriodTimesExpanded] = useState(false);

  // パスワード変更用ステート
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [isPasswordChangeExpanded, setIsPasswordChangeExpanded] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewPasswordConfirm, setShowNewPasswordConfirm] = useState(false);

  // 新規追加用
  const [newLocName, setNewLocName] = useState('');
  const [newLocUrl, setNewLocUrl] = useState('');
  const [newLocColor, setNewLocColor] = useState(LOCATION_COLORS[0]);

  // アコーディオン開閉状態
  const [isTimetableExpanded, setIsTimetableExpanded] = useState(false);
  const [isLocationsExpanded, setIsLocationsExpanded] = useState(openLocations === 'true');
  const [isDevOptionsExpanded, setIsDevOptionsExpanded] = useState(false);
  const [isProfileExpanded, setIsProfileExpanded] = useState(false);

  const getDefaultPeriodTime = (p: number, prevEndTime?: string): { start: string; end: string } => {
    const defaults: Record<number, { start: string; end: string }> = {
      1: { start: '09:00', end: '10:30' },
      2: { start: '10:40', end: '12:10' },
      3: { start: '13:00', end: '14:30' },
      4: { start: '14:40', end: '16:10' },
      5: { start: '16:20', end: '17:50' },
      6: { start: '18:00', end: '19:30' },
      7: { start: '19:40', end: '21:10' },
      8: { start: '21:20', end: '22:50' },
      9: { start: '23:00', end: '00:30' },
    };

    if (defaults[p]) return defaults[p];

    if (prevEndTime) {
      try {
        const [h, m] = prevEndTime.split(':').map(Number);
        const totalMinutes = h * 60 + m + 10;
        const startH = Math.floor(totalMinutes / 60) % 24;
        const startM = totalMinutes % 60;
        
        const endTotalMinutes = totalMinutes + 90;
        const endH = Math.floor(endTotalMinutes / 60) % 24;
        const endM = endTotalMinutes % 60;

        const pad = (n: number) => String(n).padStart(2, '0');
        return {
          start: `${pad(startH)}:${pad(startM)}`,
          end: `${pad(endH)}:${pad(endM)}`
        };
      } catch (e) {
        // ignore and fallback
      }
    }

    return { start: '09:00', end: '10:30' };
  };

  const initializePeriodInputs = (dbTimes: any[], periodsCount: number) => {
    const inputs = [];
    for (let p = 1; p <= periodsCount; p++) {
      const existing = dbTimes.find(t => t.period === p);
      if (existing) {
        inputs.push({
          period: p,
          start_time: existing.start_time || '',
          end_time: existing.end_time || ''
        });
      } else {
        inputs.push({
          period: p,
          start_time: '',
          end_time: ''
        });
      }
    }
    setPeriodTimesInput(inputs);
  };

  useFocusEffect(
    useCallback(() => {
      fetchSettings();
      fetchLocations();
    }, [])
  );

  const fetchSettings = async () => {
    if (!auth.currentUser) return;
    try {
      const settings = await getSettings();
      if (settings['timetable_days']) setTimetableDays(Number(settings['timetable_days']));
      if (settings['timetable_periods']) setTimetablePeriods(Number(settings['timetable_periods']));
      if (settings['user_name']) setUserName(settings['user_name']);
      if (auth.currentUser.email) setUserEmail(auth.currentUser.email);

      // 授業時間の取得
      const times = await getPeriodTimes();
      times.sort((a: any, b: any) => a.period - b.period);
      setPeriodTimes(times as any);

      const pCount = settings['timetable_periods'] ? Number(settings['timetable_periods']) : 5;
      initializePeriodInputs(times, pCount);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLocations = async () => {
    if (!auth.currentUser) return;
    try {
      const rows = await getTaskLocations();
      rows.sort((a, b) => a.id - b.id);
      setLocations(rows as any);
    } catch (e) {
      console.error(e);
    }
  };

  const saveSettingVal = async (key: string, value: string) => {
    try {
      await saveSetting(key, value);
      // SQLite にも保存 (下位互換性のため)
      await db.runAsync(
        "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
        [key, value, value]
      );
    } catch (e) {
      console.error(e);
      Alert.alert('エラー', '設定の保存に失敗しました');
    }
  };

  const handleUpdateDays = (delta: number) => {
    const newVal = Math.min(Math.max(timetableDays + delta, 1), 7); // 1〜7の範囲
    setTimetableDays(newVal);
  };

  const handleUpdatePeriods = (delta: number) => {
    const newVal = Math.min(Math.max(timetablePeriods + delta, 1), 10); // 1〜10の範囲
    setTimetablePeriods(newVal);
    initializePeriodInputs(periodTimes, newVal);
  };

  const handleTimeChange = (index: number, field: 'start_time' | 'end_time', value: string) => {
    const updated = [...periodTimesInput];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setPeriodTimesInput(updated);
  };

  const validateTimeFormat = (timeStr: string): boolean => {
    const regex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    return regex.test(timeStr);
  };

  const handleSaveTimetableSettings = async () => {
    // 授業時間のバリデーション
    for (const pt of periodTimesInput) {
      const hasStart = !!pt.start_time.trim();
      const hasEnd = !!pt.end_time.trim();

      if (hasStart !== hasEnd) {
        Alert.alert('入力エラー', `${pt.period}限の開始時刻と終了時刻は両方入力するか、両方空欄にしてください。`);
        return;
      }

      if (hasStart && hasEnd) {
        if (!validateTimeFormat(pt.start_time)) {
          Alert.alert('入力エラー', `${pt.period}限の開始時刻が正しくありません。"09:00" のように入力してください。`);
          return;
        }
        if (!validateTimeFormat(pt.end_time)) {
          Alert.alert('入力エラー', `${pt.period}限の終了時刻が正しくありません。"10:30" のように入力してください。`);
          return;
        }

        // 開始時刻が終了時刻より前かチェック
        const [startH, startM] = pt.start_time.split(':').map(Number);
        const [endH, endM] = pt.end_time.split(':').map(Number);
        const startInMinutes = startH * 60 + startM;
        const endInMinutes = endH * 60 + endM;

        if (startInMinutes >= endInMinutes) {
          Alert.alert('入力エラー', `${pt.period}限の開始時刻は、終了時刻より前の時間に設定してください。`);
          return;
        }
      }
    }

    try {
      await saveSettingVal('timetable_days', String(timetableDays));
      await saveSettingVal('timetable_periods', String(timetablePeriods));

      // 授業時間の保存と削除
      for (const pt of periodTimesInput) {
        const hasStart = !!pt.start_time.trim();
        const hasEnd = !!pt.end_time.trim();

        if (hasStart && hasEnd) {
          await savePeriodTime(pt.period, pt.start_time.trim(), pt.end_time.trim());
        } else {
          await deletePeriodTime(pt.period);
        }
      }

      // 再度取得してステートを最新化
      const times = await getPeriodTimes();
      times.sort((a: any, b: any) => a.period - b.period);
      setPeriodTimes(times as any);
      initializePeriodInputs(times, timetablePeriods);

      Alert.alert('完了', '時間割の表示設定と授業時間を保存しました');
    } catch (e) {
      console.error(e);
      Alert.alert('エラー', '設定の保存に失敗しました');
    }
  };

  const handleAddLocation = async () => {
    if (!newLocName.trim()) {
      Alert.alert('エラー', '場所の名前を入力してください');
      return;
    }
    try {
      const locId = Date.now();
      await saveTaskLocation({
        id: locId,
        name: newLocName.trim(),
        url: newLocUrl.trim() || null,
        color: newLocColor
      });

      // SQLite (下位互換 - ベストエフォート)
      try {
        await db.runAsync(
          "INSERT INTO task_locations (id, name, url, color) VALUES (?, ?, ?, ?)",
          [locId, newLocName.trim(), newLocUrl.trim() || null, newLocColor]
        );
      } catch (sqliteErr) {
        console.warn("⚠️ SQLite場所追加スキップ:", sqliteErr);
      }

      setNewLocName('');
      setNewLocUrl('');
      setNewLocColor(LOCATION_COLORS[0]);
      fetchLocations();
    } catch (e: any) {
      console.error(e);
      Alert.alert('エラー', '場所の追加に失敗しました');
    }
  };

  const handleDeleteLocation = (id: number) => {
    Alert.alert('確認', 'この場所を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { 
        text: '削除', 
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTaskLocation(id);
            try {
              await db.runAsync("DELETE FROM task_locations WHERE id = ?", [id]);
            } catch (sqliteErr) {
              console.warn("⚠️ SQLite場所削除スキップ:", sqliteErr);
            }
            fetchLocations();
          } catch (e) {
            console.error(e);
            Alert.alert('エラー', '削除に失敗しました');
          }
        }
      }
    ]);
  };

  const handleSaveUserName = async () => {
    if (!userName.trim()) {
      Alert.alert('エラー', '名前を入力してください');
      return;
    }
    try {
      await saveSettingVal('user_name', userName.trim());
      Alert.alert('完了', 'ユーザー名を更新しました');
    } catch (error) {
      console.error(error);
      Alert.alert('エラー', 'ユーザー名の更新に失敗しました');
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !newPasswordConfirm) {
      Alert.alert('エラー', 'すべての項目を入力してください');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('エラー', '新しいパスワードは6文字以上で入力してください');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      Alert.alert('エラー', '新しいパスワードが一致しません');
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user || !user.email) {
        Alert.alert('エラー', 'ユーザー情報を取得できませんでした');
        return;
      }

      // 1. 現在のパスワードで再認証
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // 2. パスワードの更新
      await updatePassword(user, newPassword);

      Alert.alert('完了', 'パスワードを更新しました');
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
      setIsPasswordChangeExpanded(false);
    } catch (e: any) {
      console.error(e);
      let errMsg = 'パスワードの更新に失敗しました。';
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        errMsg = '現在のパスワードが正しくありません。';
      } else if (e.code === 'auth/weak-password') {
        errMsg = '新しいパスワードが弱すぎます。';
      } else if (e.code === 'auth/requires-recent-login') {
        errMsg = 'セキュリティ保護のため、一度ログインし直してから再度お試しください。';
      } else {
        errMsg += '\n' + (e.message || '');
      }
      Alert.alert('エラー', errMsg);
    }
  };

  const handleSignOut = async () => {
    Alert.alert('確認', 'ログアウトしますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: 'ログアウト',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            router.replace('/onboarding');
          } catch (e) {
            console.error(e);
            Alert.alert('エラー', 'ログアウトに失敗しました');
          }
        }
      }
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      '⚠️ アカウント削除',
      'アカウントとすべてのデータ（時間割・タスク・設定など）が完全に削除されます。この操作は取り消せません。\n\n続行するには、パスワードを入力してください。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: () => {
            // Web環境ではpromptを使用、Native環境では別途モーダルが必要
            if (Platform.OS === 'web') {
              const pw = window.prompt('確認のため、パスワードを入力してください:');
              if (pw) performDeleteAccount(pw);
            } else {
              // Native環境用: Alert.promptはiOSのみ対応
              Alert.alert('パスワード確認', '確認のため、パスワードを入力してください。\n（この機能はWeb版で利用可能です）');
            }
          }
        }
      ]
    );
  };

  const performDeleteAccount = async (password: string) => {
    try {
      const user = auth.currentUser;
      if (!user || !user.email) {
        Alert.alert('エラー', 'ユーザー情報を取得できませんでした');
        return;
      }

      // 1. 再認証
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);

      // 2. Firestoreの全ユーザーデータを削除
      await deleteAllUserData(user.uid);

      // 3. Firebase Authアカウントを削除
      await deleteUser(user);

      // 4. ローカルSQLiteをクリア
      await db.execAsync(`
        DELETE FROM task_reminders;
        DELETE FROM tasks;
        DELETE FROM task_locations;
        DELETE FROM classes;
        DELETE FROM terms;
        DELETE FROM app_settings;
        DELETE FROM sqlite_sequence WHERE name IN ('task_locations', 'classes', 'tasks', 'terms');
      `);

      // 5. オンボーディング画面へ
      Alert.alert('完了', 'アカウントが削除されました。', [
        { text: 'OK', onPress: () => router.replace('/onboarding') }
      ]);
    } catch (e: any) {
      console.error(e);
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        Alert.alert('エラー', 'パスワードが正しくありません。');
      } else {
        Alert.alert('エラー', 'アカウントの削除に失敗しました: ' + (e.message || ''));
      }
    }
  };

  // 開発用：テストデータ投入関数
  const handleSeedData = async () => {
    try {
      let termId = 1;
      let termObj: any = await getCurrentTerm();
      if (termObj) {
        termId = termObj.id;
      } else {
        termObj = await createDefaultTerm();
        termId = termObj.id;
      }

      // SQLite側に学期（term）が存在することを確認（下位互換 - ベストエフォート）
      try {
        const sqliteTerm = await db.getFirstAsync("SELECT id FROM terms WHERE id = ?", [termId]);
        if (!sqliteTerm) {
          await db.runAsync(
            "INSERT OR IGNORE INTO terms (id, name, start_date, end_date, is_current) VALUES (?, ?, ?, ?, ?)",
            [
              termId,
              termObj.name || 'デフォルト学期',
              termObj.start_date || '2024-04-01',
              termObj.end_date || '2024-08-31',
              termObj.is_current !== undefined ? termObj.is_current : 1
            ]
          );
        }
      } catch (sqliteErr) {
        console.warn("⚠️ SQLite学期データスキップ:", sqliteErr);
      }

      const seedCourses = [
        { name: 'コンピュータリテラシ', day_of_week: 0, period: 1 },
        { name: 'キャリアデザイン', day_of_week: 0, period: 2 },
        { name: '情報社会及び情報倫理', day_of_week: 0, period: 3 },
        { name: 'CEC', day_of_week: 1, period: 2 },
        { name: '線形代数１', day_of_week: 1, period: 3 },
        { name: 'CEA', day_of_week: 1, period: 4 },
        { name: 'コンピュータ概論', day_of_week: 2, period: 1 },
        { name: '情報数学１', day_of_week: 2, period: 2 },
        { name: 'プログラミング及び演習１', day_of_week: 3, period: 1 },
        { name: 'データサイエンス基礎数理', day_of_week: 3, period: 3 },
        { name: '日本国憲法', day_of_week: 4, period: 1 },
        { name: '論理回路', day_of_week: 4, period: 2 },
        { name: '中国語A', day_of_week: 4, period: 3 },
        { name: '健康・スポーツ化学実習１', day_of_week: 4, period: 4 },
      ];

      for (const course of seedCourses) {
        const classes = await getClasses(termId);
        const existing = classes.find((c: any) => c.day_of_week === course.day_of_week && c.period === course.period);
        if (!existing) {
          await saveClass({
            term_id: termId,
            name: course.name,
            day_of_week: course.day_of_week,
            period: course.period
          });

          // SQLite (下位互換 - ベストエフォート)
          try {
            await db.runAsync(
              "INSERT INTO classes (term_id, name, day_of_week, period) VALUES (?, ?, ?, ?)",
              [termId, course.name, course.day_of_week, course.period]
            );
          } catch (sqliteErr) {
            console.warn("⚠️ SQLiteテストデータスキップ:", sqliteErr);
          }
        }
      }
      Alert.alert("完了", "テストデータを投入しました！");
    } catch (error) {
      console.error(error);
      Alert.alert("エラー", "データの投入に失敗しました。");
    }
  };

  // 開発用：DB初期化（リセット）関数
  const handleResetDb = async () => {
    Alert.alert('警告', 'すべてのデータを削除し、初期設定を含めたアプリを完全な初期状態に戻しますか？この操作は取り消せません。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '初期化する',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            await db.execAsync(`
              DELETE FROM task_reminders;
              DELETE FROM tasks;
              DELETE FROM task_locations;
              DELETE FROM classes;
              DELETE FROM terms;
              DELETE FROM app_settings;
              DELETE FROM sqlite_sequence WHERE name IN ('task_locations', 'classes', 'tasks', 'terms');
            `);
            Alert.alert(
              "完了", 
              "すべてのデータを初期化し、ログアウトしました。",
              [{ text: "OK", onPress: () => router.replace('/') }]
            );
          } catch (error) {
            console.error(error);
            Alert.alert("エラー", "初期化に失敗しました。");
          }
        }
      }
    ]);
  };

  // 曜日表示用ヘルパー
  const getDaysString = (num: number) => {
    const days = ['月', '火', '水', '木', '金', '土', '日'];
    return days.slice(0, num).join(' ');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ 
        headerTitle: '設定',
        headerBackTitle: '戻る',
        headerTintColor: Colors.purple.primary,
        headerStyle: { backgroundColor: Colors.background.light },
        headerShadowVisible: false,
      }} />
      
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.push('/')}>
          <Ionicons name="home-outline" size={28} color={Colors.purple.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitleText}>設定</Text>
      </View>
      
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 20}
      >
        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        
        {/* プロフィール設定 */}
        <Text style={styles.sectionTitle}>プロフィール</Text>
        <View style={styles.card}>
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>ユーザー名</Text>
            <View style={styles.inputWithButton}>
              <TextInput
                style={[styles.textInput, { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRightWidth: 0 }]}
                value={userName}
                onChangeText={setUserName}
                placeholder="名前を入力"
              />
              <TouchableOpacity style={styles.inlineSaveButton} onPress={handleSaveUserName}>
                <Text style={styles.inlineSaveButtonText}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.divider} />

          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>メールアドレス</Text>
            <TextInput
              style={[styles.textInput, styles.textInputDisabled]}
              value={userEmail}
              editable={false}
            />
          </View>

          <View style={styles.divider} />

          <TouchableOpacity 
            style={styles.actionRow} 
            onPress={() => setIsPasswordChangeExpanded(!isPasswordChangeExpanded)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.iconContainer, { backgroundColor: '#F0F0F0' }]}>
                <Ionicons name="lock-closed-outline" size={18} color={Colors.text.primary} />
              </View>
              <Text style={styles.actionRowText}>パスワードを変更する</Text>
            </View>
            <Ionicons name={isPasswordChangeExpanded ? "chevron-up" : "chevron-down"} size={20} color={Colors.text.secondary} />
          </TouchableOpacity>

          {isPasswordChangeExpanded && (
            <View style={styles.subSection}>
              <View style={styles.passwordInputContainer}>
                <Text style={styles.subLabel}>現在のパスワード</Text>
                <View style={styles.passwordInputWrapper}>
                  <TextInput
                    style={styles.passwordInput}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="現在のパスワード"
                    secureTextEntry={!showCurrentPassword}
                  />
                  <TouchableOpacity style={styles.eyeButton} onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
                    <Ionicons name={showCurrentPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.text.secondary} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.passwordInputContainer}>
                <Text style={styles.subLabel}>新しいパスワード</Text>
                <View style={styles.passwordInputWrapper}>
                  <TextInput
                    style={styles.passwordInput}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="6文字以上"
                    secureTextEntry={!showNewPassword}
                  />
                  <TouchableOpacity style={styles.eyeButton} onPress={() => setShowNewPassword(!showNewPassword)}>
                    <Ionicons name={showNewPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.text.secondary} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.passwordInputContainer}>
                <Text style={styles.subLabel}>新しいパスワード (確認)</Text>
                <View style={styles.passwordInputWrapper}>
                  <TextInput
                    style={styles.passwordInput}
                    value={newPasswordConfirm}
                    onChangeText={setNewPasswordConfirm}
                    placeholder="もう一度入力"
                    secureTextEntry={!showNewPasswordConfirm}
                  />
                  <TouchableOpacity style={styles.eyeButton} onPress={() => setShowNewPasswordConfirm(!showNewPasswordConfirm)}>
                    <Ionicons name={showNewPasswordConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.text.secondary} />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={styles.primaryButtonSmall} onPress={handleChangePassword}>
                <Text style={styles.primaryButtonTextSmall}>パスワードを更新</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 時間割設定 */}
        <Text style={styles.sectionTitle}>時間割設定</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>表示する曜日</Text>
              <Text style={styles.settingSubLabel}>{getDaysString(timetableDays)}</Text>
            </View>
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepperButton} onPress={() => handleUpdateDays(-1)}>
                <Ionicons name="remove" size={20} color={Colors.purple.primary} />
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{timetableDays}日</Text>
              <TouchableOpacity style={styles.stepperButton} onPress={() => handleUpdateDays(1)}>
                <Ionicons name="add" size={20} color={Colors.purple.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>表示する時限数</Text>
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepperButton} onPress={() => handleUpdatePeriods(-1)}>
                <Ionicons name="remove" size={20} color={Colors.purple.primary} />
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{timetablePeriods}限</Text>
              <TouchableOpacity style={styles.stepperButton} onPress={() => handleUpdatePeriods(1)}>
                <Ionicons name="add" size={20} color={Colors.purple.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.divider} />

          <TouchableOpacity 
            style={styles.actionRow} 
            onPress={() => setIsPeriodTimesExpanded(!isPeriodTimesExpanded)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.iconContainer, { backgroundColor: '#E8F4FD' }]}>
                <Ionicons name="time-outline" size={18} color="#3498DB" />
              </View>
              <Text style={styles.actionRowText}>各時限の授業時間を個別に設定</Text>
            </View>
            <Ionicons name={isPeriodTimesExpanded ? "chevron-up" : "chevron-down"} size={20} color={Colors.text.secondary} />
          </TouchableOpacity>

          {isPeriodTimesExpanded && (
            <View style={styles.subSection}>
              <View style={styles.periodTimesContainer}>
                {periodTimesInput.map((pt, index) => (
                  <View key={pt.period} style={styles.periodTimeRow}>
                    <View style={styles.periodBadge}>
                      <Text style={styles.periodBadgeText}>{pt.period}</Text>
                    </View>
                    <TextInput
                      style={styles.timeInput}
                      value={pt.start_time}
                      onChangeText={(text) => handleTimeChange(index, 'start_time', text)}
                      maxLength={5}
                      keyboardType="numbers-and-punctuation"
                      autoCapitalize="none"
                      autoComplete="off"
                      autoCorrect={false}
                    />
                    <Text style={styles.timeSeparator}>〜</Text>
                    <TextInput
                      style={styles.timeInput}
                      value={pt.end_time}
                      onChangeText={(text) => handleTimeChange(index, 'end_time', text)}
                      maxLength={5}
                      keyboardType="numbers-and-punctuation"
                      autoCapitalize="none"
                      autoComplete="off"
                      autoCorrect={false}
                    />
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.divider} />

          <TouchableOpacity style={styles.primaryButton} onPress={handleSaveTimetableSettings}>
            <Text style={styles.primaryButtonText}>時間割の表示設定を保存</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.outlineButton} onPress={() => router.push('/timetable-edit')}>
          <Ionicons name="create-outline" size={20} color={Colors.purple.primary} style={{ marginRight: 6 }} />
          <Text style={styles.outlineButtonText}>時間割（授業）を登録・編集する</Text>
        </TouchableOpacity>

        {/* タスク提出場所 */}
        <Text style={styles.sectionTitle}>タスク提出場所</Text>
        <Text style={styles.sectionDescription}>課題を提出するサイトやアプリのURLを登録できます。</Text>
        <View style={styles.card}>
          {locations.map((loc, index) => (
            <View key={loc.id}>
              <View style={styles.locationItem}>
                <View style={[styles.colorBadge, { backgroundColor: loc.color || '#95A5A6' }]} />
                <View style={styles.locationInfo}>
                  <Text style={styles.locationName}>{loc.name}</Text>
                  {loc.url ? <Text style={styles.locationUrl} numberOfLines={1}>{loc.url}</Text> : null}
                </View>
                <TouchableOpacity style={styles.deleteIconButton} onPress={() => handleDeleteLocation(loc.id)}>
                  <Ionicons name="trash-outline" size={20} color="#E74C3C" />
                </TouchableOpacity>
              </View>
              {index < locations.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
          {locations.length > 0 && <View style={styles.divider} />}
          
          {/* 新規追加フォーム */}
          <View style={styles.addLocationSection}>
            <Text style={styles.subLabelBold}>新しい場所を追加</Text>
            
            <View style={styles.presetsContainer}>
              {LOCATION_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.name}
                  style={[styles.presetButton, { borderColor: preset.color, backgroundColor: `${preset.color}10` }]}
                  onPress={() => {
                    setNewLocName(preset.name);
                    setNewLocUrl(preset.url);
                    setNewLocColor(preset.color);
                  }}
                >
                  <Ionicons name={preset.icon} size={14} color={preset.color} style={{ marginRight: 4 }} />
                  <Text style={[styles.presetButtonText, { color: preset.color }]}>{preset.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.textInput}
              placeholder="場所の名前 (必須) 例: Moodle"
              value={newLocName}
              onChangeText={setNewLocName}
              autoComplete="off"
              autoCorrect={false}
            />
            <TextInput
              style={[styles.textInput, { marginTop: 8 }]}
              placeholder="URL (任意) 例: https://..."
              value={newLocUrl}
              onChangeText={setNewLocUrl}
              autoCapitalize="none"
              keyboardType="default"
              autoComplete="off"
              autoCorrect={false}
            />
            
            <View style={styles.colorPalette}>
              {LOCATION_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: color },
                    newLocColor === color && styles.colorCircleSelected
                  ]}
                  onPress={() => setNewLocColor(color)}
                >
                  {newLocColor === color && <Ionicons name="checkmark" size={16} color="#fff" />}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.secondaryButton} onPress={handleAddLocation}>
              <Ionicons name="add" size={20} color={Colors.purple.primary} style={{ marginRight: 4 }} />
              <Text style={styles.secondaryButtonText}>追加する</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* アカウント操作 */}
        <Text style={styles.sectionTitle}>アカウント操作</Text>
        <View style={styles.cardTransparent}>
          <TouchableOpacity style={styles.destructiveButton} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={20} color="#E74C3C" style={{ marginRight: 8 }} />
            <Text style={styles.destructiveButtonText}>ログアウト</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dangerOutlineButton} onPress={handleDeleteAccount}>
            <Ionicons name="warning-outline" size={20} color="#E74C3C" style={{ marginRight: 8 }} />
            <Text style={styles.dangerOutlineButtonText}>アカウントを削除</Text>
          </TouchableOpacity>
        </View>

        {/* 開発者向けオプション */}
        {DEV_ALLOWED_EMAILS.includes(userEmail) && (
          <View style={{ marginTop: 24 }}>
            <Text style={styles.sectionTitle}>開発者向けオプション</Text>
            <View style={styles.card}>
              <Text style={styles.sectionDescription}>
                テスト用のダミーデータを投入したり、すべてのデータを削除して初期状態に戻すことができます。
              </Text>
              <TouchableOpacity style={styles.devButtonInfo} onPress={handleSeedData}>
                <Ionicons name="download-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.devButtonText}>テストデータを投入</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.devButtonDanger} onPress={handleResetDb}>
                <Ionicons name="warning-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.devButtonText}>すべてのデータをリセット</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.light,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.background.light,
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTitleText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.purple.primary,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 60,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    marginLeft: 8,
    marginBottom: 8,
    marginTop: 24,
    letterSpacing: 0.5,
  },
  sectionDescription: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginLeft: 8,
    marginBottom: 8,
    lineHeight: 18,
  },
  card: {
    backgroundColor: Colors.background.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTransparent: {
    borderRadius: 16,
    gap: 12,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.background.light,
    marginVertical: 16,
  },
  inputRow: {
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: 6,
  },
  subLabelBold: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: Colors.background.light,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text.primary,
  },
  textInputDisabled: {
    backgroundColor: '#F8F9FA',
    color: '#888',
  },
  inputWithButton: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  inlineSaveButton: {
    backgroundColor: Colors.purple.primary,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  inlineSaveButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  actionRowText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text.primary,
    marginLeft: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subSection: {
    marginTop: 16,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  passwordInputContainer: {
    marginBottom: 12,
  },
  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.white,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRadius: 8,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text.primary,
  },
  eyeButton: {
    padding: 10,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  settingSubLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 4,
  },
  stepperButton: {
    padding: 8,
  },
  stepperValue: {
    fontSize: 15,
    fontWeight: '600',
    width: 32,
    textAlign: 'center',
    color: Colors.text.primary,
  },
  periodTimesContainer: {
    marginTop: 8,
  },
  periodTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
  },
  periodBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.purple.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  periodBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  timeInput: {
    backgroundColor: Colors.background.white,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    textAlign: 'center',
    width: 80,
    color: Colors.text.primary,
  },
  timeSeparator: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginHorizontal: 12,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorBadge: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  locationUrl: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  deleteIconButton: {
    padding: 8,
  },
  addLocationSection: {
    marginTop: 4,
  },
  presetsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  presetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  presetButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  colorPalette: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 16,
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorCircleSelected: {
    borderWidth: 2,
    borderColor: Colors.text.primary,
  },
  primaryButton: {
    backgroundColor: Colors.purple.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  primaryButtonSmall: {
    backgroundColor: Colors.purple.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonTextSmall: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  secondaryButton: {
    backgroundColor: '#F0E6FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  secondaryButtonText: {
    color: Colors.purple.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.purple.primary,
    backgroundColor: '#fff',
    marginTop: 16,
  },
  outlineButtonText: {
    color: Colors.purple.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  destructiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#FFF0F0',
  },
  destructiveButtonText: {
    color: '#E74C3C',
    fontSize: 15,
    fontWeight: '600',
  },
  dangerOutlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFD6D6',
    backgroundColor: '#fff',
  },
  dangerOutlineButtonText: {
    color: '#E74C3C',
    fontSize: 15,
    fontWeight: '600',
  },
  devButtonInfo: {
    backgroundColor: '#3498DB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  devButtonDanger: {
    backgroundColor: '#E74C3C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  devButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
