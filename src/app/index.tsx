import BottomNavBar from "@/components/BottomNavBar";
import TaskList from "@/components/TaskList";
import Timetable from "@/components/Timetable";
import { Colors } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { getSetting, getTasksWithDetails, toggleTaskComplete, saveTask, saveSetting, syncOfflineAttachments } from "../services/dbService";
import { useAuth } from "../context/AuthContext";
import { auth } from "../config/firebase";
import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions, RefreshControl } from "react-native";
import { Alert } from '@/utils/alert';
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const GREETINGS = {
  morning: [
    "今日も一日がんばりましょう！",
    "しっかり朝ごはんは食べましたか？エネルギー満タンでいきましょう！",
    "1限から気合入れていきましょう！（もし寝坊してたら急いで！🏃‍♂️）",
    "朝のうちに今日の課題をチェックしておくと、後で楽になりますよ！",
    "今日も1日、単位のために生き抜きましょう！",
    "清々しい朝ですね。今日の目標は決まりましたか？",
    "早起きは三文の徳！今日も良いことがありますように。",
    "今日も笑顔でスタートしましょう！",
  ],
  afternoon: [
    "午後の授業もファイトです！",
    "ご飯を食べて眠くなる時間帯…😪 コーヒーでも飲んで一息つきましょう。",
    "今日のタスクは順調ですか？自分のペースで大丈夫ですよ！",
    "あと少しで今日の授業も終わり！ラストスパートです！",
    "お昼休みはリフレッシュできましたか？午後も頑張りましょう！",
    "疲れたら軽くストレッチするのがおすすめです！",
    "あと半日、気を抜かずにいきましょう！",
    "夕方からの予定を楽しみに、午後も乗り切りましょう！",
  ],
  evening: [
    "今日もお疲れ様でした！ゆっくり休んでくださいね🍵",
    "残っている課題があれば、忘れないうちにサクッと終わらせちゃいましょう！",
    "明日の時間割の確認をしておくと、朝が少しだけ楽になりますよ。",
    "スマホの触りすぎには注意して、夜更かししないようにしてくださいね。",
    "今日頑張った自分をたくさん褒めてあげてください！",
    "夕食は何を食べましたか？しっかり栄養をとってくださいね。",
    "リラックスタイム！お風呂にゆっくり浸かるのもおすすめです。",
    "今日も1日、本当にお疲れ様でした！",
  ],
  night: [
    "こんな時間まで起きているんですか！？ちゃんと寝てくださいね🛌",
    "もしや課題に追われていますか…？応援しています！でも無理は禁物ですよ！",
    "単位は落としても、スマホは落とさないように気を付けてくださいね。",
    "夜の静寂な時間は集中できますが、明日に響かない程度に！",
    "羊が一匹…羊が二匹…そろそろ寝る準備をしましょう。",
    "遅くまで頑張りすぎないで！健康第一です。",
    "深夜のテンションで変なメッセージを送らないように注意！",
    "そろそろお休みの時間です。良い夢を！",
  ]
};

export default function Index() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [taskCounts, setTaskCounts] = useState<Record<number, number>>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  const [stats, setStats] = useState({ todayTotal: 0, todayCompleted: 0, weekTotal: 0, weekCompleted: 0 });
  const [activeTab, setActiveTab] = useState<'today' | 'tomorrow'>('today');
  const [todayTasks, setTodayTasks] = useState<any[]>([]);
  const [tomorrowTasks, setTomorrowTasks] = useState<any[]>([]);
  const [todayCompletedTasks, setTodayCompletedTasks] = useState<any[]>([]);
  const [tomorrowCompletedTasks, setTomorrowCompletedTasks] = useState<any[]>([]);
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

  const [userName, setUserName] = useState('');
  const [greetingMessage, setGreetingMessage] = useState('');

  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const router = useRouter();
  const { onboardingCompleted } = useAuth();

  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const fetchTasks = async () => {
        if (!auth.currentUser) return;
        try {
          // オフライン時に保存された添付ファイルをバックグラウンドでクラウドへ同期試行
          syncOfflineAttachments().catch(() => {});

          // Firestoreよりユーザー名を取得
          let userNameVal = await getSetting('user_name');
          if (!userNameVal) {
            if (onboardingCompleted) {
              // オンボーディング完了済みだがユーザー名が無い場合は自動補完して進める（無限ループ対策）
              await saveSetting('user_name', 'ユーザー');
              userNameVal = 'ユーザー';
            } else {
              if (isActive) {
                router.replace('/onboarding');
              }
              return;
            }
          }

          if (isActive) {
            setUserName(userNameVal);
            
            // 時間帯の判定
            const currentHour = new Date().getHours();
            let timeCategory: 'morning' | 'afternoon' | 'evening' | 'night';
            let timeGreeting = '';
            
            if (currentHour >= 5 && currentHour < 12) {
              timeCategory = 'morning';
              timeGreeting = 'おはようございます！ ☀️';
            } else if (currentHour >= 12 && currentHour < 17) {
              timeCategory = 'afternoon';
              timeGreeting = 'こんにちは！ 🌤️';
            } else if (currentHour >= 17 && currentHour < 24) {
              timeCategory = 'evening';
              timeGreeting = 'こんばんは！ 🌙';
            } else {
              timeCategory = 'night';
              timeGreeting = 'こんばんは！ 🦉'; // 深夜の挨拶
            }

            const messages = GREETINGS[timeCategory];
            const randomMessage = messages[Math.floor(Math.random() * messages.length)];
            setGreetingMessage(`${timeGreeting}\n\n${randomMessage}`);
          }

        const rows = await getTasksWithDetails();
        if (!isActive) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        let tTotal = 0, tComp = 0, wTotal = 0, wComp = 0;
        const tTasks: any[] = [];
        const tCompTasks: any[] = [];
        const tomTasks: any[] = [];
        const tomCompTasks: any[] = [];
        const counts: Record<number, number> = {};

        for (const t of rows) {
          const d = new Date(t.due_date);
          
          if (t.is_completed === 0) {
            const day = d.getDate();
            counts[day] = (counts[day] || 0) + 1;
          }

          if (d >= today && d < tomorrow) {
            tTotal++;
            if (t.is_completed === 1) { tComp++; tCompTasks.push(t); }
            else tTasks.push(t);
          } else if (d >= tomorrow && d < new Date(tomorrow.getTime() + 24*60*60*1000)) {
            if (t.is_completed === 1) tomCompTasks.push(t);
            else tomTasks.push(t);
          }

          if (d >= startOfWeek && d <= endOfWeek) {
            wTotal++;
            if (t.is_completed === 1) wComp++;
          }
        }
        
        setStats({ todayTotal: tTotal, todayCompleted: tComp, weekTotal: wTotal, weekCompleted: wComp });
        setTodayTasks(tTasks);
        setTodayCompletedTasks(tCompTasks);
        setTomorrowTasks(tomTasks);
        setTomorrowCompletedTasks(tomCompTasks);
        setTaskCounts(counts);
        setTasks(rows.filter(t => t.is_completed === 0));

      } catch (err) {
        console.error("Failed to fetch tasks:", err);
      }
    };
    fetchTasks();
    return () => { isActive = false; };
  }, [refreshKey])
  );

  // タスクの完了切り替えとクローン生成ロジック
  const handleToggleComplete = async (taskId: number, currentCompletedState: number) => {
    try {
      const newCompletedState = currentCompletedState === 1 ? 0 : 1;
      const nowStr = new Date().toISOString();
      
      // 1. 現在のタスクをFirestoreで更新
      await toggleTaskComplete(taskId, newCompletedState, nowStr);

      // SQLite にも保存 (下位互換性のため)
      await db.runAsync(
        "UPDATE tasks SET is_completed = ?, updated_at = ? WHERE id = ?",
        [newCompletedState, nowStr, taskId]
      );

      // 2. 完了状態になり、かつ繰り返しタスクの場合は次回タスクをクローン
      if (newCompletedState === 1) {
        const tasks = await getTasksWithDetails();
        const task = tasks.find(t => t.id === taskId);

        if (task && task.is_recurring === 1) {
          // 次回の期限を計算 (+7日)
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

  const renderTasks = (incomplete: any[], completed: any[]) => (
    <View>
      <TaskList 
        tasks={incomplete} 
        hideHeader={true}
        onToggleComplete={handleToggleComplete}
        onTaskUpdated={() => setRefreshKey(prev => prev + 1)}
        style={{ backgroundColor: 'transparent', paddingHorizontal: 0, paddingBottom: 0 }}
      />
      {completed.length > 0 && (
        <View style={styles.completedSeparator}>
          <View style={styles.completedSeparatorLine} />
          <Text style={styles.completedSeparatorText}>完了済み</Text>
          <View style={styles.completedSeparatorLine} />
        </View>
      )}
      {completed.length > 0 && (
        <TaskList 
          tasks={completed} 
          hideHeader={true}
          onToggleComplete={handleToggleComplete}
          onTaskUpdated={() => setRefreshKey(prev => prev + 1)}
          style={{ backgroundColor: 'transparent', paddingHorizontal: 0, paddingBottom: 0 }}
        />
      )}
    </View>
  );


  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <View style={styles.frame}>
        {isLargeScreen ? (
          // PC・タブレット用の2カラムレイアウト
          <View style={styles.largeScreenContainer}>
            <View style={styles.leftColumn}>
              <Timetable isEditMode={false} refreshKey={refreshKey} />
            </View>
            <View style={styles.rightColumn}>
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 }]}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[Colors.purple.primary]} />
                }
              >
                <View style={styles.greetingContainer}>
                  <Text style={styles.greetingName}>{userName} さん</Text>
                  <Text style={styles.greetingMessage}>{greetingMessage}</Text>
                </View>

                {/* ダッシュボード (達成度) */}
                <View style={styles.dashboardCard}>
                  <View style={styles.dashboardCol}>
                    {/* 今日の課題 */}
                    <View style={styles.dashboardItem}>
                      <View style={styles.dashboardHeader}>
                        <Text style={styles.dashboardLabel}>今日の課題</Text>
                        <View style={styles.dashboardValueContainer}>
                          {stats.todayTotal > 0 && stats.todayCompleted < stats.todayTotal && (
                            <Ionicons name="alert-circle" size={18} color="#E74C3C" style={{ marginRight: 6 }} />
                          )}
                          {stats.todayTotal > 0 && stats.todayCompleted === stats.todayTotal && (
                            <Ionicons name="star" size={18} color={Colors.yellow.dark} style={{ marginRight: 6 }} />
                          )}
                          <Text style={styles.dashboardValue}>{stats.todayCompleted} / {stats.todayTotal}</Text>
                        </View>
                      </View>
                      <View style={styles.progressBarContainer}>
                        <View style={[styles.progressBarFill, { width: `${stats.todayTotal > 0 ? (stats.todayCompleted / stats.todayTotal) * 100 : 0}%` }]} />
                      </View>
                    </View>

                    {/* セパレータ */}
                    <View style={styles.dashboardDividerHorizontal} />

                    {/* 今週の課題 */}
                    <View style={styles.dashboardItem}>
                      <View style={styles.dashboardHeader}>
                        <Text style={styles.dashboardLabel}>今週の課題</Text>
                        <View style={styles.dashboardValueContainer}>
                          {stats.weekTotal > 0 && stats.weekCompleted < stats.weekTotal && (
                            <Ionicons name="alert-circle" size={18} color="#E74C3C" style={{ marginRight: 6 }} />
                          )}
                          {stats.weekTotal > 0 && stats.weekCompleted === stats.weekTotal && (
                            <Ionicons name="star" size={18} color={Colors.yellow.dark} style={{ marginRight: 6 }} />
                          )}
                          <Text style={styles.dashboardValue}>{stats.weekCompleted} / {stats.weekTotal}</Text>
                        </View>
                      </View>
                      <View style={styles.progressBarContainer}>
                        <View style={[styles.progressBarFill, { width: `${stats.weekTotal > 0 ? (stats.weekCompleted / stats.weekTotal) * 100 : 0}%` }]} />
                      </View>
                      
                      {/* 週表示へ移動するボタン */}
                      <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
                        <TouchableOpacity 
                          style={styles.weekLinkButton} 
                          onPress={() => router.push('/calendar-week')}
                        >
                          <Text style={styles.weekLinkText}>週表示へ移動する</Text>
                          <Ionicons name="chevron-forward" size={14} color="#FFF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>

                {/* 今日の課題・明日の課題 */}
                <View style={styles.dashboardListCard}>
                  <View style={styles.tabContainer}>
                    <TouchableOpacity 
                      style={[styles.tabButton, activeTab === 'today' && styles.tabButtonActive]}
                      onPress={() => setActiveTab('today')}
                    >
                      <Text style={[styles.tabText, activeTab === 'today' && styles.tabTextActive]}>今日の課題</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.tabButton, activeTab === 'tomorrow' && styles.tabButtonActive]}
                      onPress={() => setActiveTab('tomorrow')}
                    >
                      <Text style={[styles.tabText, activeTab === 'tomorrow' && styles.tabTextActive]}>明日の課題</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.dashboardListContent}>
                    {activeTab === 'today' 
                      ? renderTasks(todayTasks, todayCompletedTasks) 
                      : renderTasks(tomorrowTasks, tomorrowCompletedTasks)}
                  </View>
                </View>

                {/* タスク一覧表示ボタン */}
                <TouchableOpacity 
                  style={styles.expandButton}
                  onPress={() => router.push('/tasks-overview')}
                >
                  <Text style={styles.expandButtonText}>タスクの一覧表示へ</Text>
                  <Ionicons name="chevron-forward" size={20} color={Colors.purple.primary} />
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[Colors.purple.primary]} />
            }
          >
          <View style={[styles.paddedSection, { zIndex: 1, elevation: 1 }]}>
            
            {/* 挨拶メッセージ */}
            <View style={styles.greetingContainer}>
              <Text style={styles.greetingName}>{userName} さん</Text>
              <Text style={styles.greetingMessage}>{greetingMessage}</Text>
            </View>

            {/* ダッシュボード (達成度) */}
            <View style={styles.dashboardCard}>
              <View style={styles.dashboardCol}>
                
                {/* 今日の課題 */}
                <View style={styles.dashboardItem}>
                  <View style={styles.dashboardHeader}>
                    <Text style={styles.dashboardLabel}>今日の課題</Text>
                    <View style={styles.dashboardValueContainer}>
                      {stats.todayTotal > 0 && stats.todayCompleted < stats.todayTotal && (
                        <Ionicons name="alert-circle" size={18} color="#E74C3C" style={{ marginRight: 6 }} />
                      )}
                      {stats.todayTotal > 0 && stats.todayCompleted === stats.todayTotal && (
                        <Ionicons name="star" size={18} color={Colors.yellow.dark} style={{ marginRight: 6 }} />
                      )}
                      <Text style={styles.dashboardValue}>{stats.todayCompleted} / {stats.todayTotal}</Text>
                    </View>
                  </View>
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBarFill, { width: `${stats.todayTotal > 0 ? (stats.todayCompleted / stats.todayTotal) * 100 : 0}%` }]} />
                  </View>
                </View>

                {/* セパレータ */}
                <View style={styles.dashboardDividerHorizontal} />

                {/* 今週の課題 */}
                <View style={styles.dashboardItem}>
                  <View style={styles.dashboardHeader}>
                    <Text style={styles.dashboardLabel}>今週の課題</Text>
                    <View style={styles.dashboardValueContainer}>
                      {stats.weekTotal > 0 && stats.weekCompleted < stats.weekTotal && (
                        <Ionicons name="alert-circle" size={18} color="#E74C3C" style={{ marginRight: 6 }} />
                      )}
                      {stats.weekTotal > 0 && stats.weekCompleted === stats.weekTotal && (
                        <Ionicons name="star" size={18} color={Colors.yellow.dark} style={{ marginRight: 6 }} />
                      )}
                      <Text style={styles.dashboardValue}>{stats.weekCompleted} / {stats.weekTotal}</Text>
                    </View>
                  </View>
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBarFill, { width: `${stats.weekTotal > 0 ? (stats.weekCompleted / stats.weekTotal) * 100 : 0}%` }]} />
                  </View>
                  
                  {/* 週表示へ移動するボタン */}
                  <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
                    <TouchableOpacity 
                      style={styles.weekLinkButton} 
                      onPress={() => router.push('/calendar-week')}
                    >
                      <Text style={styles.weekLinkText}>週表示へ移動する</Text>
                      <Ionicons name="chevron-forward" size={14} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </View>

              </View>
            </View>

            {/* 今日の課題・明日の課題 タブ切り替えとリスト */}
            <View style={styles.dashboardListCard}>
              <View style={styles.tabContainer}>
                <TouchableOpacity 
                  style={[styles.tabButton, activeTab === 'today' && styles.tabButtonActive]}
                  onPress={() => setActiveTab('today')}
                >
                  <Text style={[styles.tabText, activeTab === 'today' && styles.tabTextActive]}>今日の課題</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.tabButton, activeTab === 'tomorrow' && styles.tabButtonActive]}
                  onPress={() => setActiveTab('tomorrow')}
                >
                  <Text style={[styles.tabText, activeTab === 'tomorrow' && styles.tabTextActive]}>明日の課題</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.dashboardListContent}>
                {activeTab === 'today' 
                  ? renderTasks(todayTasks, todayCompletedTasks) 
                  : renderTasks(tomorrowTasks, tomorrowCompletedTasks)}
              </View>
            </View>

            {/* 新しいタスク一覧表示への遷移ボタン */}
            <TouchableOpacity 
              style={styles.expandButton}
              onPress={() => router.push('/tasks-overview')}
            >
              <Text style={styles.expandButtonText}>タスクの一覧表示へ</Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.purple.primary} />
            </TouchableOpacity>


          </View>

          {/* ここだけにしかタスクリストはだめ */}
          
        </ScrollView>
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
    paddingTop: 0, // ヘッダーがあるため余白をなくす
    marginTop: -1, // ヘッダーとコンテンツの間にできる1pxの隙間（または境界線）を埋めるために-1を指定
  },
  frame: {
    flex: 1,
    backgroundColor: "transparent", // 整列用の枠としてのみ使用するため透明に
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 120, // コンテンツが少ない時でも下部の余白を確保（ナビゲーションバーなど）
    gap: 16, // コンポーネント同士の余白だけを残す
  },
  paddedSection: {
    paddingHorizontal: 16, // TaskList以外の横余白
    gap: 16, // 内部のコンポーネント同士の余白
  },
  headerControls: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  toggleButton: {
    backgroundColor: Colors.background.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  toggleButtonText: {
    color: Colors.purple.primary,
    fontWeight: "700",
    fontSize: 14,
  },
  // --- ダッシュボード用スタイル ---
  dashboardCard: {
    backgroundColor: Colors.purple.primary,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 8,
  },
  greetingContainer: {
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  greetingName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text.white,
    marginBottom: 6,
  },
  greetingMessage: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.white,
    lineHeight: 26,
  },
  dashboardCol: {
    flexDirection: 'column',
    gap: 20,
  },
  dashboardItem: {
    width: '100%',
  },
  dashboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dashboardLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '600',
  },
  dashboardValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dashboardValue: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
  },
  dashboardDividerHorizontal: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressBarContainer: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.yellow.dark,
    borderRadius: 3,
  },
  weekLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  weekLinkText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 4,
  },
  dashboardListCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.purple.primary,
  },
  tabText: {
    fontSize: 14,
    color: '#999',
    fontWeight: '600',
  },
  tabTextActive: {
    color: Colors.purple.primary,
  },
  dashboardListContent: {
    minHeight: 60,
  },
  dashboardTaskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  dashboardTaskName: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  dashboardTaskClass: {
    fontSize: 12,
    color: Colors.purple.primary,
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
    overflow: 'hidden',
  },
  dashboardEmptyText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 16,
    fontSize: 14,
  },
  // --- 新しいタスク表示用スタイル ---
  expandButton: {
    backgroundColor: '#FFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  expandButtonText: {
    color: Colors.purple.primary,
    fontSize: 16,
    fontWeight: '700',
    marginRight: 8,
  },
  completedSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 8,
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
    flex: 3,
    height: '100%',
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  rightColumn: {
    flex: 2,
    height: '100%',
  }
});
