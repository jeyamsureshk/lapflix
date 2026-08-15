import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { getServerUrl } from '@/lib/storage';
import { Colors, Spacing, Typography } from '@/lib/theme';

const { width: SCREEN_W } = Dimensions.get('window');

export default function PhotoViewerScreen() {
  const params = useLocalSearchParams<{ paths: string; names: string; path?: string; name?: string; index?: string }>();

  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const [photoNames, setPhotoNames] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [serverUrl, setServerUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getServerUrl().then(setServerUrl);

    if (params.paths && params.names) {
      setPhotoPaths(params.paths.split('|'));
      setPhotoNames(params.names.split('|'));
      setActiveIndex(parseInt(params.index || '0', 10));
    } else if (params.path) {
      setPhotoPaths([params.path]);
      setPhotoNames([params.name || 'Photo']);
      setActiveIndex(0);
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <X size={24} color={Colors.neutral[0]} strokeWidth={2} />
          </Pressable>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.neutral[0]} />
        </View>
      </View>
    );
  }

  if (photoPaths.length === 0) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <X size={24} color={Colors.neutral[0]} strokeWidth={2} />
          </Pressable>
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyText}>No photo to display</Text>
        </View>
      </View>
    );
  }

  const current = photoPaths[activeIndex];
  const uri = `${serverUrl}/api/file?path=${encodeURIComponent(current)}`;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <X size={24} color={Colors.neutral[0]} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {photoNames[activeIndex]}
        </Text>
        <Text style={styles.counter}>
          {activeIndex + 1} / {photoPaths.length}
        </Text>
      </View>

      <View style={styles.imageContainer}>
        <Image
          source={{ uri }}
          style={styles.fullImage}
          resizeMode="contain"
        />

        {activeIndex > 0 && (
          <Pressable
            style={[styles.navBtn, styles.navLeft]}
            onPress={() => setActiveIndex(activeIndex - 1)}
          >
            <ChevronLeft size={28} color={Colors.neutral[0]} strokeWidth={2} />
          </Pressable>
        )}
        {activeIndex < photoPaths.length - 1 && (
          <Pressable
            style={[styles.navBtn, styles.navRight]}
            onPress={() => setActiveIndex(activeIndex + 1)}
          >
            <ChevronRight size={28} color={Colors.neutral[0]} strokeWidth={2} />
          </Pressable>
        )}
      </View>

      {/* Thumbnail strip */}
      {photoPaths.length > 1 && (
        <FlatList
          horizontal
          data={photoPaths}
          keyExtractor={(p) => p}
          style={styles.thumbStrip}
          contentContainerStyle={styles.thumbStripContent}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <Pressable
              style={[
                styles.thumb,
                index === activeIndex && styles.thumbActive,
              ]}
              onPress={() => setActiveIndex(index)}
            >
              <Image
                source={{ uri: `${serverUrl}/api/file?path=${encodeURIComponent(item)}` }}
                style={styles.thumbImage}
                resizeMode="cover"
              />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.neutral[950],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: Spacing.md,
    gap: 12,
  },
  backBtn: {
    padding: 4,
  borderRadius: 999,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[0],
  },
  counter: {
    fontSize: 14,
    color: Colors.neutral[400],
    fontWeight: '500',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: Colors.neutral[400],
    fontSize: 15,
  },
  imageContainer: {
    flex: 1,
    position: 'relative',
  },
  fullImage: {
    flex: 1,
    width: '100%',
  },
  navBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLeft: {
    left: 12,
  },
  navRight: {
    right: 12,
  },
  thumbStrip: {
    maxHeight: 80,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  thumbStripContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    overflow: 'hidden',
    opacity: 0.5,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbActive: {
    opacity: 1,
    borderColor: Colors.primary[400],
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
});
