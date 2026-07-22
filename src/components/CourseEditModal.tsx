import React, { useState, useEffect } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

interface CourseEditModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (courseName: string) => void;
  onDelete?: () => void;
  initialCourseName?: string;
  previousCourseName?: string;
  dayString?: string;
  period?: number;
}

export default function CourseEditModal({ 
  visible, 
  onClose, 
  onSave, 
  onDelete, 
  initialCourseName = '',
  previousCourseName,
  dayString = '',
  period = 1
}: CourseEditModalProps) {
  const [courseName, setCourseName] = useState('');

  useEffect(() => {
    if (visible) {
      setCourseName(initialCourseName || '');
    }
  }, [visible, initialCourseName]);

  const handleSave = () => {
    if (courseName.trim() === '') return;
    onSave(courseName.trim());
    setCourseName('');
  };

  const isEditing = !!initialCourseName;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {isEditing ? '授業を編集' : '授業を追加'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeIcon}>
              <Ionicons name="close" size={24} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={20} color={Colors.purple.primary} />
            <Text style={styles.infoText}>
              {dayString}曜日 {period}限
            </Text>
          </View>

          <Text style={styles.label}>授業名</Text>
          <TextInput
            style={styles.input}
            placeholder="例: プログラミング入門"
            placeholderTextColor={Colors.text.secondary}
            value={courseName}
            onChangeText={setCourseName}
            autoFocus={true}
          />

          {!isEditing && previousCourseName ? (
            <TouchableOpacity 
              style={styles.repeatButton}
              onPress={() => onSave(previousCourseName)}
            >
              <Ionicons name="copy-outline" size={20} color={Colors.purple.primary} />
              <Text style={styles.repeatButtonText}>直前の授業「{previousCourseName}」を繰り返す</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.buttonRow}>
            {isEditing && onDelete ? (
              <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
                <Ionicons name="trash-outline" size={20} color="#fff" />
                <Text style={styles.deleteButtonText}>削除</Text>
              </TouchableOpacity>
            ) : <View style={{ flex: 1 }} />}
            
            <TouchableOpacity 
              style={[styles.saveButton, !courseName.trim() && styles.saveButtonDisabled]} 
              onPress={handleSave}
              disabled={!courseName.trim()}
            >
              <Text style={styles.saveButtonText}>保存</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  closeIcon: {
    padding: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.light,
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  infoText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.purple.primary,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 24,
    backgroundColor: '#FAFAFA',
  },
  repeatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
    backgroundColor: 'rgba(76, 77, 220, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.purple.primary,
    gap: 8,
  },
  repeatButtonText: {
    color: Colors.purple.primary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#E74C3C',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  saveButton: {
    flex: 2,
    backgroundColor: Colors.purple.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#AAB7B8',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
