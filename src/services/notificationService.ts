import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Router } from 'expo-router';

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
    return `・${label}`;
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
  if (Platform.OS === 'web') {
    // Web環境ではローカルスケジューリング制限があるためスキップ
    return;
  }

  // 既存のすべてのローカル通知予約をキャンセル
  await Notifications.cancelAllScheduledNotificationsAsync();

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

  // 各締め切り日に対してリマインダー通知を予約
  for (const [dueDateStr, tasks] of tasksByDueDateMap.entries()) {
    const [year, month, day] = dueDateStr.split('-').map(Number);
    const bodyText = formatTaskListForNotification(tasks);

    // 1. 前日朝 (前日 08:00)
    const prevDayMorning = new Date(year, month - 1, day - 1, 8, 0, 0);
    if (prevDayMorning > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '明日締め切りの課題があります！',
          body: bodyText,
          data: { url: '/calendar-week' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: prevDayMorning,
        },
      });
    }

    // 2. 前日夜 (前日 19:00)
    const prevDayEvening = new Date(year, month - 1, day - 1, 19, 0, 0);
    if (prevDayEvening > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '明日締め切りの課題があります！',
          body: bodyText,
          data: { url: '/calendar-week' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: prevDayEvening,
        },
      });
    }

    // 3. 当日朝 (当日 07:30)
    const sameDayMorning = new Date(year, month - 1, day, 7, 30, 0);
    if (sameDayMorning > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '今日締め切りの課題があります！',
          body: bodyText,
          data: { url: '/calendar-week' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: sameDayMorning,
        },
      });
    }
  }
}

/**
 * 通知をタップした際のイベントリスナーを設定（/calendar-week に遷移）
 */
export function setupNotificationResponseListener(router: Router) {
  if (Platform.OS === 'web') return () => {};

  const subscription = Notifications.addNotificationResponseReceivedListener(response => {
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
  if (Platform.OS === 'web') {
    let desktopSuccess = false;

    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        let perm = Notification.permission;
        if (perm === 'default') {
          perm = await Notification.requestPermission();
        }

        if (perm === 'granted') {
          desktopSuccess = true;
          // デスクトップポップアップ通知
          setTimeout(() => {
            try {
              const n1 = new Notification('明日締め切りの課題があります！ (Webテスト)', {
                body: '・プログラミング基礎\n・英語Ⅰ\n(他1件)',
              });
              n1.onclick = () => {
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
          '🔔 明日締め切りの課題があります！ (Web通知)',
          '・プログラミング基礎\n・英語Ⅰ\n(他1件)\n\n※Web版ではブラウザ権限に応じて画面内およびデスクトップ通知が表示されます。'
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
      title: '明日締め切りの課題があります！ (テスト)',
      body: '・プログラミング基礎\n・英語Ⅰ\n・線形代数\n(他2件)',
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
      title: '今日締め切りの課題があります！ (テスト)',
      body: '・データ構造とアルゴリズム\n・物理学実験',
      data: { url: '/calendar-week' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate2,
    },
  });
}
