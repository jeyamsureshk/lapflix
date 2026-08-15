import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, UploadCloud, FileText, Check, X, Clock } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { transferManager } from '@/lib/transferManager';
import { Colors, Radius, Spacing, Typography } from '@/lib/theme';

interface PickedFile {
  name: string;
  size: number;
  uri: string;
  type: string;
}

export default function UploadScreen() {
  const params = useLocalSearchParams<{ path: string }>();
  const [pickedFile, setPickedFile] = useState<PickedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setPickedFile({
        name: asset.name,
        size: asset.size ?? 0,
        uri: asset.uri,
        type: asset.mimeType || 'application/octet-stream',
      });
      setError(null);
      setDone(false);
    } catch (e) {
      setError('Could not pick a file');
    }
  };

  const handleUpload = async () => {
    if (!pickedFile) return;
    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Await the transfer manager so this screen stays in the "uploading" state
      // but it will continue safely in the background if the user taps "Run in Background"
      await transferManager.startUpload(
        pickedFile.uri,
        pickedFile.name,
        params.path || '',
        (progress) => {
          setUploadProgress(progress);
        }
      );

      setDone(true);
      setPickedFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed or was cancelled');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color={Colors.neutral[700]} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>Upload File</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        {error && (
          <View style={styles.errorBar}>
            <X size={16} color={Colors.error[600]} strokeWidth={2.5} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {done && (
          <View style={styles.successCard}>
            <View style={styles.successIcon}>
              <Check size={24} color={Colors.neutral[0]} strokeWidth={3} />
            </View>
            <Text style={styles.successText}>File uploaded successfully!</Text>
            <Pressable style={styles.doneBtn} onPress={() => router.back()}>
              <Text style={styles.doneBtnText}>Back to files</Text>
            </Pressable>
          </View>
        )}

        {!done && uploading && (
          <View style={styles.uploadingCard}>
            <ActivityIndicator size="large" color={Colors.primary[600]} />
            <Text style={styles.uploadingTitle}>Uploading to laptop...</Text>
            <Text style={styles.uploadingPercentage}>{Math.round(uploadProgress * 100)}%</Text>
            
            {/* Progress Bar */}
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${Math.round(uploadProgress * 100)}%` }]} />
            </View>

            <Text style={styles.dropZoneHint}>
              You can wait here, or let it finish in the background.
            </Text>

            <Pressable style={styles.backgroundBtn} onPress={() => router.back()}>
              <Clock size={18} color={Colors.primary[600]} />
              <Text style={styles.backgroundBtnText}>Run in Background</Text>
            </Pressable>
          </View>
        )}

        {!done && !uploading && (
          <>
            {!pickedFile ? (
              <Pressable style={styles.dropZone} onPress={pickFile}>
                <UploadCloud size={56} color={Colors.neutral[300]} strokeWidth={1.5} />
                <Text style={styles.dropZoneTitle}>Select a file</Text>
                <Text style={styles.dropZoneHint}>
                  Tap to choose a file from your device to upload to your laptop
                </Text>
              </Pressable>
            ) : (
              <View style={styles.fileCard}>
                <View style={styles.fileIconWrap}>
                  <FileText size={28} color={Colors.primary[600]} strokeWidth={2} />
                </View>
                <View style={styles.fileInfo}>
                  <Text style={styles.fileName} numberOfLines={1}>{pickedFile.name}</Text>
                  <Text style={styles.fileSize}>
                    {pickedFile.size > 0 ? formatSize(pickedFile.size) : 'Unknown size'}
                  </Text>
                </View>
                <Pressable style={styles.removeBtn} onPress={() => setPickedFile(null)}>
                  <X size={18} color={Colors.neutral[400]} strokeWidth={2} />
                </Pressable>
              </View>
            )}

            {pickedFile && (
              <Pressable style={styles.uploadBtn} onPress={handleUpload}>
                <UploadCloud size={20} color={Colors.neutral[0]} strokeWidth={2} />
                <Text style={styles.uploadBtnText}>Start Upload</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </View>
  );
}

function formatSize(bytes: number): string {
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.neutral[50] },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingBottom: 12, paddingHorizontal: Spacing.md, backgroundColor: Colors.neutral[0], borderBottomWidth: 1, borderBottomColor: Colors.neutral[200], gap: 12 },
  backBtn: { padding: 4, borderRadius: Radius.sm },
  headerTitle: { flex: 1, ...Typography.h3, color: Colors.neutral[900] },
  headerSpacer: { width: 30 },
  content: { flex: 1, padding: Spacing.lg },
  
  errorBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.error[50], borderWidth: 1, borderColor: Colors.error[200], borderRadius: Radius.md, padding: 12, marginBottom: 16 },
  errorText: { flex: 1, fontSize: 14, color: Colors.error[700], fontWeight: '500' },
  
  dropZone: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, borderWidth: 2, borderColor: Colors.neutral[300], borderStyle: 'dashed', borderRadius: Radius.xl, backgroundColor: Colors.neutral[0], padding: 32 },
  dropZoneTitle: { ...Typography.h3, color: Colors.neutral[700] },
  dropZoneHint: { ...Typography.bodySmall, color: Colors.neutral[400], textAlign: 'center', maxWidth: 260 },
  
  fileCard: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: Colors.neutral[0], borderRadius: Radius.lg, padding: 16, borderWidth: 1, borderColor: Colors.neutral[200], marginBottom: 16 },
  fileIconWrap: { width: 52, height: 52, borderRadius: Radius.md, backgroundColor: Colors.primary[50], alignItems: 'center', justifyContent: 'center' },
  fileInfo: { flex: 1, gap: 4 },
  fileName: { fontSize: 15, fontWeight: '600', color: Colors.neutral[800] },
  fileSize: { fontSize: 13, color: Colors.neutral[400] },
  removeBtn: { padding: 8, borderRadius: Radius.sm },
  
  uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: Radius.lg, backgroundColor: Colors.primary[600] },
  uploadBtnText: { fontSize: 16, fontWeight: '600', color: Colors.neutral[0] },
  
  successCard: { alignItems: 'center', gap: 16, padding: 32, backgroundColor: Colors.neutral[0], borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.success[200], marginTop: 40 },
  successIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.success[500], alignItems: 'center', justifyContent: 'center' },
  successText: { ...Typography.h3, color: Colors.success[700] },
  doneBtn: { paddingVertical: 12, paddingHorizontal: 24, backgroundColor: Colors.primary[600], borderRadius: Radius.md },
  doneBtnText: { fontSize: 15, fontWeight: '600', color: Colors.neutral[0] },

  // New Uploading State Styles
  uploadingCard: { alignItems: 'center', gap: 16, padding: 32, backgroundColor: Colors.neutral[0], borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.neutral[200], marginTop: 40 },
  uploadingTitle: { ...Typography.h3, color: Colors.neutral[800], marginTop: 8 },
  uploadingPercentage: { fontSize: 32, fontWeight: '700', color: Colors.primary[600] },
  progressBarTrack: { width: '100%', height: 8, backgroundColor: Colors.neutral[100], borderRadius: 4, overflow: 'hidden', marginVertical: 8 },
  progressBarFill: { height: '100%', backgroundColor: Colors.primary[600], borderRadius: 4 },
  backgroundBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: Colors.primary[50], borderRadius: Radius.md, marginTop: 12 },
  backgroundBtnText: { fontSize: 15, fontWeight: '600', color: Colors.primary[700] },
});
