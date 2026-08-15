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
import { FolderPlus, Upload, ChevronRight, Home, MoreVertical, ArrowLeft } from 'lucide-react-native';
import { api } from '@/lib/api';
import type { FileItem } from '@/lib/types';
import { formatBytes, formatDate, parentPath } from '@/lib/storage';
import { transferManager, TransferItem } from '@/lib/transferManager';
import { Colors, Radius, Spacing, Typography } from '@/lib/theme';
import { getFileIcon } from '@/components/FileIcons';
import { LoadingView, ErrorView, EmptyView } from '@/components/States';
import { PromptModal } from '@/components/PromptModal';
import { ConfirmModal } from '@/components/ConfirmModal';

export default function FilesScreen() {
  const [currentPath, setCurrentPath] = useState('');
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live transfers subscription
  const [transfers, setTransfers] = useState<TransferItem[]>([]);

  // State to track exactly which row's menu is open
  const [activeMenuPath, setActiveMenuPath] = useState<string | null>(null);

  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderError, setFolderError] = useState<string | null>(null);

  const [menuItem, setMenuItem] = useState<FileItem | null>(null);
  const [renameModal, setRenameModal] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadDir = useCallback(async (dirPath: string) => {
    try {
      setError(null);
      setActiveMenuPath(null); // Close menus on navigation
      if (!loading && !refreshing) setLoading(true);
      const res = await api.listDirectory(dirPath);
      setItems(res.items);
      setCurrentPath(res.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load files');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loading, refreshing]);

  useEffect(() => {
    loadDir('');

    const unsubscribe = transferManager.subscribe((activeList) => {
      setTransfers(activeList);
    });
    return () => unsubscribe();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setActiveMenuPath(null);
    loadDir(currentPath);
  };

  const navigateTo = (item: FileItem) => {
    setActiveMenuPath(null);
    if (item.type === 'folder') {
      loadDir(item.path);
    } else if (item.type === 'text') {
      router.push({ pathname: '/editor', params: { path: item.path, name: item.name } });
    } else if (item.type === 'photo') {
      router.push({ pathname: '/photo-viewer', params: { path: item.path, name: item.name } });
    } else if (item.type === 'video') {
      router.push({ pathname: '/player', params: { path: item.path, name: item.name } });
    }
  };

  const handleDownload = (item: FileItem) => {
    setActiveMenuPath(null);
    transferManager.startDownload(item.path, item.name);
  };

  const handleCancelDownload = (transferId: string) => {
    setActiveMenuPath(null);
    transferManager.cancelTransfer(transferId);
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      setFolderError('Please enter a folder name');
      return;
    }
    try {
      setActionLoading(true);
      setFolderError(null);
      await api.createFolder(currentPath, folderName.trim());
      setShowFolderModal(false);
      setFolderName('');
      onRefresh();
    } catch (e) {
      setFolderError(e instanceof Error ? e.message : 'Failed to create folder');
    } finally {
      setActionLoading(false);
    }
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

  const openRename = (item: FileItem) => {
    setActiveMenuPath(null);
    setMenuItem(item);
    setRenameValue(item.name);
    setRenameError(null);
    setRenameModal(true);
  };

  const openDelete = (item: FileItem) => {
    setActiveMenuPath(null);
    setMenuItem(item);
    setDeleteModal(true);
  };

  const handleUpload = () => {
    setActiveMenuPath(null);
    router.push({ pathname: '/upload', params: { path: currentPath } });
  };

  const breadcrumbs = currentPath ? currentPath.split('/').filter(Boolean) : [];

  if (loading && (!items || items.length === 0)) {
    return (
      <View style={styles.screen}>
        <Header title="Files" />
        <LoadingView message="Loading files..." />
      </View>
    );
  }

  if (error && items.length === 0) {
    return (
      <View style={styles.screen}>
        <Header title="Files" />
        <ErrorView message={error} onRetry={() => loadDir('')} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Header title="Files" />

      {/* Breadcrumb bar */}
      <View style={styles.breadcrumbBar}>
        <Pressable style={styles.crumbHome} onPress={() => loadDir('')}>
          <Home size={16} color={Colors.primary[600]} strokeWidth={2} />
        </Pressable>
        {breadcrumbs.length > 0 && <ChevronRight size={14} color={Colors.neutral[300]} />}
        {breadcrumbs.slice(-2).map((seg, i) => (
          <View key={i} style={styles.crumbItem}>
            <Text
              style={styles.crumbText}
              numberOfLines={1}
              onPress={() => {
                const idx = breadcrumbs.indexOf(seg);
                const target = breadcrumbs.slice(0, idx + 1).join('/');
                loadDir(target);
              }}
            >
              {seg}
            </Text>
            {i < Math.min(breadcrumbs.length, 2) - 1 && (
              <ChevronRight size={14} color={Colors.neutral[300]} />
            )}
          </View>
        ))}
        {breadcrumbs.length > 2 && (
          <Text style={styles.crumbEllipsis}>...</Text>
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.path}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <EmptyView
            icon={<FolderPlus size={48} color={Colors.neutral[300]} strokeWidth={1.5} />}
            message="This folder is empty"
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => {
          const activeDownload = transfers.find(
            (t) => t.type === 'download' && t.name === item.name && (t.status === 'active' || t.status === 'paused')
          );

          return (
            <FileRow
              item={item}
              downloadProgress={activeDownload ? activeDownload.progress : undefined}
              activeDownloadId={activeDownload ? activeDownload.id : undefined}
              isMenuOpen={activeMenuPath === item.path}
              onToggleMenu={() => setActiveMenuPath(activeMenuPath === item.path ? null : item.path)}
              onCloseMenu={() => setActiveMenuPath(null)}
              onPress={() => navigateTo(item)}
              onDownload={() => handleDownload(item)}
              onCancelDownload={() => activeDownload && handleCancelDownload(activeDownload.id)}
              onRename={() => openRename(item)}
              onDelete={() => openDelete(item)}
            />
          );
        }}
      />

      {/* Action buttons */}
      <View style={styles.actionBar}>
        <Pressable
          style={[styles.actionButton, styles.actionButtonPrimary]}
          onPress={() => { setFolderName(''); setFolderError(null); setShowFolderModal(true); }}
        >
          <FolderPlus size={20} color={Colors.neutral[0]} strokeWidth={2} />
          <Text style={styles.actionButtonText}>New Folder</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, styles.actionButtonSecondary]}
          onPress={handleUpload}
        >
          <Upload size={20} color={Colors.primary[600]} strokeWidth={2} />
          <Text style={[styles.actionButtonText, styles.actionButtonTextDark]}>Upload</Text>
        </Pressable>
      </View>

      <PromptModal
        visible={showFolderModal}
        title="New Folder"
        label="Folder name"
        value={folderName}
        onChangeText={setFolderName}
        onCancel={() => setShowFolderModal(false)}
        onSubmit={handleCreateFolder}
        error={folderError}
      />

      <PromptModal
        visible={renameModal}
        title="Rename"
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
        title="Delete"
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

function FileRow({
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
    // Elevation and zIndex ensure the open menu floats above everything else in the FlatList
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
          <View style={styles.iconWrap}>
            {getFileIcon(item, 24)}
          </View>
          <View style={styles.rowInfo}>
            <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
            <Text style={[styles.rowMeta, isDownloading && styles.rowMetaDownloading]}>
              {isDownloading
                ? `Downloading... ${Math.round(downloadProgress * 100)}%`
                : item.type === 'folder'
                ? 'Folder'
                : `${formatBytes(item.size)}${item.modified ? '  ·  ' + formatDate(item.modified) : ''}`}
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
          {/* An invisible backdrop that captures taps outside the menu to close it */}
          <Pressable style={styles.menuBackdrop} onPress={onCloseMenu} />
          
          <View style={styles.menu}>
            {item.type !== 'folder' && (
              activeDownloadId ? (
                <Pressable style={styles.menuItem} onPress={onCancelDownload}>
                  <Text style={[styles.menuItemText, styles.menuItemCancel]}>Cancel Download</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.menuItem} onPress={onDownload}>
                  <Text style={[styles.menuItemText, styles.menuItemDownload]}>Download</Text>
                </Pressable>
              )
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

function Header({ title }: { title: string }) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>{title}</Text>
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
    paddingBottom: 12,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.neutral[900],
  },
  breadcrumbBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    backgroundColor: Colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
    gap: 6,
  },
  crumbHome: {
    padding: 4,
    borderRadius: Radius.sm,
    marginRight: 2,
  },
  crumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 120,
  },
  crumbText: {
    fontSize: 13,
    color: Colors.primary[600],
    fontWeight: '500',
  },
  crumbEllipsis: {
    fontSize: 13,
    color: Colors.neutral[400],
    marginHorizontal: 2,
  },
  list: {
    padding: Spacing.md,
    paddingBottom: 100,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.neutral[100],
    marginLeft: 56,
  },
  
  /* Row Container Restructured */
  rowContainer: {
    position: 'relative',
    borderRadius: Radius.md,
    // NO overflow: hidden here, so the menu can float outside safely
  },
  rowBackground: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.md,
    overflow: 'hidden', // Overflow hidden ONLY for the green progress bar
  },
  rowProgressBar: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0,
    backgroundColor: '#dcfce7',
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
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.neutral[800],
  },
  rowMeta: {
    fontSize: 12,
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
  
  /* Menu Dropdown Fixes */
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
    color: Colors.warning[600],
    fontWeight: '600',
  },
  menuItemDanger: {},
  menuItemTextDanger: {
    color: Colors.error[600],
  },
  
  /* Footer Actions */
  actionBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    flexDirection: 'row',
    gap: 12,
    padding: Spacing.md,
    paddingBottom: 80,
    backgroundColor: Colors.neutral[0],
    borderTopWidth: 1,
    borderTopColor: Colors.neutral[200],
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: Radius.lg,
  },
  actionButtonPrimary: {
    backgroundColor: Colors.primary[600],
  },
  actionButtonSecondary: {
    backgroundColor: Colors.primary[50],
    borderWidth: 1.5,
    borderColor: Colors.primary[200],
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.neutral[0],
  },
  actionButtonTextDark: {
    color: Colors.primary[600],
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(16, 24, 40, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
