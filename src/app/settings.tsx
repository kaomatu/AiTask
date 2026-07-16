import { Colors } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Alert } from '@/utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { auth } from '../config/firebase';
import { deleteUser, reauthenticateWithCredential, EmailAuthProvider, updatePassword } from 'firebase/auth';
import { 
  getSettings, 
  getTaskLocations, 
  saveSetting, 
  saveTaskLocation, 
  deleteTaskLocation, 
  getCurrentTerm, 
  createDefaultTerm, 
  getClasses, 
  saveClass,
  deleteAllUserData 
} from '../services/dbService';

interface TaskLocation {
  id: number;
  name: string;
  url: string | null;
  color: string | null;
}

const LOCATION_COLORS = ["#95A5A6", "#E74C3C", "#3498DB", "#2ECC71", "#F1C40F", "#9B59B6"];

const LOCATION_PRESETS = [
  { name: 'Teams', url: 'msteams://', icon: 'chatbubbles-outline' as const, color: '#9B59B6' },
  { name: 'Slack', url: 'slack://', icon: 'logo-slack' as const, color: '#E74C3C' },
  { name: 'Zoom', url: 'zoomus://', icon: 'videocam-outline' as const, color: '#3498DB' },
  { name: 'Classroom', url: 'https://classroom.google.com', icon: 'logo-google' as const, color: '#2ECC71' },
];

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
  };

  const handleSaveTimetableSettings = async () => {
    await saveSettingVal('timetable_days', String(timetableDays));
    await saveSettingVal('timetable_periods', String(timetablePeriods));
    Alert.alert('完了', '時間割の表示設定を保存しました');
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
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ 
        headerTitle: '設定',
        headerBackTitle: '戻る',
        headerTintColor: Colors.purple.primary,
      }} />
      
      {/* ホームに戻るボタン */}
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
        
        {/* プロフィール設定セクション */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.sectionHeader} onPress={() => setIsProfileExpanded(!isProfileExpanded)}>
            <Text style={styles.sectionTitle}>プロフィール設定</Text>
            <Ionicons name={isProfileExpanded ? "chevron-up" : "chevron-down"} size={20} color={Colors.text.primary} />
          </TouchableOpacity>
          
          {isProfileExpanded && (
            <View style={styles.sectionContent}>
              <View style={styles.settingRowVertical}>
                <Text style={styles.settingLabel}>ユーザー名</Text>
                <TextInput
                  style={styles.textInput}
                  value={userName}
                  onChangeText={setUserName}
                  placeholder="名前を入力"
                />
              </View>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveUserName}>
                <Text style={styles.saveButtonText}>名前を保存</Text>
              </TouchableOpacity>

              <View style={[styles.settingRowVertical, { marginTop: 16 }]}>
                <Text style={styles.settingLabel}>メールアドレス (変更不可)</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: '#F5F5F5', color: '#888' }]}
                  value={userEmail}
                  editable={false}
                />
              </View>

              <TouchableOpacity 
                style={[styles.saveButton, { marginTop: 16 }]} 
                onPress={() => setIsPasswordChangeExpanded(!isPasswordChangeExpanded)}
              >
                <Text style={styles.saveButtonText}>
                  {isPasswordChangeExpanded ? 'パスワード変更を閉じる' : 'パスワードを変更する'}
                </Text>
              </TouchableOpacity>

              {isPasswordChangeExpanded && (
                <View style={{ marginTop: 12, padding: 12, backgroundColor: '#FAFAFA', borderRadius: 8, borderWidth: 1, borderColor: '#EEE' }}>
                  <View style={styles.settingRowVertical}>
                    <Text style={[styles.settingLabel, { fontSize: 13 }]}>現在のパスワード</Text>
                    <View style={styles.passwordContainer}>
                      <TextInput
                        style={styles.passwordInput}
                        value={currentPassword}
                        onChangeText={setCurrentPassword}
                        placeholder="現在のパスワード"
                        secureTextEntry={!showCurrentPassword}
                      />
                      <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                      >
                        <Ionicons
                          name={showCurrentPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={22}
                          color={Colors.text.secondary}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={[styles.settingRowVertical, { marginTop: 8 }]}>
                    <Text style={[styles.settingLabel, { fontSize: 13 }]}>新しいパスワード</Text>
                    <View style={styles.passwordContainer}>
                      <TextInput
                        style={styles.passwordInput}
                        value={newPassword}
                        onChangeText={setNewPassword}
                        placeholder="6文字以上"
                        secureTextEntry={!showNewPassword}
                      />
                      <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={() => setShowNewPassword(!showNewPassword)}
                      >
                        <Ionicons
                          name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={22}
                          color={Colors.text.secondary}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={[styles.settingRowVertical, { marginTop: 8 }]}>
                    <Text style={[styles.settingLabel, { fontSize: 13 }]}>新しいパスワード (確認)</Text>
                    <View style={styles.passwordContainer}>
                      <TextInput
                        style={styles.passwordInput}
                        value={newPasswordConfirm}
                        onChangeText={setNewPasswordConfirm}
                        placeholder="もう一度入力"
                        secureTextEntry={!showNewPasswordConfirm}
                      />
                      <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={() => setShowNewPasswordConfirm(!showNewPasswordConfirm)}
                      >
                        <Ionicons
                          name={showNewPasswordConfirm ? 'eye-off-outline' : 'eye-outline'}
                          size={22}
                          color={Colors.text.secondary}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TouchableOpacity style={[styles.saveButton, { marginTop: 12 }]} onPress={handleChangePassword}>
                    <Text style={styles.saveButtonText}>パスワードを更新</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity style={[styles.saveButton, { backgroundColor: '#E74C3C', marginTop: 24 }]} onPress={handleSignOut}>
                <Text style={styles.saveButtonText}>ログアウト</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveButton, { backgroundColor: 'transparent', marginTop: 12, borderWidth: 1, borderColor: '#E74C3C' }]} onPress={handleDeleteAccount}>
                <Text style={[styles.saveButtonText, { color: '#E74C3C' }]}>アカウントを削除</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 時間割設定セクション */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.sectionHeader} onPress={() => setIsTimetableExpanded(!isTimetableExpanded)}>
            <Text style={styles.sectionTitle}>時間割の表示設定</Text>
            <Ionicons name={isTimetableExpanded ? "chevron-up" : "chevron-down"} size={20} color={Colors.text.primary} />
          </TouchableOpacity>
          
          {isTimetableExpanded && (
            <View style={styles.sectionContent}>
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
              
              <TouchableOpacity style={styles.editTimetableButton} onPress={() => router.push('/timetable-edit')}>
                <Ionicons name="create-outline" size={20} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.editTimetableButtonText}>時間割（授業）を登録・編集する</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.saveButton} onPress={handleSaveTimetableSettings}>
                <Text style={styles.saveButtonText}>表示設定を保存</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* タスク提出場所セクション */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.sectionHeader} onPress={() => setIsLocationsExpanded(!isLocationsExpanded)}>
            <Text style={styles.sectionTitle}>タスク提出・実施場所の管理</Text>
            <Ionicons name={isLocationsExpanded ? "chevron-up" : "chevron-down"} size={20} color={Colors.text.primary} />
          </TouchableOpacity>
          
          {isLocationsExpanded && (
            <View style={styles.sectionContent}>
              <Text style={styles.sectionDescription}>
                課題を提出するサイト（Moodleなど）や場所を追加できます。URLを登録しておくと、タスク詳細画面から直接アクセスできるようになります。
              </Text>

              {/* 既存の場所リスト */}
              <View style={styles.locationsList}>
                {locations.map((loc) => (
                  <View key={loc.id} style={styles.locationItem}>
                    <View style={[styles.colorBadge, { backgroundColor: loc.color || '#95A5A6' }]} />
                    <View style={styles.locationInfo}>
                      <Text style={styles.locationName}>{loc.name}</Text>
                      {loc.url ? (
                        <Text style={styles.locationUrl} numberOfLines={1}>{loc.url}</Text>
                      ) : null}
                    </View>
                    <TouchableOpacity 
                      style={styles.deleteButton}
                      onPress={() => handleDeleteLocation(loc.id)}
                    >
                      <Ionicons name="trash-outline" size={20} color="#E74C3C" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {/* 新規追加フォーム */}
              <View style={styles.addLocationForm}>
                <Text style={styles.formLabel}>新しい場所を追加</Text>
                
                <Text style={styles.presetLabel}>テンプレートから自動入力：</Text>
                <View style={styles.presetsContainer}>
                  {LOCATION_PRESETS.map((preset) => (
                    <TouchableOpacity
                      key={preset.name}
                      style={[styles.presetButton, { borderColor: preset.color }]}
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
                  style={styles.input}
                  placeholder="場所の名前 (必須) 例: Moodle"
                  value={newLocName}
                  onChangeText={setNewLocName}
                  autoComplete="off"
                  importantForAutofill="noExcludeDescendants"
                  textContentType="none"
                  autoCorrect={false}
                />
                <TextInput
                  style={styles.input}
                  placeholder="URL (任意) 例: msteams:// または https://..."
                  value={newLocUrl}
                  onChangeText={setNewLocUrl}
                  autoCapitalize="none"
                  keyboardType="default"
                  autoComplete="off"
                  importantForAutofill="noExcludeDescendants"
                  textContentType="none"
                  autoCorrect={false}
                />
                
                <Text style={styles.formLabel}>色を選択</Text>
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
                      {newLocColor === color && (
                        <Ionicons name="checkmark" size={16} color="#fff" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity style={styles.addButton} onPress={handleAddLocation}>
                  <Ionicons name="add-circle-outline" size={20} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.addButtonText}>追加する</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* 開発用オプションセクション */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.sectionHeader} onPress={() => setIsDevOptionsExpanded(!isDevOptionsExpanded)}>
            <Text style={styles.sectionTitle}>※開発者向けオプション</Text>
            <Ionicons name={isDevOptionsExpanded ? "chevron-up" : "chevron-down"} size={20} color={Colors.text.primary} />
          </TouchableOpacity>
          
          {isDevOptionsExpanded && (
            <View style={styles.sectionContent}>
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
          )}
        </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.white,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  saveButton: {
    backgroundColor: Colors.purple.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  editTimetableButton: {
    backgroundColor: Colors.purple.primary,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 4,
  },
  editTimetableButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTitleText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.purple.primary,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    flexGrow: 1,
  },
  section: {
    backgroundColor: Colors.background.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  sectionContent: {
    marginTop: 4,
    paddingBottom: 16,
  },
  sectionDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background.light,
  },
  settingRowVertical: {
    marginBottom: 16,
  },
  settingLabelContainer: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  settingSubLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  textInput: {
    backgroundColor: Colors.background.white,
    borderWidth: 1,
    borderColor: Colors.background.light,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: Colors.text.primary,
    marginTop: 8,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.light,
    borderRadius: 8,
  },
  stepperButton: {
    padding: 8,
  },
  stepperValue: {
    fontSize: 16,
    fontWeight: 'bold',
    width: 36,
    textAlign: 'center',
  },
  locationsList: {
    marginBottom: 16,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background.light,
  },
  colorBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  locationInfo: {
    flex: 1,
    marginRight: 12,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  locationUrl: {
    fontSize: 12,
    color: Colors.purple.primary,
  },
  deleteButton: {
    padding: 8,
  },
  addLocationForm: {
    backgroundColor: Colors.background.light,
    padding: 12,
    borderRadius: 8,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.background.white,
    borderWidth: 1,
    borderColor: '#e1e1e1',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  colorPalette: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    marginTop: 4,
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
  addButton: {
    backgroundColor: Colors.purple.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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
    fontSize: 16,
    fontWeight: 'bold',
  },
  presetLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: 8,
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
    backgroundColor: 'transparent',
  },
  presetButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.background.light,
    borderRadius: 8,
    backgroundColor: Colors.background.white,
    paddingRight: 10,
    marginTop: 8,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: Colors.text.primary,
  },
  eyeButton: {
    padding: 4,
  },
});
