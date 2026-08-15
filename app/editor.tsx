import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Save, Check } from 'lucide-react-native';
import { api } from '@/lib/api';
import { Colors, Radius, Spacing, Typography } from '@/lib/theme';

export default function EditorScreen() {
  const params = useLocalSearchParams<{ path: string; name: string }>();
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getTextFile(params.path)
      .then((res) => {
        setContent(res.content);
        setOriginalContent(res.content);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load file'))
      .finally(() => setLoading(false));
  }, [params.path]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await api.saveTextFile(params.path, content);
      setOriginalContent(content);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const isDirty = content !== originalContent;

  if (loading) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={22} color={Colors.neutral[700]} strokeWidth={2} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>{params.name}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary[500]} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color={Colors.neutral[700]} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{params.name}</Text>
        <Pressable
          style={[styles.saveBtn, (!isDirty || saving) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!isDirty || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={Colors.neutral[0]} />
          ) : saved ? (
            <Check size={18} color={Colors.neutral[0]} strokeWidth={2.5} />
          ) : (
            <Save size={18} color={Colors.neutral[0]} strokeWidth={2} />
          )}
        </Pressable>
      </View>

      {error && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <TextInput
        style={styles.editor}
        value={content}
        onChangeText={setContent}
        multiline
        textAlignVertical="top"
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.neutral[0],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
    gap: 12,
  },
  backBtn: {
    padding: 4,
  borderRadius: Radius.sm,
  },
  headerTitle: {
    flex: 1,
    ...Typography.h3,
    color: Colors.neutral[900],
  },
  headerSpacer: {
    width: 44,
  },
  saveBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: Colors.neutral[300],
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBar: {
    backgroundColor: Colors.error[50],
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.error[200],
  },
  errorText: {
    fontSize: 14,
    color: Colors.error[700],
  },
  editor: {
    flex: 1,
    padding: Spacing.md,
    fontSize: 15,
    fontFamily: 'monospace',
    color: Colors.neutral[800],
    lineHeight: 24,
  },
});
