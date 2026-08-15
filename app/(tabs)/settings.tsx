import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Server, Check, X, Info, Laptop, Wifi } from 'lucide-react-native';
import { api } from '@/lib/api';
import { getServerUrl, setServerUrl } from '@/lib/storage';
import type { HealthResponse } from '@/lib/types';
import { Colors, Radius, Spacing, Typography } from '@/lib/theme';

export default function SettingsScreen() {
  const [url, setUrl] = useState('');
  const [savedUrl, setSavedUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<HealthResponse | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    getServerUrl().then((u) => {
      setUrl(u);
      setSavedUrl(u);
    });
  }, []);

  const handleSave = async () => {
    await setServerUrl(url);
    setSavedUrl(url);
    setTestResult(null);
    setTestError(null);
  };

  const handleTest = useCallback(async () => {
    if (!url.trim()) {
      setTestError('Enter a server URL first');
      return;
    }
    try {
      setTesting(true);
      setTestError(null);
      setTestResult(null);
      await setServerUrl(url);
      setSavedUrl(url);
      const result = await api.checkHealth();
      setTestResult(result);
    } catch (e) {
      setTestError(e instanceof Error ? e.message : 'Connection failed');
    } finally {
      setTesting(false);
    }
  }, [url]);

  const isDirty = url.trim() !== savedUrl;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>Connect to your file server</Text>
      </View>

      <View style={styles.content}>
        {/* Connection card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <Server size={22} color={Colors.primary[600]} strokeWidth={2} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Server Address</Text>
              <Text style={styles.cardDesc}>
                Enter the URL shown by the server script
              </Text>
            </View>
          </View>

          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={url}
              onChangeText={setUrl}
              placeholder="http://192.168.1.100:7321"
              placeholderTextColor={Colors.neutral[400]}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            {isDirty && (
              <Pressable style={styles.saveBadge} onPress={handleSave}>
                <Text style={styles.saveBadgeText}>Save</Text>
              </Pressable>
            )}
          </View>

          <Pressable
            style={[styles.testButton, testing && styles.testButtonDisabled]}
            onPress={handleTest}
            disabled={testing}
          >
            {testing ? (
              <ActivityIndicator size="small" color={Colors.neutral[0]} />
            ) : (
              <>
                <Wifi size={18} color={Colors.neutral[0]} strokeWidth={2} />
                <Text style={styles.testButtonText}>Test Connection</Text>
              </>
            )}
          </Pressable>

          {/* Test result */}
          {testResult && (
            <View style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <View style={styles.successIcon}>
                  <Check size={16} color={Colors.neutral[0]} strokeWidth={3} />
                </View>
                <Text style={styles.resultTitle}>Connected</Text>
              </View>
              <View style={styles.resultRow}>
                <Laptop size={16} color={Colors.neutral[500]} strokeWidth={2} />
                <Text style={styles.resultLabel}>Hostname</Text>
                <Text style={styles.resultValue}>{testResult.hostname}</Text>
              </View>
              <View style={styles.resultRow}>
                <Server size={16} color={Colors.neutral[500]} strokeWidth={2} />
                <Text style={styles.resultLabel}>Shared folder</Text>
                <Text style={styles.resultValue} numberOfLines={1}>{testResult.root}</Text>
              </View>
              <View style={styles.resultRow}>
                <Info size={16} color={Colors.neutral[500]} strokeWidth={2} />
                <Text style={styles.resultLabel}>Platform</Text>
                <Text style={styles.resultValue}>{testResult.platform}</Text>
              </View>
            </View>
          )}

          {testError && (
            <View style={styles.errorCard}>
              <View style={styles.errorIcon}>
                <X size={16} color={Colors.neutral[0]} strokeWidth={3} />
              </View>
              <Text style={styles.errorText}>{testError}</Text>
            </View>
          )}
        </View>

        {/* Instructions card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>How to connect</Text>
          <View style={styles.step}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
            <Text style={styles.stepText}>
              On your laptop, open a terminal and run the server script from the{'\n'}
              <Text style={styles.codeText}>server/laptop-server.js</Text> file
            </Text>
          </View>
          <View style={styles.step}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
            <Text style={styles.stepText}>
              The script prints one or more URLs like{'\n'}
              <Text style={styles.codeText}>http://192.168.x.x:7321</Text>
            </Text>
          </View>
          <View style={styles.step}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
            <Text style={styles.stepText}>
              Make sure your phone and laptop are on the same Wi-Fi network
            </Text>
          </View>
          <View style={styles.step}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>4</Text></View>
            <Text style={styles.stepText}>
              Copy the URL into the field above and tap Test Connection
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.neutral[50],
  },
  header: {
    paddingTop: 56,
    paddingBottom: 14,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.neutral[900],
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Colors.neutral[400],
    marginTop: 2,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: Colors.neutral[0],
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    ...Typography.h3,
    color: Colors.neutral[900],
    marginBottom: 4,
  },
  cardDesc: {
    ...Typography.bodySmall,
    color: Colors.neutral[500],
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.neutral[300],
    borderRadius: Radius.md,
    backgroundColor: Colors.neutral[50],
    marginBottom: 12,
    paddingRight: 8,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.neutral[900],
  },
  saveBadge: {
    backgroundColor: Colors.primary[600],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.sm,
  },
  saveBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.neutral[0],
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary[600],
  },
  testButtonDisabled: {
    opacity: 0.6,
  },
  testButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.neutral[0],
  },
  resultCard: {
    marginTop: 16,
    padding: 16,
    backgroundColor: Colors.success[50],
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.success[200],
    gap: 10,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  successIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.success[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.success[700],
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultLabel: {
    fontSize: 13,
    color: Colors.neutral[500],
    width: 100,
  },
  resultValue: {
    flex: 1,
    fontSize: 13,
    color: Colors.neutral[800],
    fontWeight: '500',
  },
  errorCard: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    backgroundColor: Colors.error[50],
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.error[200],
  },
  errorIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.error[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: Colors.error[700],
  fontWeight: '500',
  },
  step: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary[700],
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: Colors.neutral[600],
    lineHeight: 22,
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: Colors.primary[700],
    fontWeight: '600',
  },
});
