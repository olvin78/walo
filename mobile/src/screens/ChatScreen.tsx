import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Linking, Modal, Platform, SafeAreaView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RecordingPresets, requestRecordingPermissionsAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { CheckCheck, ChevronLeft, Eye, FileText, ImagePlus, Maximize2, Mic, Paperclip, Pause, Play, Send, Square, X, ZoomIn } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { colors, spacing } from '../theme/colors';
import { getConversation, markMessageViewOnce, sendMessage, type ChatMessage, type Conversation } from '../services/api';
import { useAuth } from '../services/auth';

const fallbackAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200';

type ChatScreenProps = {
  conversationId: string;
};

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function getFileName(url: string) {
  const cleanUrl = url.split('?')[0];
  return decodeURIComponent(cleanUrl.substring(cleanUrl.lastIndexOf('/') + 1)) || 'Documento';
}

export const ChatScreen = ({ conversationId }: ChatScreenProps) => {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 0);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<number | null>(null);
  const [viewOnceImage, setViewOnceImage] = useState<{ id: number; url: string; isTemporary: boolean } | null>(null);
  const audioPlayer = useAudioPlayer(null, { updateInterval: 250 });
  const audioStatus = useAudioPlayerStatus(audioPlayer);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder, 250);

  const loadConversation = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      setConversation(await getConversation(conversationId));
    } catch {
      setConversation(null);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, isAuthenticated]);

  useEffect(() => {
    if (!isAuthLoading) loadConversation();
  }, [isAuthLoading, loadConversation]);

  useEffect(() => {
    if (!conversationId || !isAuthenticated) return;
    const interval = setInterval(loadConversation, 8000);
    return () => clearInterval(interval);
  }, [conversationId, isAuthenticated, loadConversation]);

  useEffect(() => {
    if (audioStatus.didJustFinish) setPlayingAudioId(null);
  }, [audioStatus.didJustFinish]);

  useEffect(() => {
    if (!viewOnceImage?.isTemporary) return;
    const timeout = setTimeout(() => {
      setViewOnceImage(null);
    }, 10000);
    return () => clearTimeout(timeout);
  }, [viewOnceImage]);

  const appendMessage = useCallback((message: ChatMessage) => {
    setConversation((current) => current ? { ...current, messages: [...current.messages, message], last_message: message } : current);
  }, []);

  const sendAttachment = useCallback(async (attachment: Parameters<typeof sendMessage>[2]) => {
    if (!conversation || isSending) return;
    setIsSending(true);
    try {
      appendMessage(await sendMessage(conversation.id, '', attachment));
    } catch {
      Alert.alert('No se pudo enviar', 'Inténtalo de nuevo en unos segundos.');
    } finally {
      setIsSending(false);
    }
  }, [appendMessage, conversation, isSending]);

  const handleSend = async () => {
    const text = messageText.trim();
    if (!text || !conversation || isSending) return;
    setMessageText('');
    setIsSending(true);
    try {
      appendMessage(await sendMessage(conversation.id, text));
    } catch {
      setMessageText(text);
    } finally {
      setIsSending(false);
    }
  };

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permiso requerido', 'Activa el acceso a tus fotos para enviar imágenes.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const image = {
      uri: asset.uri,
      name: asset.fileName || `foto-chat-${Date.now()}.jpg`,
      type: asset.mimeType || 'image/jpeg',
    };
    Alert.alert('Enviar foto', '¿Cómo quieres enviar esta imagen?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Normal', onPress: () => sendAttachment({ image }) },
      { text: 'Ver una vez', onPress: () => sendAttachment({ image, is_view_once: true }) },
    ]);
  };

  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false, type: '*/*' });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const upload = {
      uri: asset.uri,
      name: asset.name || `archivo-chat-${Date.now()}`,
      type: asset.mimeType || 'application/octet-stream',
    };
    if (upload.type.startsWith('image/')) {
      await sendAttachment({ image: upload });
      return;
    }
    if (upload.type.startsWith('audio/')) {
      await sendAttachment({ audio: upload });
      return;
    }
    await sendAttachment({ file: upload });
  };

  const handleToggleRecording = async () => {
    try {
      if (recorderState.isRecording) {
        await audioRecorder.stop();
        const uri = audioRecorder.uri || audioRecorder.getStatus().url;
        if (uri) {
          await sendAttachment({ audio: { uri, name: `nota-voz-${Date.now()}.m4a`, type: 'audio/mp4' } });
        }
        return;
      }
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permiso requerido', 'Activa el micrófono para enviar notas de voz.');
        return;
      }
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch {
      Alert.alert('Audio no disponible', 'No se pudo usar el micrófono en este momento.');
    }
  };

  const handleToggleAudio = (item: ChatMessage) => {
    if (!item.audio) return;
    if (playingAudioId === item.id && audioStatus.playing) {
      audioPlayer.pause();
      setPlayingAudioId(null);
      return;
    }
    audioPlayer.replace({ uri: item.audio });
    setPlayingAudioId(item.id);
    audioPlayer.seekTo(0).catch(() => undefined);
    audioPlayer.play();
  };

  const handleOpenImage = async (item: ChatMessage) => {
    if (!item.image) return;
    if (!item.is_view_once) {
      setViewOnceImage({ id: item.id, url: item.image, isTemporary: false });
      return;
    }
    setViewOnceImage({ id: item.id, url: item.image, isTemporary: true });
    setConversation((current) => current ? { ...current, messages: current.messages.filter((message) => message.id !== item.id) } : current);
    try {
      await markMessageViewOnce(item.id);
    } catch {
      loadConversation();
    }
  };

  const handleCloseImage = async () => {
    setViewOnceImage(null);
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMine = item.is_mine;
    const isPro = !!item.sender?.is_pro;
    const isImageOnly = !!item.image && !item.text?.trim() && !item.audio && !item.file;
    return (
      <View style={[styles.messageWrapper, isMine ? styles.myMessageWrapper : styles.otherMessageWrapper]}>
        {!isMine ? <Image source={{ uri: item.sender.avatar || fallbackAvatar }} style={[styles.chatAvatar, isPro && styles.chatAvatarPro]} /> : null}
        <View style={[
          styles.bubble,
          isMine ? styles.myBubble : styles.otherBubble,
          isPro && styles.proBubble,
          isImageOnly && styles.imageBubble,
          isImageOnly && isMine && !isPro && styles.imageBubbleMine,
          isImageOnly && isPro && styles.imageBubblePro,
        ]}>
          {item.image ? (
            item.is_view_once ? (
              isMine ? (
                <View style={styles.viewOnceCard}>
                  <Eye size={22} color={colors.primary} />
                  <Text style={styles.viewOnceCardTitle}>Foto de una sola vez</Text>
                  <Text style={styles.viewOnceCardHint}>Enviada, se borrará cuando la abran</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.viewOnceCard} onPress={() => handleOpenImage(item)}>
                  <Eye size={22} color={colors.primary} />
                  <Text style={styles.viewOnceCardTitle}>Foto de una sola vez</Text>
                  <Text style={styles.viewOnceCardHint}>Toca para abrirla 10 segundos</Text>
                </TouchableOpacity>
              )
            ) : (
              <TouchableOpacity onPress={() => handleOpenImage(item)} activeOpacity={0.85}>
                <Image source={{ uri: item.image }} style={styles.messageImage} contentFit="cover" />
                <View style={styles.imageExpandHint}>
                  <ZoomIn size={14} color="rgba(255,255,255,0.9)" strokeWidth={2.2} />
                </View>
              </TouchableOpacity>
            )
          ) : null}
          {item.audio ? (
            <TouchableOpacity style={[styles.audioMessage, isMine ? styles.myAudioMessage : styles.otherAudioMessage]} onPress={() => handleToggleAudio(item)}>
              {playingAudioId === item.id && audioStatus.playing ? <Pause size={18} color={isMine ? colors.white : colors.primary} /> : <Play size={18} color={isMine ? colors.white : colors.primary} />}
              <Text style={[styles.audioText, isMine ? styles.myText : styles.otherText]}>Nota de voz</Text>
            </TouchableOpacity>
          ) : null}
          {item.file ? (
            <TouchableOpacity style={[styles.fileMessage, isMine ? styles.myFileMessage : styles.otherFileMessage]} onPress={() => Linking.openURL(item.file || '')}>
              <FileText size={18} color={isMine ? colors.white : colors.primary} />
              <Text style={[styles.fileText, isMine ? styles.myText : styles.otherText]} numberOfLines={1}>{getFileName(item.file)}</Text>
            </TouchableOpacity>
          ) : null}
          {item.text?.trim() ? <Text style={[styles.messageText, isMine ? styles.myText : styles.otherText]}>{item.text}</Text> : null}
          <View style={styles.messageFooter}>
            <Text style={[styles.timeText, isMine ? styles.myTime : styles.otherTime]}>{formatTime(item.created_at)}</Text>
            {isMine ? <CheckCheck size={14} color="rgba(255,255,255,0.8)" strokeWidth={2.4} /> : null}
          </View>
        </View>
      </View>
    );
  };

  if (isAuthLoading || isLoading) return <View style={styles.centerState}><ActivityIndicator size="large" color={colors.primary} /></View>;

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.centerState}>
        <Text style={styles.emptyTitle}>Inicia sesión para chatear</Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/auth/login')}><Text style={styles.loginBtnText}>Iniciar sesión</Text></TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!conversation) {
    return (
      <SafeAreaView style={styles.centerState}>
        <Text style={styles.emptyTitle}>Chat no disponible</Text>
        <TouchableOpacity style={styles.loginBtn} onPress={loadConversation}><Text style={styles.loginBtnText}>Reintentar</Text></TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={28} color={colors.white} strokeWidth={2.4} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerAvatarBtn}
          onPress={() => conversation.other_user?.username && router.push(`/profile/${conversation.other_user.username}`)}
          disabled={!conversation.other_user?.username}
        >
          <Image source={{ uri: conversation.other_user?.avatar || fallbackAvatar }} style={[styles.headerAvatar, conversation.other_user?.is_pro && styles.chatAvatarPro]} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.userName}>{conversation.other_user?.display_name || 'Usuario'}</Text>
          <Text style={styles.productName}>{conversation.listing?.title || 'Consulta'}</Text>
        </View>
        <TouchableOpacity
          onPress={() => conversation.listing?.id && router.push(`/listing/${conversation.listing.id}`)}
          disabled={!conversation.listing?.id}
        >
          <Image source={{ uri: conversation.listing?.main_image || conversation.other_user?.avatar || fallbackAvatar }} style={styles.productThumb} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <FlatList
          data={conversation.messages}
          renderItem={renderMessage}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
        />

        <View style={[styles.composerWrapper, { paddingBottom: spacing.sm + bottomPad }]}>
          <View style={styles.composerInner}>
            {recorderState.isRecording ? (
              <>
                <View style={styles.recordingIndicator}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingText}>Grabando {formatDuration(recorderState.durationMillis)}</Text>
                </View>
                <TouchableOpacity style={styles.stopRecordingBtn} onPress={handleToggleRecording}>
                  <Square size={18} color={colors.white} fill={colors.white} />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.composerAction} onPress={handlePickImage} disabled={isSending}>
                  <ImagePlus size={20} color={colors.textLight} strokeWidth={2.2} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.composerAction} onPress={handlePickFile} disabled={isSending}>
                  <Paperclip size={20} color={colors.textLight} strokeWidth={2.2} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.composerAction} onPress={handleToggleRecording} disabled={isSending}>
                  <Mic size={20} color={colors.textLight} strokeWidth={2.2} />
                </TouchableOpacity>
                <TextInput
                  style={styles.input}
                  placeholder="Escribe un mensaje..."
                  placeholderTextColor={colors.textLight}
                  value={messageText}
                  onChangeText={setMessageText}
                  multiline
                />
                <TouchableOpacity style={[styles.sendBtn, (!messageText.trim() || isSending) && styles.sendBtnDisabled]} onPress={handleSend} disabled={!messageText.trim() || isSending}>
                  {isSending ? <ActivityIndicator color={colors.white} /> : <Send size={20} color={colors.white} strokeWidth={2.2} />}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={!!viewOnceImage} transparent animationType="fade" onRequestClose={handleCloseImage}>
        <View style={styles.imageViewerOverlay}>
          <TouchableOpacity style={styles.imageViewerClose} onPress={handleCloseImage}>
            <X size={28} color={colors.white} />
          </TouchableOpacity>
          {viewOnceImage ? <Image source={{ uri: viewOnceImage.url }} style={styles.imageViewer} contentFit="contain" /> : null}
          {viewOnceImage?.isTemporary ? <Text style={styles.temporaryHint}>Esta foto desaparecerá en 10 segundos</Text> : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.white, padding: spacing.xl },
  header: { height: 70, backgroundColor: '#0F172A', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15 },
  backBtn: { padding: 5 },
  headerAvatarBtn: { marginLeft: 4 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#1F2937', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)' },
  headerInfo: { flex: 1, marginLeft: 12 },
  userName: { color: colors.white, fontSize: 17, fontWeight: '900' },
  productName: { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '600', marginTop: 2 },
  productThumb: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#1F2937' },
  messageList: { padding: spacing.md, paddingBottom: 24 },
  messageWrapper: { flexDirection: 'row', marginBottom: 12, maxWidth: '86%' },
  myMessageWrapper: { alignSelf: 'flex-end' },
  otherMessageWrapper: { alignSelf: 'flex-start' },
  chatAvatar: { width: 28, height: 28, borderRadius: 14, marginRight: 8, alignSelf: 'flex-end' },
  chatAvatarPro: { borderWidth: 2, borderColor: '#D4AF37' },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  proBubble: { borderWidth: 2, borderColor: '#D4AF37', shadowColor: '#D4AF37', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 3 },
  myBubble: { backgroundColor: '#2D2D2D', borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: colors.white, borderBottomLeftRadius: 4 },
  messageImage: { width: 220, height: 160, borderRadius: 12, marginBottom: 0, backgroundColor: '#E5E7EB' },
  imageExpandHint: { position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 8, padding: 4 },
  imageBubble: { padding: 3, backgroundColor: '#1F2937' },
  imageBubbleMine: { backgroundColor: '#1F2937' },
  imageBubblePro: { padding: 3, backgroundColor: '#1F2937', borderWidth: 2, borderColor: '#F59E0B' },
  viewOnceCard: { width: 220, minHeight: 110, borderRadius: 16, borderWidth: 1.5, borderColor: '#D1D5DB', borderStyle: 'dashed', backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center', padding: 14, marginBottom: 4 },
  viewOnceCardTitle: { color: colors.text, fontSize: 15, fontWeight: '900', marginTop: 8 },
  viewOnceCardHint: { color: colors.textLight, fontSize: 12, fontWeight: '700', marginTop: 2 },
  audioMessage: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 150, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 2 },
  myAudioMessage: { backgroundColor: 'rgba(255,255,255,0.16)' },
  otherAudioMessage: { backgroundColor: '#F3F4F6' },
  audioText: { fontSize: 14, fontWeight: '800' },
  fileMessage: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 220, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 9, marginBottom: 2 },
  myFileMessage: { backgroundColor: 'rgba(255,255,255,0.16)' },
  otherFileMessage: { backgroundColor: '#F3F4F6' },
  fileText: { flex: 1, fontSize: 14, fontWeight: '800' },
  messageText: { fontSize: 15, lineHeight: 21 },
  myText: { color: colors.white },
  otherText: { color: colors.text },
  messageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, gap: 4 },
  timeText: { fontSize: 10, fontWeight: '600' },
  myTime: { color: 'rgba(255,255,255,0.75)' },
  otherTime: { color: colors.textLight },
  composerWrapper: { padding: spacing.sm, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  composerInner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 22, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#E5E7EB' },
  composerAction: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  input: { flex: 1, minHeight: 38, maxHeight: 110, color: colors.text, fontSize: 15, paddingHorizontal: 6 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.45 },
  recordingIndicator: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 38, paddingHorizontal: 6 },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444' },
  recordingText: { color: colors.text, fontSize: 15, fontWeight: '800' },
  stopRecordingBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center' },
  imageViewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', alignItems: 'center', justifyContent: 'center' },
  imageViewerClose: { position: 'absolute', top: Platform.OS === 'android' ? 42 : 58, right: 22, zIndex: 2, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  imageViewer: { width: '100%', height: '78%' },
  temporaryHint: { position: 'absolute', bottom: 46, color: colors.white, fontSize: 14, fontWeight: '800', backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: spacing.md },
  loginBtn: { backgroundColor: colors.primary, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14 },
  loginBtnText: { color: colors.white, fontWeight: '900' },
});
