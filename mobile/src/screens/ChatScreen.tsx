import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, SafeAreaView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing } from '../theme/colors';
import { getConversation, sendMessage, type ChatMessage, type Conversation } from '../services/api';
import { useAuth } from '../services/auth';

const fallbackAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200';

type ChatScreenProps = {
  conversationId: string;
};

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' });
}

export const ChatScreen = ({ conversationId }: ChatScreenProps) => {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

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

  const handleSend = async () => {
    const text = messageText.trim();
    if (!text || !conversation) return;
    setMessageText('');
    setIsSending(true);
    try {
      const message = await sendMessage(conversation.id, text);
      setConversation((current) => current ? { ...current, messages: [...current.messages, message], last_message: message } : current);
    } catch {
      setMessageText(text);
    } finally {
      setIsSending(false);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMine = item.is_mine;
    return (
      <View style={[styles.messageWrapper, isMine ? styles.myMessageWrapper : styles.otherMessageWrapper]}>
        {!isMine ? <Image source={{ uri: item.sender.avatar || fallbackAvatar }} style={styles.chatAvatar} /> : null}
        <View style={[styles.bubble, isMine ? styles.myBubble : styles.otherBubble]}>
          <Text style={[styles.messageText, isMine ? styles.myText : styles.otherText]}>{item.text}</Text>
          <View style={styles.messageFooter}>
            <Text style={[styles.timeText, isMine ? styles.myTime : styles.otherTime]}>{formatTime(item.created_at)}</Text>
            {isMine ? <Ionicons name="checkmark-done" size={14} color="rgba(255,255,255,0.8)" /> : null}
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
          <Ionicons name="chevron-back" size={28} color={colors.white} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerAvatarBtn}
          onPress={() => conversation.other_user?.username && router.push(`/profile/${conversation.other_user.username}`)}
          disabled={!conversation.other_user?.username}
        >
          <Image source={{ uri: conversation.other_user?.avatar || fallbackAvatar }} style={styles.headerAvatar} />
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

        <View style={styles.composerWrapper}>
          <View style={styles.composerInner}>
            <TextInput
              style={styles.input}
              placeholder="Escribe un mensaje..."
              placeholderTextColor={colors.textLight}
              value={messageText}
              onChangeText={setMessageText}
              multiline
            />
            <TouchableOpacity style={[styles.sendBtn, (!messageText.trim() || isSending) && styles.sendBtnDisabled]} onPress={handleSend} disabled={!messageText.trim() || isSending}>
              {isSending ? <ActivityIndicator color={colors.white} /> : <Ionicons name="send" size={20} color={colors.white} />}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
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
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  myBubble: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: colors.white, borderBottomLeftRadius: 4 },
  messageText: { fontSize: 15, lineHeight: 21 },
  myText: { color: colors.white },
  otherText: { color: colors.text },
  messageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, gap: 4 },
  timeText: { fontSize: 10, fontWeight: '600' },
  myTime: { color: 'rgba(255,255,255,0.75)' },
  otherTime: { color: colors.textLight },
  composerWrapper: { padding: spacing.sm, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  composerInner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 22, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#E5E7EB' },
  input: { flex: 1, minHeight: 38, maxHeight: 110, color: colors.text, fontSize: 15, paddingHorizontal: 6 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.45 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: spacing.md },
  loginBtn: { backgroundColor: colors.primary, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14 },
  loginBtnText: { color: colors.white, fontWeight: '900' },
});
