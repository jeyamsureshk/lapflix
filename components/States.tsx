import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/lib/theme';

export function LoadingView({ message = 'Loading...' }: { message?: string }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary[500]} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.container}>
      <Text style={styles.errorIcon}>!</Text>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry && (
        <Text style={styles.retry} onPress={onRetry}>Try again</Text>
      )}
    </View>
  );
}

export function EmptyView({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <View style={styles.container}>
      {icon}
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  text: {
    fontSize: 14,
    color: Colors.neutral[500],
  },
  errorIcon: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.error[500],
    width: 56,
    height: 56,
    lineHeight: 56,
    textAlign: 'center',
    borderRadius: 28,
    backgroundColor: Colors.error[50],
    overflow: 'hidden',
  },
  errorText: {
    fontSize: 15,
    color: Colors.neutral[600],
    textAlign: 'center',
    lineHeight: 22,
  },
  retry: {
    fontSize: 15,
    color: Colors.primary[600],
    fontWeight: '600',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.neutral[400],
    textAlign: 'center',
  },
});
