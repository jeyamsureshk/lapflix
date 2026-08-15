import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  PanResponder,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Expand,
  Lock,
  Maximize,
  Monitor,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Smartphone,
  Sun,
  Unlock,
  Volume2,
  VolumeX,
} from 'lucide-react-native';
import { Video, ResizeMode, Audio, AVPlaybackStatus } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Brightness from 'expo-brightness';
import { getServerUrl } from '@/lib/storage';
import { Colors } from '@/lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const formatTime = (millis: number) => {
  const totalSeconds = Math.max(0, Math.floor(millis / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) {
    return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
};

export default function PlayerScreen() {
  const params = useLocalSearchParams<{ path: string; name: string }>();
  const videoRef = useRef<Video>(null);

  // Core State
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [isLandscape, setIsLandscape] = useState(false);
  const [resizeMode, setResizeMode] = useState<ResizeMode>(ResizeMode.CONTAIN);
  const [isLocked, setIsLocked] = useState(false);
  
  // Playback State
  const [isPlaying, setIsPlaying] = useState(true);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedPosition, setBufferedPosition] = useState(0);

  // Hardware State
  const [volume, setVolume] = useState(1);
  const [brightness, setBrightness] = useState(0.5);

  // UI State
  const [controlsVisible, setControlsVisible] = useState(true);
  const [seekTarget, setSeekTarget] = useState<number | null>(null);
  const [indicator, setIndicator] = useState<{ type: 'brightness' | 'volume' | 'seek'; value: number } | null>(null);
  const [doubleTapFeedback, setDoubleTapFeedback] = useState<'left' | 'right' | null>(null);

  // Refs for smooth pan responder tracking
  const positionRef = useRef(0);
  const durationRef = useRef(0);
  const volumeRef = useRef(1);
  const brightnessRef = useRef(0.5);

  // Timeout Refs
  const controlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const indicatorTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doubleTapTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const singleTapTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Gesture Tracking
  const startX = useRef(0);
  const startY = useRef(0);
  const startBrightness = useRef(0);
  const startVolume = useRef(0);
  const startPos = useRef(0);
  const gestureType = useRef<'seek' | 'brightness' | 'volume' | null>(null);
  const startTime = useRef(0);
  const lastTap = useRef(0);
  
  const lastVolumeUpdate = useRef(0);
  const lastBrightnessUpdate = useRef(0);
  const progressBarWidth = useRef(0);

  // --- INITIALIZATION ---
  useEffect(() => {
    let mounted = true;

    getServerUrl()
      .then((url) => { if (mounted && url) setServerUrl(url); })
      .catch((err) => console.error('Server URL Error:', err));

    Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {});

    Brightness.requestPermissionsAsync().then(({ status }) => {
      if (status === 'granted' && mounted) {
        Brightness.getBrightnessAsync().then((val) => {
          if (mounted) {
            setBrightness(val);
            brightnessRef.current = val;
          }
        });
      }
    });

    startControlsTimer();

    return () => {
      mounted = false;
      clearTimeout(controlsTimeout.current!);
      clearTimeout(indicatorTimeout.current!);
      clearTimeout(doubleTapTimeout.current!);
      clearTimeout(singleTapTimeout.current!);
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.DEFAULT).catch(() => {});
    };
  }, []);

  const streamUrl = useMemo(() => {
    if (!serverUrl || !params.path) return null;
    return `${serverUrl}/api/stream?path=${encodeURIComponent(params.path)}`;
  }, [serverUrl, params.path]);

  // --- CONTROLS VISIBILITY ---
  const startControlsTimer = useCallback(() => {
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => setControlsVisible(false), 3500);
  }, []);

  const toggleControls = () => {
    setControlsVisible((prev) => {
      if (!prev) startControlsTimer();
      else if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
      return !prev;
    });
  };

  // --- PLAYBACK ---
  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    positionRef.current = status.positionMillis;
    durationRef.current = status.durationMillis || 0;
    setPosition(status.positionMillis);
    setDuration(status.durationMillis || 0);
    setBufferedPosition(status.playableDurationMillis || 0);
    setIsPlaying(status.isPlaying);
  };

  const togglePlayPause = () => {
    if (isPlaying) videoRef.current?.pauseAsync();
    else videoRef.current?.playAsync();
    startControlsTimer();
  };

  const seekBy = (amount: number) => {
    const target = Math.max(0, Math.min(durationRef.current, positionRef.current + amount));
    videoRef.current?.setPositionAsync(target);
    positionRef.current = target;
    setPosition(target);
    startControlsTimer();
  };

  const seekTo = (target: number) => {
    const safeTarget = Math.max(0, Math.min(durationRef.current, target));
    videoRef.current?.setPositionAsync(safeTarget);
    positionRef.current = safeTarget;
    setPosition(safeTarget);
    startControlsTimer();
  };

  // --- ACTIONS ---
  const cycleResizeMode = () => {
    setResizeMode((prev) => {
      if (prev === ResizeMode.CONTAIN) return ResizeMode.COVER;
      if (prev === ResizeMode.COVER) return ResizeMode.STRETCH;
      return ResizeMode.CONTAIN;
    });
    startControlsTimer();
  };

  const toggleOrientation = async () => {
    try {
      if (isLandscape) await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      else await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      setIsLandscape(!isLandscape);
      startControlsTimer();
    } catch (e) {}
  };

  const toggleLock = () => {
    setIsLocked(!isLocked);
    startControlsTimer();
  };

  // --- UI INDICATORS ---
  const showIndicator = (type: 'brightness' | 'volume' | 'seek', value: number) => {
    setIndicator({ type, value });
    if (indicatorTimeout.current) clearTimeout(indicatorTimeout.current);
    indicatorTimeout.current = setTimeout(() => setIndicator(null), 800);
  };

  const showDoubleTapFeedback = (side: 'left' | 'right') => {
    setDoubleTapFeedback(side);
    if (doubleTapTimeout.current) clearTimeout(doubleTapTimeout.current);
    doubleTapTimeout.current = setTimeout(() => setDoubleTapFeedback(null), 600);
  };

  // --- TAP & GESTURE HANDLER ---
  const handleTap = (evt: any) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      // Double Tap Registered
      clearTimeout(singleTapTimeout.current!);
      if (!isLocked) {
        const x = evt.nativeEvent.pageX;
        if (x < SCREEN_WIDTH / 2) {
          seekBy(-10000);
          showDoubleTapFeedback('left');
        } else {
          seekBy(10000);
          showDoubleTapFeedback('right');
        }
      }
      lastTap.current = 0; 
    } else {
      // Single Tap 
      lastTap.current = now;
      singleTapTimeout.current = setTimeout(() => {
        toggleControls();
      }, DOUBLE_TAP_DELAY);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (isLocked) return false;
        return Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10;
      },
      onPanResponderGrant: (evt) => {
        startTime.current = Date.now();
        startX.current = evt.nativeEvent.pageX;
        startY.current = evt.nativeEvent.pageY;
        startBrightness.current = brightnessRef.current;
        startVolume.current = volumeRef.current;
        startPos.current = positionRef.current;
        gestureType.current = null;
        if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
      },
      onPanResponderMove: (evt, gestureState) => {
        if (isLocked) return;

        if (!gestureType.current) {
          if (Math.abs(gestureState.dx) > Math.abs(gestureState.dy)) {
            gestureType.current = 'seek';
          } else {
            gestureType.current = startX.current < SCREEN_WIDTH / 2 ? 'brightness' : 'volume';
          }
        }

        if (gestureType.current === 'seek') {
          let newPos = startPos.current + gestureState.dx * 150; // Drag sensitivity
          newPos = Math.max(0, Math.min(newPos, durationRef.current));
          setSeekTarget(newPos);
          showIndicator('seek', newPos);
          return;
        }

        const dy = startY.current - evt.nativeEvent.pageY;

        if (gestureType.current === 'brightness') {
          const newVal = Math.max(0, Math.min(1, startBrightness.current + dy / 250));
          setBrightness(newVal);
          brightnessRef.current = newVal;
          showIndicator('brightness', newVal);
          
          const now = Date.now();
          if (now - lastBrightnessUpdate.current > 40) {
            lastBrightnessUpdate.current = now;
            Brightness.setBrightnessAsync(newVal).catch(() => {});
          }
          return;
        }

        if (gestureType.current === 'volume') {
          const newVal = Math.max(0, Math.min(1, startVolume.current + dy / 250));
          setVolume(newVal);
          volumeRef.current = newVal;
          showIndicator('volume', newVal);

          const now = Date.now();
          if (now - lastVolumeUpdate.current > 40) {
            lastVolumeUpdate.current = now;
            videoRef.current?.setVolumeAsync(newVal).catch(() => {});
          }
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        const timeDiff = Date.now() - startTime.current;
        
        // Differentiate between a quick tap and a completed gesture drag
        if (Math.abs(gestureState.dx) < 10 && Math.abs(gestureState.dy) < 10 && timeDiff < 250) {
          handleTap(evt);
        } else {
          if (gestureType.current === 'seek' && seekTarget !== null) {
            seekTo(seekTarget);
          }
          setSeekTarget(null);
          gestureType.current = null;
          startControlsTimer();
        }
      },
    })
  ).current;

  if (!streamUrl) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading Video...</Text>
      </View>
    );
  }

  const displayPosition = seekTarget !== null ? seekTarget : position;
  const progressPercent = duration > 0 ? (displayPosition / duration) * 100 : 0;
  const bufferPercent = duration > 0 ? (bufferedPosition / duration) * 100 : 0;

  return (
    <View style={styles.screen}>
      <StatusBar hidden={isLandscape || controlsVisible === false} barStyle="light-content" />

      {/* VIDEO PLAYER */}
      <Video
        ref={videoRef}
        source={{ uri: streamUrl }}
        style={StyleSheet.absoluteFill}
        resizeMode={resizeMode}
        shouldPlay
        volume={volume}
        progressUpdateIntervalMillis={250}
        onPlaybackStatusUpdate={onPlaybackStatusUpdate}
      />

      {/* GESTURE LAYER */}
      <View style={styles.gestureLayer} {...panResponder.panHandlers} />

      {/* DOUBLE TAP ANIMATIONS */}
      {doubleTapFeedback === 'left' && (
        <View style={[styles.doubleTapWrap, styles.doubleTapLeft]}>
          <RotateCcw size={40} color="#fff" />
          <Text style={styles.doubleTapText}>-10s</Text>
        </View>
      )}
      {doubleTapFeedback === 'right' && (
        <View style={[styles.doubleTapWrap, styles.doubleTapRight]}>
          <RotateCw size={40} color="#fff" />
          <Text style={styles.doubleTapText}>+10s</Text>
        </View>
      )}

      {/* CENTER GESTURE INDICATOR PILL */}
      {indicator && (
        <View style={styles.indicatorWrap} pointerEvents="none">
          <View style={styles.indicatorPill}>
            {indicator.type === 'brightness' ? <Sun size={28} color="#fff" /> : 
             indicator.type === 'volume' ? (indicator.value === 0 ? <VolumeX size={28} color="#fff" /> : <Volume2 size={28} color="#fff" />) :
             <Text style={styles.indicatorTime}>{formatTime(displayPosition)}</Text>}
            
            {indicator.type !== 'seek' && (
              <View style={styles.indicatorBarWrap}>
                <View style={[styles.indicatorBarFill, { width: `${indicator.value * 100}%` }]} />
              </View>
            )}
          </View>
        </View>
      )}

      {/* CONTROLS OVERLAY */}
      {controlsVisible && (
        <View style={styles.controlsOverlay} pointerEvents="box-none">
          
          {isLocked ? (
            /* LOCKED STATE */
            <View style={styles.lockedContainer}>
               <Pressable style={styles.lockButton} onPress={toggleLock}>
                  <Lock size={26} color="#fff" />
               </Pressable>
            </View>
          ) : (
            /* UNLOCKED STATE */
            <>
              <View style={styles.topGradient} pointerEvents="none" />
              <View style={styles.bottomGradient} pointerEvents="none" />

              {/* TOP BAR */}
              <View style={styles.topBar}>
                <Pressable style={styles.iconBtn} onPress={() => router.back()}>
                  <ArrowLeft size={26} color="#fff" />
                </Pressable>
                <Text style={styles.title} numberOfLines={1}>{params.name}</Text>
                
                <Pressable style={styles.iconBtn} onPress={cycleResizeMode}>
                  {resizeMode === ResizeMode.CONTAIN ? <Maximize size={22} color="#fff" /> : 
                   resizeMode === ResizeMode.COVER ? <Expand size={22} color="#fff" /> : 
                   <Monitor size={22} color="#fff" />}
                  <Text style={styles.iconLabel}>
                    {resizeMode === ResizeMode.CONTAIN ? 'FIT' : resizeMode === ResizeMode.COVER ? 'CROP' : 'STRETCH'}
                  </Text>
                </Pressable>

                <Pressable style={styles.iconBtn} onPress={toggleOrientation}>
                  {isLandscape ? <Smartphone size={22} color="#fff" /> : <Monitor size={22} color="#fff" />}
                </Pressable>
              </View>

              {/* LEFT LOCK BUTTON */}
              <View style={styles.leftControls}>
                 <Pressable style={styles.lockButton} onPress={toggleLock}>
                    <Unlock size={24} color="#fff" />
                 </Pressable>
              </View>

              {/* CENTER PLAY/PAUSE */}
              <View style={styles.centerControls} pointerEvents="box-none">
                <Pressable style={styles.playPauseBtn} onPress={togglePlayPause}>
                  {isPlaying ? <Pause size={42} color="#fff" fill="#fff" /> : <Play size={42} color="#fff" fill="#fff" style={{ marginLeft: 6 }} />}
                </Pressable>
              </View>

              {/* BOTTOM TIMELINE */}
              <View style={styles.bottomBar}>
                <Text style={styles.timeText}>{formatTime(displayPosition)}</Text>
                
                <Pressable 
                  style={styles.timelineArea}
                  onLayout={(e) => { progressBarWidth.current = e.nativeEvent.layout.width; }}
                  onPress={(e) => {
                    if (progressBarWidth.current > 0) {
                      const ratio = e.nativeEvent.locationX / progressBarWidth.current;
                      seekTo(ratio * durationRef.current);
                    }
                  }}
                >
                  <View style={styles.trackBackground}>
                    <View style={[styles.trackBuffered, { width: `${bufferPercent}%` }]} />
                    <View style={[styles.trackFill, { width: `${progressPercent}%` }]} />
                    <View style={[styles.trackThumb, { left: `${progressPercent}%` }]} />
                  </View>
                </Pressable>

                <Text style={styles.timeText}>{formatTime(duration)}</Text>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  loadingScreen: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: 'rgba(255,255,255,0.7)', marginTop: 16, fontSize: 14 },

  gestureLayer: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
  controlsOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 20 },

  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 100, backgroundColor: 'rgba(0,0,0,0.6)' },
  bottomGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, backgroundColor: 'rgba(0,0,0,0.6)' },

  topBar: { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 50 : 20, paddingHorizontal: 16, paddingBottom: 16 },
  title: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 16, marginRight: 16 },
  iconBtn: { padding: 10, alignItems: 'center', justifyContent: 'center', minWidth: 44 },
  iconLabel: { color: '#fff', fontSize: 8, fontWeight: '700', marginTop: 4 },

  leftControls: { position: 'absolute', left: 24, top: '45%', zIndex: 30 },
  lockButton: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  lockedContainer: { position: 'absolute', left: 24, top: '45%', zIndex: 30 },

  centerControls: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  playPauseBtn: { width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },

  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 34 : 24, paddingTop: 16 },
  timeText: { color: '#fff', fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'], minWidth: 46, textAlign: 'center' },
  
  timelineArea: { flex: 1, height: 40, justifyContent: 'center', marginHorizontal: 16 },
  trackBackground: { height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, position: 'relative' },
  trackBuffered: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 2 },
  trackFill: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: Colors.primary[500], borderRadius: 2 },
  trackThumb: { position: 'absolute', top: -6, width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.primary[500], marginLeft: -8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 4 },

  indicatorWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 40 },
  indicatorPill: { backgroundColor: 'rgba(0,0,0,0.75)', padding: 20, borderRadius: 16, alignItems: 'center', gap: 12, minWidth: 120 },
  indicatorTime: { color: '#fff', fontSize: 22, fontWeight: '700' },
  indicatorBarWrap: { width: 80, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' },
  indicatorBarFill: { height: '100%', backgroundColor: '#fff' },

  doubleTapWrap: { position: 'absolute', top: '35%', bottom: '35%', width: '35%', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 100, zIndex: 15 },
  doubleTapLeft: { left: -50 },
  doubleTapRight: { right: -50 },
  doubleTapText: { color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 8 },
});
