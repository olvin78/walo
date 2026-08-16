import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { BadgeCheck, Trash2, Lock, ArrowLeft, Plus, Volume2, VolumeX, MoreHorizontal, X, MessageSquare, Send, Image as ImageIcon } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAudioPlayer } from 'expo-audio';
import { Swipeable } from 'react-native-gesture-handler';
import { colors, spacing } from '../theme/colors';
import { createStory, deleteConversation, deleteStory, getConversations, getStories, type Conversation, type Story } from '../services/api';
import { useAuth } from '../services/auth';
import { StoryEditorScreen } from './StoryEditorScreen';

const fallbackAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200';
const storyHoldThresholdMs = 300;

type StoryGroup = {
  userId: number;
  userName: string;
  avatar?: string | null;
  stories: Story[];
};

function formatTime(value?: string) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('es-NI', { day: '2-digit', month: 'short' });
}

export const MessagesScreen = () => {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [selectedStoryGroup, setSelectedStoryGroup] = useState<StoryGroup | null>(null);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState(0);
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [storyText, setStoryText] = useState('');
  const [isCreatingStory, setIsCreatingStory] = useState(false);
  const [storyProgress, setStoryProgress] = useState(0);
  const [isStoryPaused, setIsStoryPaused] = useState(false);
  const [isStoryMuted, setIsStoryMuted] = useState(false);
  const [showStoryMenu, setShowStoryMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const storyPressStartedAtRef = useRef<number | null>(null);

  const groupedStories = useMemo(() => {
    const groups: StoryGroup[] = [];
    const groupMap = new Map<number, StoryGroup>();
    stories.forEach((story) => {
      let group = groupMap.get(story.user);
      if (!group) {
        group = {
          userId: story.user,
          userName: story.user_display_name,
          avatar: story.user_avatar,
          stories: [],
        };
        groupMap.set(story.user, group);
        groups.push(group);
      }
      group.stories.push(story);
    });
    return groups;
  }, [stories]);

  const selectedStory = selectedStoryGroup?.stories[selectedStoryIndex] || null;
  const visibleConversations = useMemo(
    () => conversations.filter((conversation) => Boolean(conversation.last_message)),
    [conversations],
  );
  const storyAudioSource = useMemo(
    () => selectedStory?.audio_url && !isStoryMuted ? { uri: selectedStory.audio_url } : null,
    [isStoryMuted, selectedStory?.audio_url],
  );
  const storyAudioPlayer = useAudioPlayer(storyAudioSource);

  const loadConversations = useCallback(async () => {
    if (!isAuthenticated) {
      setConversations([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      setConversations(await getConversations());
    } catch {
      setConversations([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthLoading) loadConversations();
  }, [isAuthLoading, loadConversations]);

  const loadStories = useCallback(async () => {
    try {
      setStories(await getStories());
    } catch {
      setStories([]);
    }
  }, []);

  useEffect(() => {
    loadStories();
  }, [loadStories]);

  useEffect(() => {
    if (!selectedStoryGroup || !selectedStory) {
      setStoryProgress(0);
      setIsStoryPaused(false);
      setShowStoryMenu(false);
      return;
    }

    setStoryProgress(0);
    setIsStoryPaused(false);
    setShowStoryMenu(false);
    const durationMs = 5000;
    const tickMs = 50;
    const interval = setInterval(() => {
      setStoryProgress((current) => {
        if (isStoryPaused || showStoryMenu) return current;
        const next = current + tickMs / durationMs;
        if (next >= 1) {
          clearInterval(interval);
          if (selectedStoryIndex < selectedStoryGroup.stories.length - 1) {
            setSelectedStoryIndex((index) => index + 1);
          } else {
            setSelectedStoryGroup(null);
          }
          return 1;
        }
        return next;
      });
    }, tickMs);

    return () => clearInterval(interval);
  }, [isStoryPaused, selectedStory, selectedStoryGroup, selectedStoryIndex, showStoryMenu]);

  useEffect(() => {
    if (!storyAudioPlayer) return;
    if (storyAudioSource && !isStoryPaused && !showStoryMenu) {
      storyAudioPlayer.loop = true;
      storyAudioPlayer.play();
    } else {
      storyAudioPlayer.pause();
    }
  }, [isStoryPaused, showStoryMenu, storyAudioPlayer, storyAudioSource]);

  const handleCreateStory = async () => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (result.canceled) return;

    setEditingImage(result.assets[0].uri);
  };

  const publishStoryFromEditor = async (editorData: { imageUri: string; stickers?: { type?: string; content?: string }[]; selectedMusic?: { url?: string; name?: string; artist?: string } }) => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    setIsCreatingStory(true);
    try {
      const stickerText = editorData.stickers
        ?.filter((sticker) => sticker.type === 'text' && sticker.content)
        .map((sticker) => sticker.content)
        .join(' ');
      const story = await createStory({
        image: { uri: editorData.imageUri, name: `story-${Date.now()}.jpg`, type: 'image/jpeg' },
        text: storyText.trim() || stickerText || '',
        audio_url: editorData.selectedMusic?.url,
        audio_name: editorData.selectedMusic?.name,
        audio_start: 0,
        metadata: JSON.stringify({ stickers: editorData.stickers || [] }),
      });
      setStoryText('');
      setEditingImage(null);
      setStories((current) => [story, ...current]);
    } catch {
      Alert.alert('No se pudo crear la historia', 'Inténtalo de nuevo.');
    } finally {
      setIsCreatingStory(false);
    }
  };

  const handleDeleteCurrentStory = () => {
    if (!selectedStory) return;
    Alert.alert('Eliminar historia', '¿Quieres eliminar esta historia?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const storyId = selectedStory.id;
          setSelectedStoryGroup(null);
          setStories((current) => current.filter((story) => story.id !== storyId));
          try {
            await deleteStory(storyId);
          } catch {
            Alert.alert('No se pudo eliminar', 'Inténtalo de nuevo.');
            loadStories();
          }
        },
      },
    ]);
  };

  const goToNextStory = () => {
    if (!selectedStoryGroup) return;
    if (selectedStoryIndex < selectedStoryGroup.stories.length - 1) {
      setSelectedStoryIndex((index) => index + 1);
      setStoryProgress(0);
    } else {
      setSelectedStoryGroup(null);
    }
  };

  const goToPreviousStory = () => {
    if (!selectedStoryGroup) return;
    if (selectedStoryIndex > 0) {
      setSelectedStoryIndex((index) => index - 1);
      setStoryProgress(0);
    } else {
      setStoryProgress(0);
    }
  };

  const renderConversation = ({ item }: { item: Conversation }) => {
    const otherUser = item.other_user;
    const lastMessage = item.last_message;
    const handleDeleteItem = () => {
      Alert.alert('Eliminar conversacion', 'Esta conversacion desaparecera de tu lista.', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const previous = conversations;
            setConversations((current) => current.filter((conversation) => conversation.id !== item.id));
            try {
              await deleteConversation(item.id);
            } catch {
              setConversations(previous);
              Alert.alert('No se pudo eliminar', 'Intentalo de nuevo.');
            }
          },
        },
      ]);
    };

    const conversationCard = (
      <TouchableOpacity style={styles.conversationItem} onPress={() => router.push(`/messages/${item.id}`)} onLongPress={handleDeleteItem} delayLongPress={Platform.OS === 'web' ? 500 : 350}>
        <Image source={{ uri: otherUser?.avatar || fallbackAvatar }} style={styles.avatar} />
        <View style={styles.infoContainer}>
          <View style={styles.headerRow}>
            <View style={styles.nameWrapper}>
              <Text style={styles.userName}>{otherUser?.display_name || 'Usuario'}</Text>
              {otherUser?.is_verified ? <BadgeCheck size={14} color="#3b82f6" strokeWidth={2.4} style={{ marginLeft: 4 }} /> : null}
            </View>
            <Text style={styles.time}>{formatTime(lastMessage?.created_at || item.updated_at)}</Text>
          </View>
          <Text style={styles.listingName} numberOfLines={1}>{item.listing?.title || 'Consulta'}</Text>
          <Text style={styles.lastMessage} numberOfLines={1}>{lastMessage?.text}</Text>
        </View>
      </TouchableOpacity>
    );

    if (Platform.OS === 'web') return conversationCard;

    return (
      <Swipeable
        overshootRight={false}
        renderRightActions={() => (
          <TouchableOpacity style={styles.deleteConversationAction} onPress={handleDeleteItem}>
            <Trash2 size={20} color={colors.white} strokeWidth={2.2} />
            <Text style={styles.deleteConversationText}>Eliminar</Text>
          </TouchableOpacity>
        )}
      >
        {conversationCard}
      </Swipeable>
    );
  };

  if (isAuthLoading || isLoading) {
    return <View style={styles.centerState}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerState}>
          <Lock size={64} color="#D1D5DB" strokeWidth={1.6} />
          <Text style={styles.emptyTitle}>Inicia sesión</Text>
          <Text style={styles.emptyText}>Necesitas una cuenta para ver tus chats.</Text>
          <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/auth/login')}>
            <Text style={styles.loginBtnText}>Iniciar sesión</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} strokeWidth={2.2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mensajes</Text>
        <View style={{ width: 32 }} />
      </View>

      <Modal visible={!!editingImage} animationType="slide">
        {editingImage ? (
          <StoryEditorScreen
            imageUri={editingImage}
            onClose={() => setEditingImage(null)}
            onPublish={publishStoryFromEditor}
          />
        ) : null}
      </Modal>

      <View style={styles.storiesSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesContent}>
          <TouchableOpacity style={styles.storyItem} onPress={handleCreateStory} disabled={isCreatingStory}>
            <View style={[styles.storyCircle, styles.myStoryCircle]}>
              {isCreatingStory ? <ActivityIndicator color={colors.primary} /> : <Plus size={26} color={colors.primary} strokeWidth={2.4} />}
            </View>
            <Text style={styles.storyName} numberOfLines={1}>Tu historia</Text>
          </TouchableOpacity>

          {groupedStories.map((group) => {
            const firstStory = group.stories[0];
            return (
            <TouchableOpacity
              key={group.userId}
              style={styles.storyItem}
              onPress={() => {
                setSelectedStoryGroup(group);
                setSelectedStoryIndex(0);
              }}
            >
              <View style={styles.storyRing}>
                <Image source={{ uri: group.avatar || firstStory.image || fallbackAvatar }} style={styles.storyImage} />
              </View>
              <Text style={styles.storyName} numberOfLines={1}>{group.userName}</Text>
            </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TextInput
          style={styles.storyTextInput}
          placeholder="Texto opcional para tu próxima historia..."
          placeholderTextColor={colors.textLight}
          value={storyText}
          onChangeText={setStoryText}
        />
      </View>

      <Modal visible={!!selectedStory} animationType="fade" transparent={false}>
        {selectedStory ? (
          <View style={styles.storyViewer}>
            <Image source={{ uri: selectedStory.image }} style={styles.storyViewerImage} contentFit="cover" />
            <View style={styles.storyTapLayer} pointerEvents="box-none">
              <Pressable
                style={styles.storyTapZone}
                onPressIn={() => {
                  storyPressStartedAtRef.current = Date.now();
                  setIsStoryPaused(true);
                }}
                onPressOut={() => {
                  const startedAt = storyPressStartedAtRef.current;
                  storyPressStartedAtRef.current = null;
                  setIsStoryPaused(false);
                  if (!startedAt || Date.now() - startedAt >= storyHoldThresholdMs) return;
                  goToPreviousStory();
                }}
              />
              <Pressable
                style={styles.storyTapZone}
                onPressIn={() => {
                  storyPressStartedAtRef.current = Date.now();
                  setIsStoryPaused(true);
                }}
                onPressOut={() => {
                  const startedAt = storyPressStartedAtRef.current;
                  storyPressStartedAtRef.current = null;
                  setIsStoryPaused(false);
                  if (!startedAt || Date.now() - startedAt >= storyHoldThresholdMs) return;
                  goToNextStory();
                }}
              />
            </View>
            <SafeAreaView pointerEvents="box-none" style={styles.storyViewerOverlay}>
              <View style={styles.storyProgressRow}>
                {selectedStoryGroup?.stories.map((story, index) => (
                  <View key={story.id} style={styles.storyProgressTrack}>
                    <View
                      style={[
                        styles.storyProgressFill,
                        {
                          width: index < selectedStoryIndex ? '100%' : index === selectedStoryIndex ? `${Math.min(storyProgress, 1) * 100}%` : '0%',
                        },
                      ]}
                    />
                  </View>
                ))}
              </View>
              <View style={styles.storyViewerHeader}>
                <Image source={{ uri: selectedStory.user_avatar || fallbackAvatar }} style={styles.storyViewerAvatar} />
                <Text style={styles.storyViewerName}>{selectedStory.user_display_name}</Text>
                <TouchableOpacity style={styles.storyViewerIcon} onPress={() => setIsStoryMuted((value) => !value)}>
                  {isStoryMuted ? <VolumeX size={24} color={colors.white} strokeWidth={2.2} /> : <Volume2 size={24} color={colors.white} strokeWidth={2.2} />}
                </TouchableOpacity>
                <TouchableOpacity style={styles.storyViewerIcon} onPress={() => setShowStoryMenu((value) => !value)}>
                  <MoreHorizontal size={26} color={colors.white} strokeWidth={2.2} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.storyViewerClose} onPress={() => setSelectedStoryGroup(null)}>
                  <X size={28} color={colors.white} strokeWidth={2.4} />
                </TouchableOpacity>
              </View>
              {showStoryMenu ? (
                <View style={styles.storyMenu}>
                  {selectedStory.is_own ? (
                    <TouchableOpacity style={styles.storyMenuItem} onPress={handleDeleteCurrentStory}>
                      <Trash2 size={18} color="#ef4444" strokeWidth={2.2} />
                      <Text style={styles.storyMenuDeleteText}>Eliminar esta historia</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.storyMenuText}>Sin opciones disponibles</Text>
                  )}
                </View>
              ) : null}
              {selectedStory.text ? <Text style={styles.storyViewerText}>{selectedStory.text}</Text> : null}
            </SafeAreaView>
          </View>
        ) : null}
      </Modal>

      <FlatList
        data={visibleConversations}
        renderItem={renderConversation}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.listContent, visibleConversations.length === 0 && styles.emptyList]}
        showsVerticalScrollIndicator={false}
        refreshing={isLoading}
        onRefresh={loadConversations}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={(
          <View style={styles.centerState}>
            <MessageSquare size={64} color="#D1D5DB" strokeWidth={1.6} />
            <Text style={styles.emptyTitle}>Aún no tienes chats</Text>
            <Text style={styles.emptyText}>Escribe a un vendedor desde el detalle de un anuncio. Solo apareceran aqui las conversaciones donde hayas enviado al menos un mensaje.</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, height: 60, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: colors.text },
  storiesSection: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: spacing.sm },
  storiesContent: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: 14 },
  storyItem: { width: 76, alignItems: 'center' },
  storyCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
  myStoryCircle: { borderWidth: 2, borderColor: '#D1FAE5', borderStyle: 'dashed' },
  storyRing: { width: 68, height: 68, borderRadius: 34, padding: 3, borderWidth: 2, borderColor: colors.primary },
  storyImage: { width: '100%', height: '100%', borderRadius: 31, backgroundColor: '#F3F4F6' },
  storyName: { marginTop: 6, fontSize: 11, color: colors.text, fontWeight: '700', textAlign: 'center' },
  storyTextInput: { marginHorizontal: spacing.md, marginTop: spacing.sm, height: 38, borderRadius: 14, backgroundColor: '#F9FAFB', paddingHorizontal: 12, color: colors.text, fontSize: 13 },
  storyViewer: { flex: 1, backgroundColor: '#000' },
  storyViewerImage: { ...StyleSheet.absoluteFillObject },
  storyTapLayer: { position: 'absolute', top: 110, right: 0, bottom: 120, left: 0, flexDirection: 'row', zIndex: 30 },
  storyTapZone: { flex: 1 },
  storyViewerOverlay: { flex: 1, justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.2)', zIndex: 10 },
  storyProgressRow: { flexDirection: 'row', gap: 5, marginHorizontal: spacing.md, marginTop: spacing.sm },
  storyProgressTrack: { flex: 1, height: 3, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.32)', overflow: 'hidden' },
  storyProgressFill: { height: '100%', borderRadius: 999, backgroundColor: colors.white },
  storyViewerHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, zIndex: 10 },
  storyViewerAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: colors.primary },
  storyViewerName: { flex: 1, marginLeft: 10, color: colors.white, fontWeight: '900', fontSize: 15 },
  storyViewerIcon: { padding: 6, marginLeft: 2 },
  storyViewerClose: { padding: 4 },
  storyMenu: { position: 'absolute', top: 76, right: spacing.md, backgroundColor: 'rgba(17,24,39,0.96)', borderRadius: 14, padding: 8, minWidth: 190, zIndex: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  storyMenuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 10, gap: 8 },
  storyMenuDeleteText: { color: '#fecaca', fontWeight: '800', fontSize: 13 },
  storyMenuText: { color: 'rgba(255,255,255,0.75)', fontWeight: '700', padding: 10, fontSize: 13 },
  storyViewerText: { margin: spacing.lg, padding: spacing.md, borderRadius: 18, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.45)', color: colors.white, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  listContent: { paddingBottom: 40 },
  emptyList: { flexGrow: 1 },
  conversationItem: { flexDirection: 'row', padding: spacing.md, alignItems: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 18, backgroundColor: '#F3F4F6' },
  infoContainer: { flex: 1, marginLeft: 15 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  nameWrapper: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  userName: { fontSize: 15, fontWeight: '800', color: colors.text },
  time: { fontSize: 11, color: colors.textLight, fontWeight: '600' },
  listingName: { fontSize: 12, color: colors.textLight, fontWeight: '600', marginBottom: 4, opacity: 0.7 },
  lastMessage: { fontSize: 14, color: colors.textLight },
  deleteConversationAction: {
    width: 96,
    marginVertical: 8,
    marginRight: spacing.md,
    borderRadius: 18,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  deleteConversationText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  separator: { height: 1, backgroundColor: '#F9FAFB', marginLeft: 86 },
  emptyTitle: { marginTop: spacing.md, fontSize: 20, color: colors.text, fontWeight: '900' },
  emptyText: { marginTop: spacing.sm, color: colors.textLight, textAlign: 'center', lineHeight: 22 },
  loginBtn: { marginTop: spacing.xl, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  loginBtnText: { color: colors.white, fontWeight: '900' },
});
