import { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  FlatList,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Download, Upload, CheckCircle2, AlertCircle, FileText, Trash2, ExternalLink } from 'lucide-react-native';
import * as Sharing from 'expo-sharing';
import { transferManager, TransferItem } from '@/lib/transferManager';
import { Colors, Radius, Spacing, Typography } from '@/lib/theme';

export default function TransfersScreen() {
  const [transfers, setTransfers] = useState<TransferItem[]>([]);

  useEffect(() => {
    // Subscribe to live transfer events
    const unsubscribe = transferManager.subscribe((items) => {
      setTransfers(items);
    });
    return () => unsubscribe();
  }, []);

  const openFile = async (uri?: string) => {
    if (!uri) return;
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert('Error', 'Sharing files is not supported on this device.');
      }
    } catch (e) {
      Alert.alert('Error', 'Could not open file.');
    }
  };

  const renderItem = ({ item }: { item: TransferItem }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.iconWrap}>
          {item.type === 'download' ? (
            <Download size={20} color={Colors.primary[600]} />
          ) : (
            <Upload size={20} color={Colors.primary[500]} />
          )}
        </View>
        <View style={styles.fileMeta}>
          <Text style={styles.fileName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.fileType}>
            {item.type === 'download' ? 'Downloading from laptop' : 'Uploading to laptop'}
          </Text>
        </View>
        
        {item.status === 'completed' && <CheckCircle2 size={20} color={Colors.success[500]} />}
        {item.status === 'failed' && <AlertCircle size={20} color={Colors.error[600]} />}
        {item.status === 'active' && <ActivityIndicator size="small" color={Colors.primary[600]} />}
      </View>

      {item.status === 'active' && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBarTrack}>
            <View 
              style={[
                styles.progressBarFill, 
                { width: `${Math.round(item.progress * 100)}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>{Math.round(item.progress * 100)}%</Text>
        </View>
      )}

      {item.status === 'completed' && item.uri && (
        <View style={styles.cardFooter}>
          <Pressable style={styles.actionBtn} onPress={() => openFile(item.uri)}>
            <ExternalLink size={14} color={Colors.primary[600]} />
            <Text style={styles.actionBtnText}>Open File</Text>
          </Pressable>
        </View>
      )}

      <Pressable style={styles.dismissBtn} onPress={() => transferManager.removeItem(item.id)}>
        <Trash2 size={16} color={Colors.neutral[400]} />
      </Pressable>
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color={Colors.neutral[700]} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>Live Transfers</Text>
        <View style={styles.headerSpacer} />
      </View>

      {transfers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <FileText size={48} color={Colors.neutral[300]} />
          <Text style={styles.emptyTitle}>No active transfers</Text>
          <Text style={styles.emptySubtitle}>Files you download or upload will show real-time progress here.</Text>
        </View>
      ) : (
        <FlatList
          data={transfers}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.neutral[50] },
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
  backBtn: { padding: 4, borderRadius: Radius.sm },
  headerTitle: { flex: 1, ...Typography.h3, color: Colors.neutral[900] },
  headerSpacer: { width: 30 },
  listContainer: { padding: Spacing.lg, gap: 12 },
  card: {
    backgroundColor: Colors.neutral[0],
    borderRadius: Radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    position: 'relative',
    gap: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: 24 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileMeta: { flex: 1, gap: 2 },
  fileName: { fontSize: 15, fontWeight: '600', color: Colors.neutral[800] },
  fileType: { fontSize: 12, color: Colors.neutral[400] },
  progressContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressBarTrack: { flex: 1, height: 6, backgroundColor: Colors.neutral[100], borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: Colors.primary[600], borderRadius: 3 },
  progressText: { fontSize: 12, fontWeight: '600', color: Colors.neutral[600], width: 36, textAlign: 'right' },
  cardFooter: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.neutral[100], paddingTop: 10, marginTop: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: Colors.primary[600] },
  dismissBtn: { position: 'absolute', top: 14, right: 14, padding: 4 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyTitle: { ...Typography.h3, color: Colors.neutral[700] },
  emptySubtitle: { ...Typography.bodySmall, color: Colors.neutral[400], textAlign: 'center' },
});
