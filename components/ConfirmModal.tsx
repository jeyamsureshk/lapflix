import { Modal, StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Typography } from '@/lib/theme';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  danger?: boolean;
}

export function ConfirmModal({
  visible,
  title,
  message,
  onCancel,
  onConfirm,
  confirmLabel = 'Confirm',
  danger = false,
}: ConfirmModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Text style={[styles.button, styles.cancelButton]} onPress={onCancel}>
              Cancel
            </Text>
            <Text
              style={[styles.button, danger ? styles.dangerButton : styles.confirmButton]}
              onPress={onConfirm}
            >
              {confirmLabel}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(16, 24, 40, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: Colors.neutral[0],
    borderRadius: Radius.lg,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  title: {
    ...Typography.h3,
    color: Colors.neutral[900],
    marginBottom: 8,
  },
  message: {
    ...Typography.bodySmall,
    color: Colors.neutral[600],
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 20,
  },
  button: {
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  cancelButton: {
    color: Colors.neutral[600],
    backgroundColor: Colors.neutral[100],
  },
  confirmButton: {
    color: Colors.neutral[0],
    backgroundColor: Colors.primary[600],
  },
  dangerButton: {
    color: Colors.neutral[0],
    backgroundColor: Colors.error[600],
  },
});
