import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Video as VideoIcon, Film } from 'lucide-react-native';
import { api } from '@/lib/api';
import type { FileItem } from '@/lib/types';
import { formatBytes } from '@/lib/storage';
import { Colors, Radius, Spacing, Typography } from '@/lib/theme';
import { LoadingView, ErrorView, EmptyView } from '@/components/States';

export default function VideosScreen() {
  const [videos, setVideos] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  }, []);

  useEffect(() => {
    loadVideos();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadVideos();
  };

  const playVideo = (item: FileItem) => {
    router.push({ pathname: '/player', params: { path: item.path, name: item.name } });
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
            message="No videos found on your laptop"
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <Pressable style={styles.videoRow} onPress={() => playVideo(item)}>
            <View style={styles.thumbWrap}>
              <VideoIcon size={28} color={Colors.warning[600]} strokeWidth={1.5} />
            </View>
            <View style={styles.videoInfo}>
              <Text style={styles.videoName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.videoMeta}>{formatBytes(item.size)}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Videos</Text>
      <Text style={styles.headerSubtitle}>Stream videos from your laptop</Text>
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
  videoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: Radius.md,
  },
  thumbWrap: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.warning[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoInfo: {
    flex: 1,
    gap: 4,
  },
  videoName: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.neutral[800],
  },
  videoMeta: {
    fontSize: 13,
    color: Colors.neutral[400],
  },
});
