import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Video as VideoIcon, Film, MoreVertical } from 'lucide-react-native';
import { api } from '@/lib/api';
import type { FileItem } from '@/lib/types';
import { formatBytes } from '@/lib/storage';
import { transferManager, TransferItem } from '@/lib/transferManager';
import { Colors, Radius, Spacing, Typography } from '@/lib/theme';
import { LoadingView, ErrorView, EmptyView } from '@/components/States';
import { PromptModal } from '@/components/PromptModal';
import { ConfirmModal } from '@/components/ConfirmModal';

export default function VideosScreen() {
  const [videos, setVideos] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live transfers subscription
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  
  // State to track exactly which row's menu is open
  const [activeMenuPath, setActiveMenuPath] = useState<string | null>(null);

  const [menuItem, setMenuItem] = useState<FileItem | null>(null);
  const [renameModal, setRenameModal] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const collectVideos = async (dirPath: string): Promise<FileItem[]> => {
    const res = await api.listDirectory(dirPath);
    const result: FileItem[] = [];
    for (const item of res.items) {
      if (item.type === 'video') {
        result.push(item);
      } else if (item.type === 'folder') {
        try {
          const sub = await collectVideos(item.path);
          result.push(...sub);
        } catch {}
      }
    }
    return result;
  };

  const loadVideos = useCallback(async () => {
    try {
      setError(null);
      setActiveMenuPath(null); // Close menus on navigation/load
      if (!loading && !refreshing) setLoading(true);
      const all = await collectVideos('');
      all.sort((a, b) => (b.modified || '').localeCompare(a.modified || ''));
      setVideos(all);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load videos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loading, refreshing]);

  useEffect(() => {
    loadVideos();

    // Subscribe to transfer updates for real-time progress across rows
    const unsubscribe = transferManager.subscribe((activeList) => {
      setTransfers(activeList);
    });
    return () => unsubscribe();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setActiveMenuPath(null);
    loadVideos();
  };

  const playVideo = (item: FileItem) => {
    setActiveMenuPath(null);
    router.push({ pathname: '/player', params: { path: item.path, name: item.name } });
  };

  const handleDownload = (item: FileItem) => {
    setActiveMenuPath(null);
    transferManager.startDownload(item.path, item.name);
  };

  const handleCancelDownload = (transferId: string) => {
    setActiveMenuPath(null);
    transferManager.cancelTransfer(transferId);
  };

  const openRename = (item: FileItem) => {
    setActiveMenuPath(null);
    setMenuItem(item);
    setRenameValue(item.name);
    setRenameError(null);
    setRenameModal(true);
  };

  const handleRename = async () => {
    if (!menuItem || !renameValue.trim()) {
      setRenameError('Please enter a name');
      return;
    }
    try {
      setActionLoading(true);
      setRenameError(null);
      await api.renameItem(menuItem.path, renameValue.trim());
      setRenameModal(false);
      setMenuItem(null);
      onRefresh();
    } catch (e) {
      setRenameError(e instanceof Error ? e.message : 'Failed to rename');
    } finally {
      setActionLoading(false);
    }
  };

  const openDelete = (item: FileItem) => {
    setActiveMenuPath(null);
    setMenuItem(item);
    setDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!menuItem) return;
    try {
      setActionLoading(true);
      await api.deleteItem(menuItem.path);
      setDeleteModal(false);
      setMenuItem(null);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && videos.length === 0) {
    return (
      <View style={styles.screen}>
        <Header />
        <LoadingView message="Scanning for videos..." />
      </View>
    );
  }

  if (error && videos.length === 0) {
    return (
      <View style={styles.screen}>
        <Header />
        <ErrorView message={error} onRetry={loadVideos} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Header />
      <FlatList
        data={videos}
        keyExtractor={(item) => item.path}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <EmptyView
            icon={<Film size={48} color={Colors.neutral[300]} strokeWidth={1.5} />}
            message="No videos found on your Server"
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => {
          // Check if this specific item is currently downloading or paused
          const activeDownload = transfers.find(
            (t) => t.type === 'download' && t.name === item.name && (t.status === 'active' || t.status === 'paused')
          );

          return (
            <VideoRow
              item={item}
              downloadProgress={activeDownload ? activeDownload.progress : undefined}
              activeDownloadId={activeDownload ? activeDownload.id : undefined}
              isMenuOpen={activeMenuPath === item.path}
              onToggleMenu={() => setActiveMenuPath(activeMenuPath === item.path ? null : item.path)}
              onCloseMenu={() => setActiveMenuPath(null)}
              onPress={() => playVideo(item)}
              onDownload={() => handleDownload(item)}
              onCancelDownload={() => activeDownload && handleCancelDownload(activeDownload.id)}
              onRename={() => openRename(item)}
              onDelete={() => openDelete(item)}
            />
          );
        }}
      />

      <PromptModal
        visible={renameModal}
        title="Rename Video"
        label="New name"
        value={renameValue}
        onChangeText={setRenameValue}
        onCancel={() => { setRenameModal(false); setMenuItem(null); }}
        onSubmit={handleRename}
        submitLabel="Rename"
        error={renameError}
      />

      <ConfirmModal
        visible={deleteModal}
        title="Delete Video"
        message={`Are you sure you want to delete "${menuItem?.name}"? This cannot be undone.`}
        onCancel={() => { setDeleteModal(false); setMenuItem(null); }}
        onConfirm={handleDelete}
        confirmLabel="Delete"
        danger
      />

      {actionLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.primary[500]} />
        </View>
      )}
    </View>
  );
}

function VideoRow({
  item,
  downloadProgress,
  activeDownloadId,
  isMenuOpen,
  onToggleMenu,
  onCloseMenu,
  onPress,
  onDownload,
  onCancelDownload,
  onRename,
  onDelete,
}: {
  item: FileItem;
  downloadProgress?: number;
  activeDownloadId?: string;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onPress: () => void;
  onDownload: () => void;
  onCancelDownload: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const isDownloading = downloadProgress !== undefined;

  return (
    <View style={[styles.rowContainer, isMenuOpen && { zIndex: 100, elevation: 100 }]}>
      
      {/* Background Layer with hidden overflow for the progress bar */}
      <View style={styles.rowBackground}>
        {isDownloading && (
          <View
            style={[
              styles.rowProgressBar,
              { width: `${Math.round(downloadProgress * 100)}%` },
            ]}
          />
        )}
      </View>

      <View style={styles.rowMain}>
        <Pressable style={styles.rowContent} onPress={onPress}>
          <View style={styles.thumbWrap}>
            <VideoIcon size={28} color={Colors.warning[600]} strokeWidth={1.5} />
          </View>
          <View style={styles.rowInfo}>
            <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
            <Text style={[styles.rowMeta, isDownloading && styles.rowMetaDownloading]}>
              {isDownloading
                ? `Downloading... ${Math.round(downloadProgress * 100)}%`
                : formatBytes(item.size)}
            </Text>
          </View>
        </Pressable>

        <Pressable style={styles.menuBtn} onPress={onToggleMenu}>
          <MoreVertical size={20} color={Colors.neutral[400]} strokeWidth={2} />
        </Pressable>
      </View>

      {/* Menu overlay - Only shown if this specific row is active */}
      {isMenuOpen && (
        <>
          <Pressable style={styles.menuBackdrop} onPress={onCloseMenu} />
          <View style={styles.menu}>
            
            {/* Toggle Download / Cancel Download dynamically */}
            {activeDownloadId ? (
              <Pressable style={styles.menuItem} onPress={onCancelDownload}>
                <Text style={[styles.menuItemText, styles.menuItemCancel]}>Cancel Download</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.menuItem} onPress={onDownload}>
                <Text style={[styles.menuItemText, styles.menuItemDownload]}>Download</Text>
              </Pressable>
            )}

            <Pressable style={styles.menuItem} onPress={onRename}>
              <Text style={styles.menuItemText}>Rename</Text>
            </Pressable>
            <Pressable style={[styles.menuItem, styles.menuItemDanger]} onPress={onDelete}>
              <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>Delete</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Videos</Text>
      <Text style={styles.headerSubtitle}>Stream videos from your Server</Text>
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
  list: {
    padding: Spacing.md,
    paddingBottom: 100,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.neutral[100],
    marginLeft: 72,
  },

  /* Row Container Restructured */
  rowContainer: {
    position: 'relative',
    borderRadius: Radius.md,
  },
  rowBackground: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  rowProgressBar: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0,
    backgroundColor: '#dcfce7', // Light green
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  thumbWrap: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.warning[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: {
    flex: 1,
    gap: 4,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.neutral[800],
  },
  rowMeta: {
    fontSize: 13,
    color: Colors.neutral[400],
  },
  rowMetaDownloading: {
    color: '#16a34a',
    fontWeight: '600',
  },
  menuBtn: {
    padding: 8,
    borderRadius: Radius.sm,
  },

  /* Menu Dropdown */
  menuBackdrop: {
    position: 'absolute',
    top: -1000, bottom: -1000, left: -1000, right: -1000,
    zIndex: 10,
  },
  menu: {
    position: 'absolute',
    right: 8,
    top: 48,
    backgroundColor: Colors.neutral[0],
    borderRadius: Radius.md,
    paddingVertical: 4,
    minWidth: 140,
    zIndex: 11,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  menuItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  menuItemText: {
    fontSize: 14,
    color: Colors.neutral[700],
    fontWeight: '500',
  },
  menuItemDownload: {
    color: Colors.primary[600],
    fontWeight: '600',
  },
  menuItemCancel: {
    color: Colors.warning[600], // Shows as a distinct warning color when cancelling
    fontWeight: '600',
  },
  menuItemDanger: {},
  menuItemTextDanger: {
    color: Colors.error[600],
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(16, 24, 40, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
