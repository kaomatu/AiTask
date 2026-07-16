import { Colors } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ClassSelectModal from './ClassSelectModal';
import TaskCreateModal, { TaskCreateModalRef } from './TaskCreateModal';

interface BottomNavBarProps {
  onTaskCreated?: () => void;
}

export default function BottomNavBar({ onTaskCreated }: BottomNavBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const taskCreateModalRef = useRef<TaskCreateModalRef>(null);
  const [classSelectVisible, setClassSelectVisible] = useState(false);
  const [calendarSelectVisible, setCalendarSelectVisible] = useState(false);

  const handleAddPress = () => {
    // ＋ボタンが押されたら、まずは授業選択モーダルを開く
    setClassSelectVisible(true);
  };

  const handleSelectClass = (course: any | null) => {
    // 授業が選択されたら（または「授業なし」が選ばれたら）
    setClassSelectVisible(false);
    
    // 少し遅延を入れて、選択モーダルが閉じるアニメーションと
    // 作成モーダルが開くアニメーションが被らないようにする
    setTimeout(() => {
      taskCreateModalRef.current?.present(course);
    }, 300);
  };

  return (
    <>
      <View style={[styles.container, { paddingBottom: insets.bottom, height: 70 + insets.bottom }]}>
        {/* Android用のフェイク上向き影 */}
        {Platform.OS === 'android' && (
          <LinearGradient
            colors={['transparent', 'rgba(0, 0, 0, 0.08)']}
            style={styles.androidShadow}
            pointerEvents="none"
          />
        )}

        {/* 左のアイコン */}
        <TouchableOpacity 
          style={styles.iconButton} 
          onPress={() => setCalendarSelectVisible(true)}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <Ionicons name="calendar-outline" size={28} color={Colors.purple.primary} />
        </TouchableOpacity>

        {/* 真ん中の大きな＋ボタン */}
        <View style={styles.centerButtonWrapper}>
          <TouchableOpacity 
            style={styles.centerButton} 
            onPress={handleAddPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="add" size={40} color={Colors.text.white} />
          </TouchableOpacity>
        </View>

        {/* 右のアイコン */}
        <TouchableOpacity 
          style={styles.iconButton} 
          onPress={() => router.push('/settings')}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <Ionicons name="settings-outline" size={28} color={Colors.purple.primary} />
        </TouchableOpacity>
      </View>

      {/* 授業選択モーダル */}
      <ClassSelectModal 
        visible={classSelectVisible} 
        onClose={() => setClassSelectVisible(false)} 
        onSelectClass={handleSelectClass} 
      />

      {/* 課題作成モーダル */}
      <TaskCreateModal ref={taskCreateModalRef} onTaskCreated={onTaskCreated} />

      {/* カレンダー表示切り替えポップアップ */}
      <Modal
        visible={calendarSelectVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCalendarSelectVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setCalendarSelectVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>表示切り替え</Text>
                
                <TouchableOpacity 
                  style={styles.modalOption}
                  onPress={() => {
                    setCalendarSelectVisible(false);
                    router.push('/');
                  }}
                >
                  <Ionicons name="home-outline" size={24} color={Colors.purple.primary} style={styles.modalOptionIcon} />
                  <Text style={styles.modalOptionText}>ホーム</Text>
                </TouchableOpacity>

                <View style={styles.modalDivider} />

                <TouchableOpacity 
                  style={styles.modalOption}
                  onPress={() => {
                    setCalendarSelectVisible(false);
                    router.push('/calendar-week');
                  }}
                >
                  <Ionicons name="calendar-outline" size={24} color={Colors.purple.primary} style={styles.modalOptionIcon} />
                  <Text style={styles.modalOptionText}>週表示</Text>
                </TouchableOpacity>

                <View style={styles.modalDivider} />

                <TouchableOpacity 
                  style={styles.modalOption}
                  onPress={() => {
                    setCalendarSelectVisible(false);
                    router.push('/calendar-month');
                  }}
                >
                  <Ionicons name="calendar-clear-outline" size={24} color={Colors.purple.primary} style={styles.modalOptionIcon} />
                  <Text style={styles.modalOptionText}>月表示</Text>
                </TouchableOpacity>

                <View style={styles.modalDivider} />

                <TouchableOpacity 
                  style={styles.modalOption}
                  onPress={() => {
                    setCalendarSelectVisible(false);
                    router.push('/timetable');
                  }}
                >
                  <Ionicons name="grid-outline" size={24} color={Colors.purple.primary} style={styles.modalOptionIcon} />
                  <Text style={styles.modalOptionText}>時間割</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: Colors.background.white,
    height: 70, // バーの高さ
    // 上部の影を設定
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 100,
    
    // 画面下部に固定
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  androidShadow: {
    position: 'absolute',
    top: -16, // 影の高さ分上にずらす
    left: 0,
    right: 0,
    height: 16,
  },
  iconButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerButtonWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    top: -20, // バーの上に少しはみ出させる
  },
  centerButton: {
    backgroundColor: Colors.purple.primary,
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    
    // 背景と同化しないようにごく薄い白い枠線を追加
    borderWidth: 3,
    borderColor: Colors.background.white,

    // ボタン自体の影
    shadowColor: Colors.purple.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 90, // BottomNavBarの上あたりに表示
  },
  modalContent: {
    backgroundColor: Colors.background.white,
    borderRadius: 16,
    padding: 16,
    width: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text.secondary,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  modalOptionIcon: {
    marginRight: 16,
  },
  modalOptionText: {
    fontSize: 16,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  modalDivider: {
    height: 1,
    backgroundColor: Colors.background.light,
    marginVertical: 4,
  }
});
