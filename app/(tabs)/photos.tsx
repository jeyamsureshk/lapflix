import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Image as ImageIcon } from 'lucide-react-native';
import { api } from '@/lib/api';
import type { FileItem } from '@/lib/types';
import { getServerUrl } from '@/lib/storage';
import { transferManager, TransferItem } from '@/lib/transferManager';
import { Colors, Radius, Spacing, Typography } from '@/lib/theme';
import { LoadingView, ErrorView, EmptyView } from '@/components/States';
import { PromptModal } from '@/components/PromptModal';
import { ConfirmModal } from '@/components/ConfirmModal';

export default function PhotosScreen() {
  const [photos, setPhotos] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState('');

  // Live transfers subscription
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  
  // State to track exactly which tile's menu is open
  const [activeMenuPath, setActiveMenuPath] = useState<string | null>(null);

  const [menuItem, setMenuItem] = useState<FileItem | null>(null);
  const [renameModal, setRenameModal] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const collectPhotos = async (dirPath: string): Promise<FileItem[]> => {
    const res = await api.listDirectory(dirPath);
    const result: FileItem[] = [];
    for (const item of res.items) {
      if (item.type === 'photo') {
        result.push(item);
      } else if (item.type === 'folder') {
        try {
          const sub = await collectPhotos(item.path);
          result.push(...sub);
        } catch {}
      }
    }
    return result;
  };

  const loadPhotos = useCallback(async () => {
    try {
      setError(null);
      setActiveMenuPath(null); // Close menus on load
      if (!loading && !refreshing) setLoading(true);
      const url = await getServerUrl();
      setServerUrl(url);
      const all = await collectPhotos('');
      all.sort((a, b) => (b.modified || '').localeCompare(a.modified || ''));
      setPhotos(all);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load photos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loading, refreshing]);

  useEffect(() => {
    loadPhotos();

    // Subscribe to transfer updates for real-time progress across tiles
    const unsubscribe = transferManager.subscribe((activeList) => {
      setTransfers(activeList);
    });
    return () => unsubscribe();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setActiveMenuPath(null);
    loadPhotos();
  };

  const openPhoto = (index: number) => {
    setActiveMenuPath(null);
    const paths = photos.map((p) => p.path).join('|');
    const names = photos.map((p) => p.name).join('|');
    router.push({
      pathname: '/photo-viewer',
      params: { paths, names, index: String(index) },
    });
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

  if (loading && photos.length === 0) {
    return (
      <View style={styles.screen}>
        <Header />
        <LoadingView message="Scanning for photos..." />
      </View>
    );
  }

  if (error && photos.length === 0) {
    return (
      <View style={styles.screen}>
        <Header />
        <ErrorView message={error} onRetry={loadPhotos} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Header />
      <FlatList
        data={photos}
        keyExtractor={(item) => item.path}
        numColumns={3}
        contentContainerStyle={styles.grid}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <EmptyView
            icon={<ImageIcon size={48} color={Colors.neutral[300]} strokeWidth={1.5} />}
            message="No photos found on your Server"
          />
        }
        renderItem={({ item, index }) => {
          const activeDownload = transfers.find(
            (t) => t.type === 'download' && t.name === item.name && (t.status === 'active' || t.status === 'paused')
          );

          return (
            <PhotoTile
              item={item}
              serverUrl={serverUrl}
              downloadProgress={activeDownload ? activeDownload.progress : undefined}
              activeDownloadId={activeDownload ? activeDownload.id : undefined}
              isMenuOpen={activeMenuPath === item.path}
              onToggleMenu={() => setActiveMenuPath(activeMenuPath === item.path ? null : item.path)}
              onCloseMenu={() => setActiveMenuPath(null)}
              onPress={() => openPhoto(index)}
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
        title="Rename Photo"
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
        title="Delete Photo"
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

function PhotoTile({
  item,
  serverUrl,
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
  serverUrl: string;
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
    <View style={[styles.tileWrapper, isMenuOpen && { zIndex: 100, elevation: 100 }]}>
      <Pressable
        style={styles.tileInner}
        onPress={onPress}
        onLongPress={onToggleMenu}
        delayLongPress={250}
      >
        <Image
          source={{ uri: `${serverUrl}/api/file?path=${encodeURIComponent(item.path)}` }}
          style={styles.tileImage}
          resizeMode="cover"
        />
        
        {/* Absolute Light Green Download Progress Overlay */}
        {isDownloading && (
          <View style={styles.downloadOverlay}>
            <View style={[styles.downloadProgressBar, { width: `${Math.round(downloadProgress * 100)}%` }]} />
            <Text style={styles.downloadText}>{Math.round(downloadProgress * 100)}%</Text>
          </View>
        )}
      </Pressable>

      {/* Menu overlay - Opens on Long Press */}
      {isMenuOpen && (
        <>
          <Pressable style={styles.menuBackdrop} onPress={onCloseMenu} />
          <View style={styles.menu}>
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
      <Text style={styles.headerTitle}>Photos</Text>
      <Text style={styles.headerSubtitle}>All images on your Server</Text>
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
  grid: {
    padding: Spacing.sm,
    paddingBottom: 100,
  },
  
  /* Tile Layout */
  tileWrapper: {
    flex: 1 / 3,
    aspectRatio: 1,
    margin: 3,
    position: 'relative',
  },
  tileInner: {
    flex: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.neutral[200],
    position: 'relative',
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  
  /* Download Progress Indicator Over Photo */
  downloadOverlay: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 24,
    backgroundColor: 'rgba(0,0,0,0.5)', // Darker background to make text readable
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadProgressBar: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0,
    backgroundColor: '#16a34a', // Solid green bar overlay inside the black bar
    opacity: 0.8,
  },
  downloadText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.neutral[0],
    zIndex: 1,
  },

  /* Floating Context Menu */
  menuBackdrop: {
    position: 'absolute',
    top: -1000, bottom: -1000, left: -1000, right: -1000,
    zIndex: 10,
  },
  menu: {
    position: 'absolute',
    top: '20%',
    alignSelf: 'center',
    backgroundColor: Colors.neutral[0],
    borderRadius: Radius.md,
    paddingVertical: 4,
    minWidth: 140,
    zIndex: 11,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
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
    color: Colors.warning[600],
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
