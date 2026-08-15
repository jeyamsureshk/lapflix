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
import { Colors, Radius, Spacing, Typography } from '@/lib/theme';
import { LoadingView, ErrorView, EmptyView } from '@/components/States';

export default function PhotosScreen() {
  const [photos, setPhotos] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState('');

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
  }, []);

  useEffect(() => {
    loadPhotos();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadPhotos();
  };

  const openPhoto = (index: number) => {
    const paths = photos.map((p) => p.path).join('|');
    const names = photos.map((p) => p.name).join('|');
    router.push({
      pathname: '/photo-viewer',
      params: { paths, names, index: String(index) },
    });
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
            message="No photos found on your laptop"
          />
        }
        renderItem={({ item, index }) => (
          <Pressable
            style={styles.tile}
            onPress={() => openPhoto(index)}
          >
            <Image
              source={{ uri: `${serverUrl}/api/file?path=${encodeURIComponent(item.path)}` }}
              style={styles.tileImage}
              resizeMode="cover"
            />
          </Pressable>
        )}
      />
    </View>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Photos</Text>
      <Text style={styles.headerSubtitle}>All images on your laptop</Text>
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
  tile: {
    flex: 1 / 3,
    margin: 3,
    aspectRatio: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.neutral[100],
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
});
