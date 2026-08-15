import { useEffect, useState, useRef, useMemo } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  PanResponder,
  StatusBar,
  Alert,
  Dimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  X,
  Maximize,
  Smartphone,
  Monitor,
  Sun,
  Volume2,
  Expand,
  Download,
  Clock,
} from 'lucide-react-native';
import { Video, ResizeMode, Audio, AVPlaybackStatus } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Brightness from 'expo-brightness';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getServerUrl } from '@/lib/storage';
import { Colors, Spacing } from '@/lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const formatTime = (millis: number) => {
  const totalSeconds = Math.floor(millis / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;

  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export default function PlayerScreen() {
  const params = useLocalSearchParams<{
    path: string;
    name: string;
  }>();

  const [serverUrl, setServerUrl] = useState<string | null>(null);

  // Player
  const videoRef = useRef<Video>(null);

  const [resizeMode, setResizeMode] = useState<ResizeMode>(
    ResizeMode.CONTAIN
  );

  const [isLandscape, setIsLandscape] = useState(false);

  // Hardware / video
  const [volume, setVolume] = useState(1);
  const [brightness, setBrightness] = useState(0.5);

  const positionRef = useRef(0);
  const durationRef = useRef(0);

  // UI
  const [indicator, setIndicator] = useState<{
    type: 'brightness' | 'volume';
    value: number;
  } | null>(null);

  const [seekTarget, setSeekTarget] = useState<number | null>(null);

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Gesture refs
  const startX = useRef(0);
  const startY = useRef(0);

  const startBrightness = useRef(0);
  const startVolume = useRef(0);
  const startPos = useRef(0);

  const gestureType = useRef<
    'seek' | 'brightness' | 'volume' | null
  >(null);

  const indicatorTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Prevent excessive native calls during gestures
  const lastVolumeUpdate = useRef(0);
  const lastBrightnessUpdate = useRef(0);

  /**
   * ---------------------------------------------------------
   * FAST INITIALIZATION
   * ---------------------------------------------------------
   *
   * Server URL is the only thing required before the player
   * can start.
   *
   * Brightness/audio initialization happens independently
   * and does NOT block video startup.
   */
  useEffect(() => {
    let mounted = true;

    // Load server URL immediately.
    getServerUrl()
      .then((url) => {
        if (!mounted) return;

        if (url) {
          setServerUrl(url);
        }
      })
      .catch((error) => {
        console.error('Failed to get server URL:', error);
      });

    // Audio setup runs independently.
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
    }).catch((error) => {
      console.warn('Audio setup failed:', error);
    });

    // Brightness setup should NEVER block video loading.
    const loadBrightness = async () => {
      try {
        const { status } =
          await Brightness.requestPermissionsAsync();

        if (status !== 'granted' || !mounted) return;

        const currentBrightness =
          await Brightness.getBrightnessAsync();

        if (mounted) {
          setBrightness(currentBrightness);
        }
      } catch (error) {
        console.warn('Brightness initialization failed:', error);
      }
    };

    loadBrightness();

    return () => {
      mounted = false;

      if (indicatorTimeout.current) {
        clearTimeout(indicatorTimeout.current);
        indicatorTimeout.current = null;
      }

      ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.DEFAULT
      ).catch(() => {});
    };
  }, []);

  /**
   * ---------------------------------------------------------
   * STREAM URL
   * ---------------------------------------------------------
   *
   * useMemo prevents rebuilding the URL on unrelated renders.
   */
  const streamUrl = useMemo(() => {
    if (!serverUrl || !params.path) {
      return null;
    }

    return `${serverUrl}/api/stream?path=${encodeURIComponent(
      params.path
    )}`;
  }, [serverUrl, params.path]);

  /**
   * ---------------------------------------------------------
   * PLAYBACK STATUS
   * ---------------------------------------------------------
   */
  const onPlaybackStatusUpdate = (
    status: AVPlaybackStatus
  ) => {
    if (!status.isLoaded) return;

    positionRef.current = status.positionMillis;
    durationRef.current = status.durationMillis || 0;
  };

  /**
   * ---------------------------------------------------------
   * INDICATOR
   * ---------------------------------------------------------
   */
  const showIndicator = (
    type: 'brightness' | 'volume',
    value: number
  ) => {
    setIndicator({
      type,
      value,
    });

    if (indicatorTimeout.current) {
      clearTimeout(indicatorTimeout.current);
    }

    indicatorTimeout.current = setTimeout(() => {
      setIndicator(null);
    }, 900);
  };

  /**
   * ---------------------------------------------------------
   * RESIZE
   * ---------------------------------------------------------
   */
  const toggleResizeMode = () => {
    setResizeMode((prev) =>
      prev === ResizeMode.CONTAIN
        ? ResizeMode.COVER
        : ResizeMode.CONTAIN
    );
  };

  /**
   * ---------------------------------------------------------
   * ORIENTATION
   * ---------------------------------------------------------
   */
  const toggleOrientation = async () => {
    try {
      if (isLandscape) {
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP
        );
      } else {
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.LANDSCAPE
        );
      }

      setIsLandscape((prev) => !prev);
    } catch (error) {
      console.warn('Orientation change failed:', error);
    }
  };

  /**
   * ---------------------------------------------------------
   * DOWNLOAD
   * ---------------------------------------------------------
   */
  const handleDownload = async () => {
    if (!serverUrl || isDownloading || !params.path) {
      return;
    }

    try {
      setIsDownloading(true);
      setDownloadProgress(0);

      const downloadUrl =
        `${serverUrl}/api/stream?path=` +
        encodeURIComponent(params.path);

      const safeFileName = params.name
        ? params.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
        : 'video.mp4';

      const fileUri =
        `${FileSystem.documentDirectory}${safeFileName}`;

      const downloadResumable =
        FileSystem.createDownloadResumable(
          downloadUrl,
          fileUri,
          {},
          (progressEvent) => {
            if (
              progressEvent.totalBytesExpectedToWrite <= 0
            ) {
              return;
            }

            const progress =
              progressEvent.totalBytesWritten /
              progressEvent.totalBytesExpectedToWrite;

            setDownloadProgress(progress);
          }
        );

      const result =
        await downloadResumable.downloadAsync();

      if (!result?.uri) return;

      const isAvailable =
        await Sharing.isAvailableAsync();

      if (isAvailable) {
        await Sharing.shareAsync(result.uri, {
          dialogTitle: `Save ${params.name}`,
        });
      } else {
        Alert.alert(
          'Success',
          'File downloaded, but sharing is not supported on this device.'
        );
      }
    } catch (error) {
      console.error('Download error:', error);

      Alert.alert(
        'Download Failed',
        'There was an error downloading the file.'
      );
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  /**
   * ---------------------------------------------------------
   * SMART GESTURES
   * ---------------------------------------------------------
   */
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          Math.abs(gestureState.dx) > 15 ||
          Math.abs(gestureState.dy) > 15
        );
      },

      onPanResponderGrant: (evt) => {
        startX.current = evt.nativeEvent.pageX;
        startY.current = evt.nativeEvent.pageY;

        startBrightness.current = brightness;
        startVolume.current = volume;

        startPos.current = positionRef.current;

        gestureType.current = null;
      },

      onPanResponderMove: (evt, gestureState) => {
        if (!gestureType.current) {
          if (
            Math.abs(gestureState.dx) >
            Math.abs(gestureState.dy)
          ) {
            gestureType.current = 'seek';
          } else {
            gestureType.current =
              startX.current < SCREEN_WIDTH / 2
                ? 'brightness'
                : 'volume';
          }
        }

        /**
         * SEEK
         */
        if (gestureType.current === 'seek') {
          let newPos =
            startPos.current +
            gestureState.dx * 200;

          newPos = Math.max(
            0,
            Math.min(
              newPos,
              durationRef.current
            )
          );

          setSeekTarget(newPos);
          return;
        }

        /**
         * BRIGHTNESS
         */
        if (gestureType.current === 'brightness') {
          const dy =
            startY.current -
            evt.nativeEvent.pageY;

          const newVal = Math.max(
            0,
            Math.min(
              1,
              startBrightness.current +
                dy / 300
            )
          );

          setBrightness(newVal);
          showIndicator('brightness', newVal);

          // Don't call native API on every single
          // gesture event.
          const now = Date.now();

          if (
            now - lastBrightnessUpdate.current >
            40
          ) {
            lastBrightnessUpdate.current = now;

            Brightness.setBrightnessAsync(
              newVal
            ).catch(() => {});
          }

          return;
        }

        /**
         * VOLUME
         */
        if (gestureType.current === 'volume') {
          const dy =
            startY.current -
            evt.nativeEvent.pageY;

          const newVal = Math.max(
            0,
            Math.min(
              1,
              startVolume.current +
                dy / 300
            )
          );

          setVolume(newVal);
          showIndicator('volume', newVal);

          const now = Date.now();

          if (
            now - lastVolumeUpdate.current >
            40
          ) {
            lastVolumeUpdate.current = now;

            videoRef.current
              ?.setVolumeAsync(newVal)
              .catch(() => {});
          }
        }
      },

      onPanResponderRelease: () => {
        if (
          gestureType.current === 'seek'
        ) {
          const target = seekTarget;

          if (target !== null) {
            videoRef.current
              ?.setPositionAsync(target)
              .catch(() => {});
          }
        }

        setSeekTarget(null);
        gestureType.current = null;
      },

      onPanResponderTerminate: () => {
        setSeekTarget(null);
        gestureType.current = null;
      },
    })
  ).current;

  /**
   * ---------------------------------------------------------
   * LOADING SCREEN
   * ---------------------------------------------------------
   */
  if (!streamUrl) {
    return (
      <View style={styles.screen}>
        <View
          style={[
            styles.header,
            styles.floatingHeader,
          ]}
        >
          <Pressable
            style={styles.iconBtn}
            onPress={() => router.back()}
          >
            <X
              size={24}
              color={Colors.neutral[0]}
            />
          </Pressable>

          <Text
            style={styles.headerTitle}
            numberOfLines={1}
          >
            {params.name}
          </Text>
        </View>

        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color={Colors.neutral[0]}
          />

          <Text style={styles.loadingText}>
            Loading video...
          </Text>
        </View>
      </View>
    );
  }

  /**
   * ---------------------------------------------------------
   * PLAYER
   * ---------------------------------------------------------
   */
  return (
    <View style={styles.screen}>
      <StatusBar hidden={isLandscape} />

      <Video
        ref={videoRef}
        source={{
          uri: streamUrl,
        }}
        style={StyleSheet.absoluteFill}
        resizeMode={resizeMode}
        useNativeControls
        shouldPlay
        volume={volume}
        progressUpdateIntervalMillis={500}
        onPlaybackStatusUpdate={
          onPlaybackStatusUpdate
        }
      />

      {/* Header */}
      <View
        style={[
          styles.header,
          styles.floatingHeader,
        ]}
      >
        <Pressable
          style={styles.iconBtn}
          onPress={() => router.back()}
        >
          <X
            size={24}
            color={Colors.neutral[0]}
          />
        </Pressable>

        <Text
          style={styles.headerTitle}
          numberOfLines={1}
        >
          {params.name}
        </Text>

        <View style={styles.headerActions}>
          {/* Download */}
          <Pressable
            style={styles.iconBtn}
            onPress={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <View
                style={
                  styles.downloadProgressWrap
                }
              >
                <ActivityIndicator
                  size="small"
                  color={Colors.neutral[0]}
                />

                {downloadProgress > 0 && (
                  <Text
                    style={
                      styles.downloadProgressText
                    }
                  >
                    {Math.round(
                      downloadProgress * 100
                    )}
                    %
                  </Text>
                )}
              </View>
            ) : (
              <Download
                size={22}
                color={Colors.neutral[0]}
              />
            )}
          </Pressable>

          {/* Resize */}
          <Pressable
            style={styles.iconBtn}
            onPress={toggleResizeMode}
          >
            {resizeMode ===
            ResizeMode.CONTAIN ? (
              <Maximize
                size={22}
                color={Colors.neutral[0]}
              />
            ) : (
              <Expand
                size={22}
                color={Colors.neutral[0]}
              />
            )}
          </Pressable>

          {/* Orientation */}
          <Pressable
            style={styles.iconBtn}
            onPress={toggleOrientation}
          >
            {isLandscape ? (
              <Smartphone
                size={22}
                color={Colors.neutral[0]}
              />
            ) : (
              <Monitor
                size={22}
                color={Colors.neutral[0]}
              />
            )}
          </Pressable>
        </View>
      </View>

      {/* Gesture Area */}
      <View
        style={styles.gestureOverlay}
        {...panResponder.panHandlers}
      />

      {/* Indicator */}
      {indicator && (
        <View
          style={styles.indicatorWrap}
          pointerEvents="none"
        >
          <View style={styles.indicatorPill}>
            {indicator.type ===
            'brightness' ? (
              <Sun
                size={28}
                color={Colors.neutral[0]}
              />
            ) : (
              <Volume2
                size={28}
                color={Colors.neutral[0]}
              />
            )}

            <Text
              style={styles.indicatorText}
            >
              {Math.round(
                indicator.value * 100
              )}
              %
            </Text>
          </View>
        </View>
      )}

      {/* Seek Indicator */}
      {seekTarget !== null && (
        <View
          style={styles.indicatorWrap}
          pointerEvents="none"
        >
          <View style={styles.indicatorPill}>
            <Clock
              size={28}
              color={Colors.neutral[0]}
            />

            <Text
              style={styles.indicatorText}
            >
              {formatTime(seekTarget)} /{' '}
              {formatTime(
                durationRef.current
              )}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.neutral[950],
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: 12,
    color: Colors.neutral[0],
    fontSize: 14,
    opacity: 0.7,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop:
      Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 16,
    paddingHorizontal: Spacing.md,
    gap: 16,
    zIndex: 20,
  },

  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor:
      'rgba(0, 0, 0, 0.4)',
  },

  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[0],
  },

  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },

  iconBtn: {
    padding: 8,
    borderRadius: 999,
    backgroundColor:
      'rgba(255, 255, 255, 0.1)',
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  downloadProgressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  downloadProgressText: {
    color: Colors.neutral[0],
    fontSize: 10,
    fontWeight: '700',
  },

  gestureOverlay: {
    position: 'absolute',
    top: '15%',
    left: 0,
    right: 0,
    bottom: '25%',
    zIndex: 10,
  },

  indicatorWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },

  indicatorPill: {
    backgroundColor:
      'rgba(0, 0, 0, 0.7)',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    gap: 8,
  },

  indicatorText: {
    color: Colors.neutral[0],
    fontSize: 16,
    fontWeight: '700',
  },
});
