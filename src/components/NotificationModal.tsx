import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  DeviceEventEmitter,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import {
  AppNotification,
  getAppNotifications,
  markAppNotificationAsRead,
  markAllAppNotificationsAsRead,
} from '../services/dbService';

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function NotificationModal({ visible, onClose }: NotificationModalProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async () => {
    setLoading(true);
    const data = await getAppNotifications();
    setNotifications(data);
    setLoading(false);
  };

  useEffect(() => {
    if (visible) {
      fetchNotifications();
    }
  }, [visible]);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('APP_NOTIFICATIONS_UPDATED', () => {
      fetchNotifications();
    });
    return () => {
      subscription.remove();
    };
  }, []);

  const handleNotificationPress = async (notif: AppNotification) => {
    // 1. ローカル通知リストを即座に既読状態へ更新
    setNotifications(prev =>
      prev.map(n => (n.id === notif.id ? { ...n, is_read: 1 } : n))
    );

    // 2. モーダルを閉じる
    onClose();

    // 3. 既読処理の実行（未読の場合）
    if (notif.is_read === 0) {
      await markAppNotificationAsRead(notif.id);
    }

    // 4. 指定URL画面へのナビゲーション
    const targetUrl = notif.target_url || '/calendar-week';
    router.push(targetUrl as any);
  };

  const handleMarkAllRead = async () => {
    await markAllAppNotificationsAsRead();
    fetchNotifications();
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'たった今';
      if (diffMins < 60) return `${diffMins}分前`;
      if (diffHours < 24) return `${diffHours}時間前`;
      if (diffDays < 7) return `${diffDays}日前`;

      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${month}/${day}`;
    } catch {
      return '';
    }
  };

  const unreadCount = notifications.filter(n => n.is_read === 0).length;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={e => e.stopPropagation()}>
          {/* ヘッダー */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="notifications" size={22} color={Colors.purple.primary} />
              <Text style={styles.headerTitle}>お知らせ</Text>
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </View>
            <View style={styles.headerRight}>
              {unreadCount > 0 && (
                <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllButton}>
                  <Text style={styles.markAllButtonText}>全件既読</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* 通知リスト */}
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={Colors.purple.primary} />
            </View>
          ) : notifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={48} color={Colors.text.secondary} style={{ opacity: 0.5 }} />
              <Text style={styles.emptyText}>通知はありません</Text>
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const isUnread = item.is_read === 0;
                return (
                  <TouchableOpacity
                    style={[styles.itemCard, isUnread && styles.itemCardUnread]}
                    onPress={() => handleNotificationPress(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.itemHeader}>
                      <View style={styles.itemTitleRow}>
                        {isUnread && <View style={styles.unreadDot} />}
                        <Text style={[styles.itemTitle, isUnread && styles.itemTitleUnread]}>
                          {item.title}
                        </Text>
                      </View>
                      <Text style={styles.itemTime}>{formatTime(item.created_at)}</Text>
                    </View>

                    <Text style={styles.itemBody}>{item.body}</Text>

                    <View style={styles.itemFooter}>
                      <Text style={styles.itemLinkText}>タップして週表示で確認</Text>
                      <Ionicons name="chevron-forward" size={14} color={Colors.purple.primary} />
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '80%',
    backgroundColor: Colors.background.light || '#FFF',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    backgroundColor: '#FFF',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginLeft: 8,
  },
  unreadBadge: {
    backgroundColor: '#E74C3C',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  unreadBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  markAllButton: {
    marginRight: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: Colors.purple.light || '#F0EDFD',
    borderRadius: 6,
  },
  markAllButtonText: {
    fontSize: 12,
    color: Colors.purple.primary,
    fontWeight: '600',
  },
  closeButton: {
    padding: 2,
  },
  loadingBox: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.text.secondary,
  },
  listContent: {
    padding: 12,
  },
  itemCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  itemCardUnread: {
    backgroundColor: '#F8F6FF',
    borderColor: '#7C3AED',
    borderLeftWidth: 4,
    borderLeftColor: '#7C3AED',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#7C3AED',
    marginRight: 8,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2D3748',
    flex: 1,
  },
  itemTitleUnread: {
    fontWeight: '700',
    color: '#4C1D95',
  },
  itemTime: {
    fontSize: 11,
    color: '#A0AEC0',
    fontWeight: '500',
  },
  itemBody: {
    fontSize: 13,
    color: '#4A5568',
    lineHeight: 19,
    marginBottom: 8,
    marginTop: 2,
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  itemLinkText: {
    fontSize: 12,
    color: '#6D28D9',
    fontWeight: '600',
    marginRight: 2,
  },
});
