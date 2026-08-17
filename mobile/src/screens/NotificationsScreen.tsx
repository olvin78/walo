import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  RefreshControl
} from 'react-native';
import { Image } from 'expo-image';
import { Mail, Tag, Heart, Bell, BadgeCheck, ArrowRight, BellOff, ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { colors, spacing } from '../theme/colors';
import { getNotifications, markNotificationRead, markAllNotificationsRead, updateProfile, type Notification } from '../services/api';
import { useAuth } from '../services/auth';
import { ProFooter } from '../components/ProFooter';

export const NotificationsScreen = () => {
  const router = useRouter();
  const { isAuthenticated, user, reloadUser } = useAuth();
  const isMePro = Boolean(user?.profile?.is_pro);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [allowsNotifications, setAllowsNotifications] = useState(true);
  const [isSavingPreference, setIsSavingPreference] = useState(false);
  const showVerificationReminder = isAuthenticated && !user?.profile?.is_verified;

  useEffect(() => {
    setAllowsNotifications(user?.profile?.allows_notifications ?? true);
  }, [user?.profile?.allows_notifications]);

  const fetchNotifications = async (showLoading = true) => {
    if (!isAuthenticated) return;
    if (showLoading) setIsLoading(true);
    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [isAuthenticated]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchNotifications(false);
  };

  const handleNotificationPress = async (item: Notification) => {
    if (!item.is_read) {
      try {
        await markNotificationRead(item.id);
        setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, is_read: true } : n));
      } catch (e) {
        console.error('Error marking as read:', e);
      }
    }

    // Navigation logic
    switch (item.notification_type) {
      case 'message':
      case 'offer':
        if (item.related_conversation) {
          router.push(`/messages/${item.related_conversation}`);
        }
        break;
      case 'favorite':
        if (item.related_listing) {
          router.push(`/listing/${item.related_listing}`);
        }
        break;
      default:
        break;
    }
  };

  const handleReadAll = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) {
      console.error('Error marking all as read:', e);
    }
  };

  const handleToggleNotifications = async (value: boolean) => {
    setAllowsNotifications(value);
    setIsSavingPreference(true);
    try {
      await updateProfile({ allows_notifications: value });
      await reloadUser();
    } catch (error) {
      setAllowsNotifications(!value);
      console.error('Error saving notification preference:', error);
    } finally {
      setIsSavingPreference(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'message': return Mail;
      case 'offer': return Tag;
      case 'favorite': return Heart;
      default: return Bell;
    }
  };

  const renderItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.notificationItem, !item.is_read && styles.unreadItem, !item.is_read && isMePro && styles.unreadItemPro]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={[styles.iconContainer, { backgroundColor: item.is_read ? '#F3F4F6' : (isMePro ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)') }]}>
        {(() => {
          const Icon = getIcon(item.notification_type);
          return <Icon size={24} color={item.is_read ? colors.textLight : (isMePro ? '#F59E0B' : colors.primary)} strokeWidth={2} />;
        })()}
      </View>
      <View style={styles.textContainer}>
        <View style={styles.topRow}>
          <Text style={[styles.title, !item.is_read && styles.unreadText]}>{item.title}</Text>
          {!item.is_read && <View style={[styles.unreadDot, isMePro && styles.unreadDotPro]} />}
        </View>
        <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
        <Text style={styles.time}>{new Date(item.created_at).toLocaleDateString()}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color={colors.text} strokeWidth={2.4} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notificaciones</Text>
        <TouchableOpacity onPress={handleReadAll}>
          <Text style={styles.readAllText}>Leer todo</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
          ListHeaderComponent={
            <View>
              <View style={styles.preferenceCard}>
                <View style={styles.preferenceTextBox}>
                  <Text style={styles.preferenceTitle}>Notificaciones al movil</Text>
                  <Text style={styles.preferenceSubtext}>Activa o desactiva los avisos para tu cuenta. Por defecto quedan activas.</Text>
                </View>
                <Switch
                  value={allowsNotifications}
                  onValueChange={handleToggleNotifications}
                  disabled={isSavingPreference || !isAuthenticated}
                  trackColor={{ false: '#D1D5DB', true: 'rgba(16, 185, 129, 0.35)' }}
                  thumbColor={allowsNotifications ? colors.primary : '#F9FAFB'}
                />
              </View>

              {showVerificationReminder ? (
                <TouchableOpacity
                  style={styles.verificationCard}
                  activeOpacity={0.92}
                  onPress={() => router.push({ pathname: '/profile/edit', params: { section: 'verification' } })}
                >
                  <Image
                    source={require('../../assets/images/auth_hero.png')}
                    style={styles.verificationImage}
                    contentFit="cover"
                    contentPosition="top"
                  />
                  <View style={styles.verificationOverlay} />
                  <View style={styles.verificationContent}>
                    <View style={styles.verificationBadge}>
                      <BadgeCheck size={13} color={colors.primary} strokeWidth={2.4} />
                      <Text style={styles.verificationBadgeText}>Perfil veridico</Text>
                    </View>
                    <Text style={styles.verificationTitle}>Recuerda verificar tu cuenta</Text>
                    <Text style={styles.verificationText}>Anade una foto real y completa tu verificacion para transmitir mas confianza cuando compres o vendas.</Text>
                    <View style={styles.verificationAction}>
                      <Text style={styles.verificationActionText}>Verificar ahora</Text>
                      <ArrowRight size={15} color={colors.white} strokeWidth={2.4} />
                    </View>
                  </View>
                </TouchableOpacity>
              ) : null}
            </View>
          }
          ListFooterComponent={
            <View>
              {isMePro && notifications.length > 0 && <ProFooter />}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <BellOff size={60} color="#E5E7EB" strokeWidth={1.6} />
              <Text style={styles.emptyTitle}>No tienes notificaciones</Text>
              <Text style={styles.emptySubtext}>Te avisaremos cuando pase algo interesante.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  readAllText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  preferenceCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  preferenceTextBox: {
    flex: 1,
  },
  preferenceTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  preferenceSubtext: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textLight,
    fontWeight: '500',
  },
  verificationCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 24,
    overflow: 'hidden',
    minHeight: 196,
    backgroundColor: '#0F172A',
  },
  verificationImage: {
    ...StyleSheet.absoluteFillObject,
  },
  verificationOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
  },
  verificationContent: {
    padding: spacing.lg,
    justifyContent: 'flex-end',
    minHeight: 196,
  },
  verificationBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
  },
  verificationBadgeText: {
    color: '#065F46',
    fontSize: 11,
    fontWeight: '900',
  },
  verificationTitle: {
    color: colors.white,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
    maxWidth: 250,
  },
  verificationText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    marginTop: 8,
    maxWidth: 290,
  },
  verificationAction: {
    marginTop: 14,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  verificationActionText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '900',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    alignItems: 'center',
  },
  unreadItem: {
    backgroundColor: 'rgba(16, 185, 129, 0.02)',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  unreadText: {
    fontWeight: '800',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  unreadDotPro: {
    backgroundColor: '#F59E0B',
  },
  unreadItemPro: {
    backgroundColor: 'rgba(245, 158, 11, 0.03)',
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  body: {
    fontSize: 13,
    color: colors.textLight,
    lineHeight: 18,
  },
  time: {
    fontSize: 11,
    color: colors.textLight,
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textLight,
    marginTop: spacing.xs,
  },
});
