import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors, Radius, Typography } from '@/lib/theme';

interface PromptModalProps {
  visible: boolean;
  title: string;
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  error?: string | null;
}

export function PromptModal({
  visible,
  title,
  label,
  value,
  onChangeText,
  onCancel,
  onSubmit,
  submitLabel = 'Create',
  cancelLabel = 'Cancel',
  error,
}: PromptModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.label}>{label}</Text>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChangeText}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Enter name..."
            placeholderTextColor={Colors.neutral[400]}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.actions}>
            <Text style={[styles.button, styles.cancelButton]} onPress={onCancel}>
              {cancelLabel}
            </Text>
            <Text style={[styles.button, styles.submitButton]} onPress={onSubmit}>
              {submitLabel}
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
    marginBottom: 16,
  },
  label: {
    ...Typography.bodySmall,
    color: Colors.neutral[600],
    marginBottom: 8,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.neutral[300],
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.neutral[900],
    backgroundColor: Colors.neutral[50],
  },
  error: {
    fontSize: 13,
    color: Colors.error[600],
    marginTop: 8,
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
  submitButton: {
    color: Colors.neutral[0],
    backgroundColor: Colors.primary[600],
  },
});
