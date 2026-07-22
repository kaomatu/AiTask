import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Router } from 'expo-router';
import { createAppNotification, markAllAppNotificationsAsRead, cleanupInvalidTaskReminders } from './dbService';

// フォアグラウンド動作時の通知ハンドラー設定（ネイティブアプリ用）
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export interface TaskNotificationItem {
  id: number;
  name: string;
  due_date: string;
  is_completed: number;
  class_name?: string | null;
}

/**
 * 通知のパーミッション確認およびリクエスト
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await window.Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus === 'granted';
}

/**
 * タスクリストを通知用本文テキストにフォーマット（最大3件表示 + 他N件）
 */
export function formatTaskListForNotification(tasks: TaskNotificationItem[]): string {
  if (tasks.length === 0) return '';

  const displayTasks = tasks.slice(0, 3);
  const remainingCount = tasks.length - displayTasks.length;

  const lines = displayTasks.map(t => {
    const label = t.class_name ? t.class_name : t.name;
    let dateStr = '';
    if (t.due_date) {
      try {
        const d = new Date(t.due_date);
        if (!isNaN(d.getTime())) {
          dateStr = ` (${d.getMonth() + 1}/${d.getDate()})`;
        }
      } catch {
        // ignore
      }
    }
    return `・${label}${dateStr}`;
  });

  if (remainingCount > 0) {
    lines.push(`(他${remainingCount}件)`);
  }

  return lines.join('\n');
}

/**
 * 全タスクの未完了データをもとに、前日朝・前日夜・当日朝のまとめ通知を更新・スケジュール設定
 */
export async function updateDailyTaskReminders(allTasks: TaskNotificationItem[]) {
  if (Platform.OS !== 'web') {
    // 既存のすべてのローカル通知予約をキャンセル
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  // 未完了タスクのみ抽出
  const uncompletedTasks = allTasks.filter(t => Number(t.is_completed) === 0 && t.due_date);
  if (uncompletedTasks.length === 0) return;

  // 締め切り日（YYYY-MM-DD）ごとにグループ化
  const tasksByDueDateMap = new Map<string, TaskNotificationItem[]>();

  for (const task of uncompletedTasks) {
    try {
      const dueDateObj = new Date(task.due_date);
      if (isNaN(dueDateObj.getTime())) continue;

      // 日付文字列 (YYYY-MM-DD)
      const year = dueDateObj.getFullYear();
      const month = String(dueDateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dueDateObj.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;

      if (!tasksByDueDateMap.has(dateKey)) {
        tasksByDueDateMap.set(dateKey, []);
      }
      tasksByDueDateMap.get(dateKey)!.push(task);
    } catch (e) {
      console.error('Error parsing task due_date:', e);
    }
  }

  const now = new Date();
  const validDueDateKeys = new Set<string>();

  // 各締め切り日に対してリマインダー通知を予約およびアプリ内通知を生成
  for (const [dueDateStr, tasks] of tasksByDueDateMap.entries()) {
    const [year, month, day] = dueDateStr.split('-').map(Number);
    const bodyText = formatTaskListForNotification(tasks);
    const dateLabel = `(${month}/${day})`;

    const tomorrowTitle = `明日締め切りの課題があります！ ${dateLabel}`;
    const todayTitle = `今日締め切りの課題があります！ ${dateLabel}`;

    const prevDayMorning = new Date(year, month - 1, day - 1, 8, 0, 0);
    const prevDayEvening = new Date(year, month - 1, day - 1, 19, 0, 0);
    const sameDayMorning = new Date(year, month - 1, day, 7, 30, 0);
    const dueDayEnd = new Date(year, month - 1, day, 23, 59, 59);

    const targetUrl = `/calendar-week?date=${dueDateStr}`;

    // 本来スマホ側に通知が出る日時（前日朝08:00以降）に現在時刻が既に到達している場合のみアプリ内通知を生成
    if (now >= sameDayMorning && now <= dueDayEnd) {
      // 当日朝07:30以降〜当日中
      validDueDateKeys.add(dueDateStr);
      await createAppNotification({
        id: `task_reminder_${dueDateStr}`,
        title: todayTitle,
        body: bodyText,
        target_url: targetUrl
      });
    } else if (now >= prevDayMorning && now < sameDayMorning) {
      // 前日朝08:00以降〜当日朝07:30前
      validDueDateKeys.add(dueDateStr);
      await createAppNotification({
        id: `task_reminder_${dueDateStr}`,
        title: tomorrowTitle,
        body: bodyText,
        target_url: targetUrl
      });
    }
    // 未来の日時（now < prevDayMorning）の場合は、アプリ内通知を生成せずローカル通知の発火日時を待つ

    if (Platform.OS === 'web') continue;

    // 1. 前日朝 (前日 08:00)
    if (prevDayMorning > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: tomorrowTitle,
          body: bodyText,
          data: { url: targetUrl },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: prevDayMorning,
        },
      });
    }

    // 2. 前日夜 (前日 19:00)
    if (prevDayEvening > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: tomorrowTitle,
          body: bodyText,
          data: { url: targetUrl },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: prevDayEvening,
        },
      });
    }

    // 3. 当日朝 (当日 07:30)
    if (sameDayMorning > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: todayTitle,
          body: bodyText,
          data: { url: targetUrl },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: sameDayMorning,
        },
      });
    }
  }

  // 無効・未来となった古い自動リマインダー通知をクリーンアップ
  await cleanupInvalidTaskReminders(validDueDateKeys);
}

/**
 * 通知をタップした際のイベントリスナーを設定（/calendar-week に遷移＆未読を既読化）
 */
export function setupNotificationResponseListener(router: Router) {
  if (Platform.OS === 'web') return () => {};

  const subscription = Notifications.addNotificationResponseReceivedListener(async response => {
    await markAllAppNotificationsAsRead();
    const data = response.notification.request.content.data;
    if (data && data.url) {
      router.push(data.url as any);
    } else {
      router.push('/calendar-week');
    }
  });

  return () => {
    subscription.remove();
  };
}

/**
 * 【開発者用テスト関数】5秒後に前日・当日のテスト通知を発火
 */
export async function sendTestNotificationsNow() {
  // アプリ内通知レコードを作成
  await createAppNotification({
    id: `test_notif_${Date.now()}`,
    title: '明日締め切りの課題があります！ (5/12)',
    body: '・プログラミング基礎 (5/12)\n・英語Ⅰ (5/12)\n・線形代数 (5/12)\n(他2件)',
    target_url: '/calendar-week'
  });

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        let perm = Notification.permission;
        if (perm === 'default') {
          perm = await Notification.requestPermission();
        }

        if (perm === 'granted') {
          // デスクトップポップアップ通知
          setTimeout(() => {
            try {
              const n1 = new Notification('明日締め切りの課題があります！ (5/12)', {
                body: '・プログラミング基礎 (5/12)\n・英語Ⅰ (5/12)\n(他1件)',
              });
              n1.onclick = () => {
                markAllAppNotificationsAsRead();
                window.focus();
                if (typeof window !== 'undefined') window.location.href = '/calendar-week';
              };
            } catch (e) {
              console.error(e);
            }
          }, 2000);
        }
      } catch (e) {
        console.log('Web Notification API not available:', e);
      }
    }

    // ブラウザの画面内にもテスト通知内容を分かりやすく表示（確実な表示保証）
    setTimeout(() => {
      import('@/utils/alert').then(({ Alert }) => {
        Alert.alert(
          '🔔 明日締め切りの課題があります！ (5/12)',
          '・プログラミング基礎 (5/12)\n・英語Ⅰ (5/12)\n(他1件)\n\n※Web版ではブラウザ権限に応じて画面内およびデスクトップ通知が表示されます。'
        );
      });
    }, 2000);

    return;
  }

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) {
    throw new Error('通知の権限が許可されていません');
  }

  // 5秒後にテスト発火
  const triggerDate = new Date(Date.now() + 5000);

  // 1. 前日通知テスト
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '明日締め切りの課題があります！ (5/12)',
      body: '・プログラミング基礎 (5/12)\n・英語Ⅰ (5/12)\n・線形代数 (5/12)\n(他2件)',
      data: { url: '/calendar-week' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });

  // 2. 当日通知テスト (6秒後)
  const triggerDate2 = new Date(Date.now() + 6000);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '今日締め切りの課題があります！ (5/12)',
      body: '・データ構造とアルゴリズム (5/12)\n・物理学実験 (5/12)',
      data: { url: '/calendar-week' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate2,
    },
  });
}
