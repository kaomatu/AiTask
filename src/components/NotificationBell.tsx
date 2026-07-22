import React, { useEffect, useState } from 'react';
import { TouchableOpacity, View, StyleSheet, Text, DeviceEventEmitter } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAppNotifications } from '../services/dbService';
import NotificationModal from './NotificationModal';

interface NotificationBellProps {
  iconColor?: string;
  iconSize?: number;
}

export default function NotificationBell({ iconColor = '#FFF', iconSize = 24 }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [modalVisible, setModalVisible] = useState<boolean>(false);

  const checkUnreadNotifications = async () => {
    const notifications = await getAppNotifications();
    const count = notifications.filter(n => n.is_read === 0).length;
    setUnreadCount(count);
  };

  useEffect(() => {
    checkUnreadNotifications();
    const subscription = DeviceEventEmitter.addListener('APP_NOTIFICATIONS_UPDATED', () => {
      checkUnreadNotifications();
    });
    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <>
      <TouchableOpacity
        style={styles.container}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
        accessibilityLabel="お知らせ"
      >
        <Ionicons name="notifications-outline" size={iconSize} color={iconColor} />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            {unreadCount <= 99 ? (
              <Text style={styles.badgeText}>{unreadCount}</Text>
            ) : (
              <Text style={styles.badgeText}>99+</Text>
            )}
          </View>
        )}
      </TouchableOpacity>

      <NotificationModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 6,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#E74C3C',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
