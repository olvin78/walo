import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Dimensions, 
  TextInput,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { Image } from 'expo-image';
import { X, Type, Smile, Music4, Palette, ChevronRight, Clock, Calendar, Hash, BarChart3, ChevronDown, Search, PauseCircle, PlayCircle } from 'lucide-react-native';
import { 
  GestureDetector,
  Gesture,
} from 'react-native-gesture-handler';
import { useAudioPlayer, AudioModule } from 'expo-audio';
import Slider from '@react-native-community/slider';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  runOnJS
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

// Set global audio mode to ensure it plays on all devices
if (Platform.OS !== 'web') {
  AudioModule.setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: 'doNotMix',
    shouldRouteThroughEarpiece: false
  }).catch(console.error);
}

// --- ADVANCED GESTURE WRAPPER ---
const AdvancedGestureItem = ({ children, isMain = false, onTap, initialX = 0, initialY = 0 }: any) => {
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const translateX = useSharedValue(initialX);
  const translateY = useSharedValue(initialY);

  const savedScale = useSharedValue(1);
  const savedRotation = useSharedValue(0);
  const savedTranslateX = useSharedValue(initialX);
  const savedTranslateY = useSharedValue(initialY);

  const tapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      if (onTap) runOnJS(onTap)();
    });

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = savedScale.value * event.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const rotationGesture = Gesture.Rotation()
    .onUpdate((event) => {
      rotation.value = savedRotation.value + event.rotation;
    })
    .onEnd(() => {
      savedRotation.value = rotation.value;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotation.value}rad` },
      { scale: scale.value },
    ],
  }));

  const combined = Gesture.Simultaneous(tapGesture, panGesture, pinchGesture, rotationGesture);

  return (
    <GestureDetector gesture={combined}>
      <Animated.View style={[styles.draggableContainer, animatedStyle]}>
        <View style={[
          isMain ? styles.mainGestureBounds : styles.stickerGestureBounds,
          { alignItems: 'center', justifyContent: 'center' }
        ]}>
          {children}
        </View>
      </Animated.View>
    </GestureDetector>
  );
};

export const StoryEditorScreen = ({ imageUri, onClose, onPublish }: any) => {
  const [activePanel, setActivePanel] = useState<'none' | 'filters' | 'stickers' | 'music' | 'text'>('none');
  const [stickers, setStickers] = useState<any[]>([]);
  const [textInput, setTextInput] = useState('');
  const [activeFilter, setActiveFilter] = useState('none');
  const [musicSearch, setMusicSearch] = useState('');
  const [musicResults, setMusicResults] = useState<any[]>([]);
  const [isLoadingMusic, setIsLoadingMusic] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previousPlayerRef = useRef<any>(null);

  const source = useMemo(() => {
    return previewUrl ? { uri: previewUrl } : null;
  }, [previewUrl]);

  const player = useAudioPlayer(source);

  useEffect(() => {
    if (previousPlayerRef.current && previousPlayerRef.current !== player) {
      previousPlayerRef.current.pause();
    }
    previousPlayerRef.current = player;

    if (source && player) {
      player.loop = true;
      player.play();
    } else if (player) {
      player.pause();
    }

    return () => {
      player?.pause();
    };
  }, [source, player]);

  const toggleTextStyle = (id: string) => {
    setStickers(stickers.map(s => {
      if (s.id === id && s.type === 'text') {
        const modes = ['white', 'dark', 'none'];
        const next = modes[(modes.indexOf(s.mode || 'white') + 1) % modes.length];
        return { ...s, mode: next };
      }
      return s;
    }));
  };

  const filters = [
    { id: 'none', label: 'Natural', opacity: 1, tint: 'transparent' },
    { id: 'soft', label: 'Suave', opacity: 0.9, tint: 'rgba(255,255,255,0.1)' },
    { id: 'dark', label: 'Oscuro', opacity: 0.7, tint: 'rgba(0,0,0,0.3)' },
    { id: 'neon', label: 'Neon', opacity: 0.8, tint: 'rgba(34, 197, 94, 0.2)' },
    { id: 'warm', label: 'Cálido', opacity: 0.9, tint: 'rgba(245, 158, 11, 0.15)' },
  ];

  const searchMusic = async (query: string) => {
    if (!query) return;
    setIsLoadingMusic(true);
    try {
      const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=15`);
      const data = await response.json();
      setMusicResults(data.results.map((s: any) => ({
        id: s.trackId.toString(),
        name: s.trackName, 
        artist: s.artistName, 
        url: s.previewUrl.replace('http:', 'https:'), // FORCE HTTPS
        img: s.artworkUrl100
      })));
    } catch(e) { console.error(e); } finally { setIsLoadingMusic(false); }
  };

  const addSticker = (type: string, content: string) => {
    setStickers((current) => [
      ...current,
      {
        id: Date.now().toString(),
        type,
        content,
        mode: 'white',
        initialX: width * 0.28,
        initialY: height * 0.2,
      },
    ]);
    setActivePanel('none');
  };

  const handleAddText = () => {
    if (textInput.trim()) {
      addSticker('text', textInput);
      setTextInput('');
    }
  };

  const now = new Date();
  const currentTime = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
  const currentDate = `${now.getDate()} ${['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'][now.getMonth()]}`;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Image source={{ uri: imageUri }} style={styles.blurredBg} contentFit="cover" blurRadius={60} />
      <View style={styles.bgOverlay} />

      <View style={styles.topHeader}>
        <TouchableOpacity onPress={onClose} style={styles.iconBtn}><X size={30} color="#fff" strokeWidth={2.4} /></TouchableOpacity>
        <View style={styles.topRightActions}>
          <TouchableOpacity onPress={() => setActivePanel('text')} style={styles.iconBtn}><Type size={26} color="#fff" strokeWidth={2.2} /></TouchableOpacity>
          <TouchableOpacity onPress={() => setActivePanel('stickers')} style={styles.iconBtn}><Smile size={26} color="#fff" strokeWidth={2.2} /></TouchableOpacity>
          <TouchableOpacity onPress={() => setActivePanel('music')} style={styles.iconBtn}><Music4 size={26} color="#fff" strokeWidth={2.2} /></TouchableOpacity>
          <TouchableOpacity onPress={() => setActivePanel('filters')} style={styles.iconBtn}><Palette size={26} color="#fff" strokeWidth={2.2} /></TouchableOpacity>
        </View>
      </View>

      <View style={styles.workspace}>
        <AdvancedGestureItem isMain>
           <View style={styles.mainCardFrame}>
             <Image source={{ uri: imageUri }} style={[styles.mainImage, { opacity: filters.find(f => f.id === activeFilter)?.opacity || 1 }]} contentFit="cover" />
             <View style={[StyleSheet.absoluteFill, { backgroundColor: filters.find(f => f.id === activeFilter)?.tint || 'transparent' }]} />
           </View>
        </AdvancedGestureItem>

        {selectedMusic ? (
          <View style={styles.selectedMusicChip}>
            <Music4 size={16} color="#fff" strokeWidth={2.2} />
            <View style={styles.selectedMusicTextBox}>
              <Text style={styles.selectedMusicName} numberOfLines={1}>{selectedMusic.name}</Text>
              <Text style={styles.selectedMusicArtist} numberOfLines={1}>{selectedMusic.artist}</Text>
            </View>
          </View>
        ) : null}

        {stickers.map((s) => (
          <AdvancedGestureItem key={s.id} onTap={() => s.type === 'text' && toggleTextStyle(s.id)} initialX={s.initialX ?? width * 0.28} initialY={s.initialY ?? height * 0.2}>
            {s.type === 'text' ? (
              <View style={[
                styles.textSticker, 
                s.mode === 'dark' && { backgroundColor: 'rgba(0,0,0,0.7)' },
                s.mode === 'none' && { backgroundColor: 'transparent' }
              ]}>
                <Text style={[
                  styles.textStickerTxt,
                  s.mode === 'dark' && { color: '#fff' },
                  s.mode === 'none' && { color: '#fff', textShadowColor: '#000', textShadowRadius: 8 }
                ]}>{s.content}</Text>
              </View>
            ) : s.type === 'hashtag' ? (
              <View style={styles.hashtagSticker}><Text style={styles.hashtagStickerTxt}>{s.content}</Text></View>
            ) : s.type === 'clock' ? (
              <View style={styles.clockSticker}><Text style={styles.clockStickerTxt}>{s.content}</Text></View>
            ) : s.type === 'poll' ? (
              <View style={styles.pollSticker}>
                <Text style={styles.pollTitle}>{s.content}</Text>
                <View style={styles.pollActions}><View style={styles.pollBtn}><Text style={styles.pollBtnTxt}>SÍ</Text></View><View style={styles.pollBtn}><Text style={styles.pollBtnTxt}>NO</Text></View></View>
              </View>
            ) : (
              <Text style={styles.storyStickerText}>{s.content}</Text>
            )}
          </AdvancedGestureItem>
        ))}
      </View>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.publishBtn} onPress={() => { player.pause(); onPublish({ imageUri, stickers, selectedMusic }); }}>
           <Text style={styles.publishBtnTxt}>Publicar Historia</Text><ChevronRight size={20} color="#000" strokeWidth={2.4} />
        </TouchableOpacity>
      </View>

      {activePanel === 'text' && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.textOverlay}>
          <TouchableOpacity style={styles.closePanelArea} onPress={() => setActivePanel('none')} />
          <TextInput autoFocus style={styles.textArena} placeholder="Escribe..." placeholderTextColor="rgba(255,255,255,0.5)" value={textInput} onChangeText={setTextInput} onSubmitEditing={handleAddText} />
        </KeyboardAvoidingView>
      )}

      {activePanel === 'filters' && (
        <View style={styles.bottomPanel}>
          <View style={styles.panelInner}>
            <Text style={styles.panelTitle}>Filtros</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {filters.map(f => (
                <TouchableOpacity key={f.id} style={[styles.filterBtn, activeFilter === f.id && styles.activeFilter]} onPress={() => { setActiveFilter(f.id); setActivePanel('none'); }}>
                  <View style={[styles.filterPreview, { backgroundColor: f.tint }]} /><Text style={styles.filterLabel}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {activePanel === 'stickers' && (
        <View style={styles.bottomPanel}>
          <View style={styles.panelInner}>
            <Text style={styles.panelTitle}>Stickers</Text>
            <View style={styles.stickerGrid}>
              <TouchableOpacity onPress={() => addSticker('clock', currentTime)} style={styles.gridItem}><Clock size={32} color="#fff" strokeWidth={2} /><Text style={styles.gridTxt}>Hora</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => addSticker('clock', currentDate)} style={styles.gridItem}><Calendar size={32} color="#fff" strokeWidth={2} /><Text style={styles.gridTxt}>Fecha</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => addSticker('hashtag', '#HOLA')} style={styles.gridItem}><Hash size={32} color="#fff" strokeWidth={2} /><Text style={styles.gridTxt}>Hashtag</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => addSticker('poll', '¿Te gusta?')} style={styles.gridItem}><BarChart3 size={32} color="#fff" strokeWidth={2} /><Text style={styles.gridTxt}>Encuesta</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {activePanel === 'music' && (
        <View style={styles.fullPanel}>
          <View style={styles.fullPanelHeader}>
            <TouchableOpacity onPress={() => { setPreviewUrl(null); player.pause(); setActivePanel('none'); }}><ChevronDown size={30} color="#fff" strokeWidth={2.4} /></TouchableOpacity>
            <View style={styles.searchBox}><Search size={20} color="rgba(255,255,255,0.5)" strokeWidth={2} /><TextInput style={styles.searchPrompt} placeholder="Música..." placeholderTextColor="rgba(255,255,255,0.5)" value={musicSearch} onChangeText={setMusicSearch} onSubmitEditing={() => searchMusic(musicSearch)} /></View>
          </View>
          <ScrollView style={{ flex: 1, padding: 20 }}>
            {isLoadingMusic ? <ActivityIndicator size="large" color="#fff" /> : musicResults.map(s => (
              <View key={s.id} style={styles.musicRow}>
                <TouchableOpacity style={styles.musicRowInfo} onPress={() => { setSelectedMusic(s); setPreviewUrl(null); setActivePanel('none'); }}>
                  <Image source={{ uri: s.img }} style={styles.musicImg} /><View style={{ flex: 1, marginLeft: 15 }}><Text style={styles.musicTitle} numberOfLines={1}>{s.name}</Text><Text style={styles.musicArtist} numberOfLines={1}>{s.artist}</Text></View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.playIconBtn}
                  onPress={() => {
                    if (previewUrl === s.url) {
                      player.pause();
                      setPreviewUrl(null);
                      return;
                    }
                    player.pause();
                    setPreviewUrl(s.url);
                  }}
                >
                  {previewUrl === s.url ? <PauseCircle size={38} color="#22c55e" strokeWidth={2} /> : <PlayCircle size={38} color="#fff" strokeWidth={2} />}
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  blurredBg: { ...StyleSheet.absoluteFillObject },
  bgOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  topHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, zIndex: 100 },
  topRightActions: { flexDirection: 'row', gap: 15 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  workspace: { flex: 1, position: 'relative' },
  draggableContainer: { position: 'absolute', top: 0, left: 0 },
  mainGestureBounds: { width, height },
  stickerGestureBounds: { padding: 40 },
  mainCardFrame: {
    width: width * 0.84,
    height: height * 0.62,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#111827',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.28,
    shadowRadius: 30,
    elevation: 12,
  },
  mainImage: { width: '100%', height: '100%' },
  selectedMusicChip: {
    position: 'absolute',
    left: 22,
    right: 22,
    bottom: 150,
    borderRadius: 18,
    backgroundColor: 'rgba(17,24,39,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  selectedMusicTextBox: { flex: 1 },
  selectedMusicName: { color: '#fff', fontSize: 14, fontWeight: '800' },
  selectedMusicArtist: { color: 'rgba(255,255,255,0.62)', fontSize: 12, marginTop: 2 },
  textSticker: { backgroundColor: '#fff', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12 },
  textStickerTxt: { color: '#000', fontSize: 24, fontWeight: '900' },
  hashtagSticker: { backgroundColor: '#22c55e', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  hashtagStickerTxt: { color: '#fff', fontSize: 18, fontWeight: '900' },
  clockSticker: { },
  clockStickerTxt: { color: '#fff', fontSize: 48, fontWeight: '900', textShadowColor: '#000', textShadowRadius: 10 },
  pollSticker: { backgroundColor: '#fff', padding: 20, borderRadius: 20, width: 220 },
  pollTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 15, color: '#000' },
  pollActions: { flexDirection: 'row', gap: 10 },
  pollBtn: { flex: 1, height: 45, borderRadius: 12, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },
  pollBtnTxt: { fontWeight: '900', fontSize: 14, color: '#000' },
  storyStickerText: { fontSize: 60, color: '#fff', fontWeight: '900' },
  bottomBar: { padding: 30, paddingBottom: 50, alignItems: 'center' },
  publishBtn: { backgroundColor: '#fff', flexDirection: 'row', height: 60, borderRadius: 30, paddingHorizontal: 25, alignItems: 'center' },
  publishBtnTxt: { color: '#000', fontWeight: '900', fontSize: 16, marginRight: 10 },
  textOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  closePanelArea: { ...StyleSheet.absoluteFillObject },
  textArena: { color: '#fff', fontSize: 40, fontWeight: '900', textAlign: 'center', width: '80%' },
  bottomPanel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#1c1c1e', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, paddingBottom: 40, zIndex: 1000 },
  panelTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 20 },
  filterBtn: { alignItems: 'center', marginRight: 20 },
  filterPreview: { width: 60, height: 60, borderRadius: 12, marginBottom: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)' },
  filterLabel: { color: '#fff', fontSize: 13, fontWeight: '600' },
  activeFilter: { opacity: 1 },
  stickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15 },
  gridItem: { width: '45%', backgroundColor: 'rgba(255,255,255,0.05)', padding: 20, borderRadius: 20, alignItems: 'center' },
  gridTxt: { color: '#fff', marginTop: 10, fontWeight: '700' },
  fullPanel: { ...StyleSheet.absoluteFillObject, backgroundColor: '#1c1c1e', zIndex: 2000, paddingTop: 60 },
  fullPanelHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 15 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', height: 50, borderRadius: 15, paddingHorizontal: 15 },
  searchPrompt: { flex: 1, color: '#fff', marginLeft: 10, fontSize: 16 },
  musicRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', padding: 12, borderRadius: 20, marginBottom: 12 },
  musicRowInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  playIconBtn: { padding: 5, marginLeft: 10 },
  musicImg: { width: 50, height: 50, borderRadius: 10 },
  musicTitle: { color: '#fff', fontWeight: '800', fontSize: 15 },
  musicArtist: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  panelInner: { flex: 1 },
});
