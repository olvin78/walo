import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  ActivityIndicator,
  Alert,
  Modal,
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity,
  TextInput,
  Platform,
  StatusBar,
  Animated,
  Easing,
  RefreshControl
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { LogIn, UserPlus, MapPin, CheckCircle2, AlertCircle, ChevronRight, LogOut, X, XCircle, Camera, User, List, MessageCircle, Bell, Pencil, KeyRound, Send, Bug, Sparkles } from 'lucide-react-native';
import { colors, spacing } from '../theme/colors';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../services/auth';
import { getUnreadNotificationsCount, reportBug } from '../../lib/igualo-api';
import { ProFooter } from '../components/ProFooter';

export const ProfileScreen = () => {
  const router = useRouter();
  const { user, isLoading, isAuthenticated, logout, reloadUser } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Bug Report Modal State
  const [showBugModal, setShowBugModal] = useState(false);
  const [bugDescription, setBugDescription] = useState('');
  const [bugScreenshot, setBugScreenshot] = useState<string | null>(null);
  const [isSubmittingBug, setIsSubmittingBug] = useState(false);

  // Captcha State
  const [captchaQuestion, setCaptchaQuestion] = useState({ num1: 0, num2: 0 });
  const [captchaAnswer, setCaptchaAnswer] = useState('');

  const openBugModal = () => {
    setCaptchaQuestion({
      num1: Math.floor(Math.random() * 10) + 1,
      num2: Math.floor(Math.random() * 10) + 1,
    });
    setCaptchaAnswer('');
    setShowBugModal(true);
  };

  const menuItems = [
    { icon: User, label: 'Mi Perfil', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.1)' },
    { icon: List, label: 'Mis publicaciones', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.1)' },
    { icon: MessageCircle, label: 'Mensajes', color: '#10B981', bg: 'rgba(16, 185, 129, 0.1)' },
    { icon: Bell, label: 'Notificaciones', count: unreadCount, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.1)' },
    { icon: Pencil, label: 'Editar mi perfil', color: '#6366F1', bg: 'rgba(99, 102, 241, 0.1)' },
    { icon: KeyRound, label: 'Cambiar contraseña', color: '#EC4899', bg: 'rgba(236, 72, 153, 0.1)' },
  ];

  const handleMenuPress = (label: string) => {
    if (label === 'Mensajes') {
      router.push('/messages');
    } else if (label === 'Mi Perfil') {
      router.push('/profile/me');
    } else if (label === 'Mis publicaciones') {
      router.push('/profile/listings');
    } else if (label === 'Editar mi perfil') {
      router.push('/profile/edit');
    } else if (label === 'Notificaciones') {
      router.push('/notifications');
    } else if (label === 'Cambiar contraseña') {
      router.push({ pathname: '/profile/edit', params: { section: 'security' } });
    }
  };

  const pickScreenshot = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setBugScreenshot(result.assets[0].uri);
    }
  };

  const handleSendBug = async () => {
    if (!bugDescription.trim()) {
      Alert.alert('Faltan datos', 'Cuéntanos qué está pasando.');
      return;
    }

    const expectedAnswer = captchaQuestion.num1 + captchaQuestion.num2;
    if (parseInt(captchaAnswer, 10) !== expectedAnswer) {
      Alert.alert('Error', 'La respuesta del captcha es incorrecta. Intentá de nuevo.');
      setCaptchaQuestion({
        num1: Math.floor(Math.random() * 10) + 1,
        num2: Math.floor(Math.random() * 10) + 1,
      });
      setCaptchaAnswer('');
      return;
    }

    setIsSubmittingBug(true);
    try {
      const screenshotData = bugScreenshot ? {
        uri: bugScreenshot,
        name: `bug-${Date.now()}.jpg`,
        type: 'image/jpeg'
      } : undefined;

      await reportBug(bugDescription.trim(), screenshotData as any);
      Alert.alert('¡Enviado!', 'Gracias por ayudarnos a mejorar Igualo. Revisaremos tu reporte pronto.');
      setShowBugModal(false);
      setBugDescription('');
      setBugScreenshot(null);
    } catch (e) {
      Alert.alert('Error', 'No se pudo enviar el reporte en este momento.');
    } finally {
      setIsSubmittingBug(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      let timer: NodeJS.Timeout;
      const fetchCount = async () => {
        if (isAuthenticated) {
          try {
            const data = await getUnreadNotificationsCount();
            setUnreadCount(data.unread_count);
          } catch (e) {}
        }
      };
      fetchCount();
      timer = setInterval(fetchCount, 30000) as unknown as NodeJS.Timeout;
      return () => clearInterval(timer);
    }, [isAuthenticated])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        reloadUser(),
        isAuthenticated ? getUnreadNotificationsCount().then((data) => setUnreadCount(data.unread_count)) : Promise.resolve(),
      ]);
    } catch {
      // no-op, keep previous data on failure
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.guestScrollContent} showsVerticalScrollIndicator={false}>
          {/* Hero Image */}
          <View style={styles.guestHero}>
            <Image
              source={require('../../assets/images/auth_hero.png')}
              style={styles.guestHeroImage}
              contentFit="cover"
            />
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.5)', 'rgba(255,255,255,1)']}
              style={styles.guestHeroGradient}
            />
          </View>

          {/* Content */}
          <View style={styles.guestContent}>
            <Text style={styles.guestLogo}>IGUALO</Text>
            <Text style={styles.inviteTitle}>Entra a tu cuenta</Text>
            <Text style={styles.inviteText}>
              Inicia sesión para ver tu perfil, tus anuncios y tus favoritos reales.
            </Text>

            <TouchableOpacity
              style={styles.loginBtn}
              onPress={() => router.push('/auth/login')}
              activeOpacity={0.85}
            >
              <View style={styles.loginBtnContent}>
                <LogIn size={20} color={colors.white} strokeWidth={2.2} />
                <Text style={styles.loginBtnText}>Iniciar sesión</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.registerBtn}
              onPress={() => router.push('/auth/register')}
              activeOpacity={0.85}
            >
              <View style={styles.loginBtnContent}>
                <UserPlus size={18} color={colors.primary} strokeWidth={2.2} />
                <Text style={styles.registerBtnText}>Crear cuenta</Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const profile = user.profile;
  const isMePro = Boolean(profile?.is_pro);
  const avatar = profile?.avatar 
    ? `${profile.avatar}?t=${new Date().getMinutes()}${new Date().getSeconds()}` 
    : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=60';
  const rating = profile?.rating || '5.0';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[colors.primary]} tintColor={colors.primary} />
        }
      >
        
        {/* Premium Ambient Glow */}
        <View style={styles.glowContainer}>
          <View style={[styles.glowOrb1, isMePro && { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]} />
          <View style={[styles.glowOrb2, isMePro && { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]} />
        </View>

        {/* Profile Info */}
        <View style={styles.profileInfoContainer}>
          <View style={[styles.avatarWrapper, isMePro && styles.avatarWrapperPro]}>
            <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" />
          </View>
          
          <Text style={styles.userName}>{user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : `@${user.username}`}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
          
          {profile?.location && (
            <View style={styles.locationRow}>
              <MapPin size={12} color={colors.textLight} strokeWidth={2.5} />
              <Text style={styles.locationText}>{profile.location}</Text>
            </View>
          )}

          <View style={styles.badgesRow}>
            <TouchableOpacity 
              style={[
                styles.verifiedBadge, 
                !profile?.is_verified && { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }
              ]}
              onPress={() => {
                if (!profile?.is_verified) {
                  router.push({ pathname: '/profile/edit', params: { section: 'verification' } });
                }
              }}
              activeOpacity={profile?.is_verified ? 1 : 0.7}
            >
              {profile?.is_verified 
                ? <CheckCircle2 size={12} color={colors.white} strokeWidth={3} />
                : <AlertCircle size={12} color="#EF4444" strokeWidth={3} />}
              <Text style={[
                styles.verifiedText, 
                !profile?.is_verified && { color: '#EF4444' }
              ]}>
                {profile?.is_verified ? 'Verificado' : 'Sin verificar'}
              </Text>
            </TouchableOpacity>

            {isMePro && (
              <View style={styles.proBadgeProfile}>
                <Text style={styles.proBadgeProfileText}>★ PRO</Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{profile?.followers_count || 0}</Text>
            <Text style={styles.statLabel}>Seguidores</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{profile?.listings_count || 0}</Text>
            <Text style={styles.statLabel}>Publicaciones</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{profile?.reviews_count || 0}</Text>
            <Text style={styles.statLabel}>Opiniones</Text>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity key={index} style={styles.menuItem} onPress={() => handleMenuPress(item.label)} activeOpacity={0.7}>
              <View style={[styles.menuIconCircle, { backgroundColor: item.bg }]}>
                <item.icon size={20} color={item.color} strokeWidth={2.2} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              {'count' in item && (item.count as number) > 0 && (
                <View style={styles.menuBadge}>
                  <Text style={styles.menuBadgeText}>{item.count}</Text>
                </View>
              )}
              <ChevronRight size={18} color="#D1D5DB" strokeWidth={2.5} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <View style={styles.logoutContainer}>
          <TouchableOpacity style={styles.menuItem} onPress={async () => { await logout(); router.replace('/welcome'); }} activeOpacity={0.7}> 
            <View style={[styles.menuIconCircle, { backgroundColor: '#FEF2F2' }]}>
              <LogOut size={20} color={colors.error} strokeWidth={2.2} />
            </View>
            <Text style={[styles.menuLabel, { color: colors.error, fontWeight: '700' }]}>Cerrar sesión</Text>
            <ChevronRight size={18} color="#D1D5DB" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.reportBtn} 
          activeOpacity={0.7}
          onPress={openBugModal}
        >
          <View style={styles.reportBtnContent}>
            <View style={styles.reportIconCircle}>
              <Bug size={18} color="#D97706" strokeWidth={2} />
            </View>
            <Text style={styles.reportBtnText}>Reportar una incidencia técnica</Text>
          </View>
          <ChevronRight size={16} color="#D97706" strokeWidth={2.2} />
        </TouchableOpacity>

        <ProFooter isPro={isMePro} />
        
        <View style={{ height: spacing.xl * 3 }} />
      </ScrollView>

      <Modal visible={showBugModal} transparent animationType="fade">
        <View style={styles.modalMask}>
          <View style={styles.modalBody}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>¡Ayúdanos a mejorar! 🛠️</Text>
              <TouchableOpacity onPress={() => setShowBugModal(false)}>
                <X size={24} color={colors.text} strokeWidth={2.2} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSub}>¿Algo no funciona como debería? Explícanos qué está pasando y lo revisaremos cuanto antes.</Text>
            
            <Text style={styles.modalLabel}>¿CÓMO PODEMOS AYUDAR?</Text>
            <TextInput 
              style={styles.bugInput}
              multiline
              placeholder="Explícanos tu sugerencia o el problema que encontraste..."
              placeholderTextColor={colors.textLight}
              value={bugDescription}
              onChangeText={setBugDescription}
            />

            <Text style={styles.modalLabel}>CAPTURA DE PANTALLA (OPCIONAL):</Text>
            <TouchableOpacity style={styles.screenshotBtn} onPress={pickScreenshot}>
              {bugScreenshot ? (
                <View style={styles.screenshotPreview}>
                  <Image source={{ uri: bugScreenshot }} style={styles.screenshotImg} />
                  <TouchableOpacity style={styles.removeScreenshot} onPress={() => setBugScreenshot(null)}>
                    <XCircle size={20} color={colors.error} strokeWidth={2.2} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.screenshotPlaceholder}>
                  <Camera size={24} color={colors.textLight} strokeWidth={2} />
                  <Text style={styles.screenshotText}>SELECCIONAR IMAGEN...</Text>
                </View>
              )}
            </TouchableOpacity>

            <Text style={styles.modalLabel}>CAPTCHA DE VERIFICACIÓN:</Text>
            <View style={styles.captchaRow}>
              <Text style={styles.captchaQuestion}>{captchaQuestion.num1} + {captchaQuestion.num2} =</Text>
              <TextInput 
                style={styles.captchaInput}
                keyboardType="numeric"
                placeholder="Tu respuesta"
                placeholderTextColor={colors.textLight}
                value={captchaAnswer}
                onChangeText={setCaptchaAnswer}
              />
            </View>

            <TouchableOpacity 
              style={[styles.sendBugBtn, isSubmittingBug && { opacity: 0.7 }]} 
              onPress={handleSendBug}
              disabled={isSubmittingBug}
            >
              {isSubmittingBug ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.sendBugText}>ENVIAR COMENTARIO</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.white, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  // Guest / Unauthenticated State
  guestScrollContent: { flexGrow: 1 },
  guestHero: { height: 300, width: '100%', position: 'relative', overflow: 'hidden' },
  guestHeroImage: { width: '100%', height: '100%' },
  guestHeroGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 },
  guestContent: { paddingHorizontal: spacing.xl, marginTop: -spacing.lg, paddingBottom: spacing.xl * 2 },
  guestLogo: { color: colors.primary, fontSize: 32, fontWeight: '900', textAlign: 'center', letterSpacing: 2 },
  inviteTitle: { marginTop: spacing.sm, fontSize: 26, fontWeight: '900', color: colors.text, textAlign: 'center', letterSpacing: -0.5 },
  inviteText: { marginTop: spacing.xs, color: '#9CA3AF', textAlign: 'center', lineHeight: 22, fontSize: 14, fontWeight: '500', marginBottom: spacing.lg },
  loginBtn: { marginTop: spacing.md, height: 56, alignSelf: 'stretch', borderRadius: 16, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  loginBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loginBtnText: { color: colors.white, fontWeight: '900', fontSize: 16, letterSpacing: 0.3 },
  registerBtn: { marginTop: spacing.md, height: 56, alignSelf: 'stretch', borderRadius: 16, borderWidth: 2, borderColor: colors.primary, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.04)' },
  registerBtnText: { color: colors.primary, fontWeight: '900', fontSize: 16, letterSpacing: 0.3 },
  glowContainer: { position: 'absolute', top: 0, left: 0, right: 0, height: 250, overflow: 'hidden' },
  glowOrb1: { position: 'absolute', top: -50, left: -50, width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(16, 185, 129, 0.15)' },
  glowOrb2: { position: 'absolute', top: -20, right: -80, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(14, 165, 233, 0.1)' },
  
  profileInfoContainer: { alignItems: 'center', marginTop: 40, paddingHorizontal: 20 },
  avatarWrapper: { width: 110, height: 110, borderRadius: 55, backgroundColor: colors.white, padding: 4, shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 15, elevation: 5 },
  avatarWrapperPro: { shadowColor: '#F59E0B', borderColor: '#F59E0B', borderWidth: 2, padding: 2 },
  avatar: { width: '100%', height: '100%', borderRadius: 55 },
  userName: { fontSize: 26, fontWeight: '900', color: '#0F172A', marginTop: 16, letterSpacing: -0.5 },
  userEmail: { fontSize: 14, color: '#64748B', marginTop: 2, fontWeight: '500' },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  locationText: { fontSize: 12, color: '#475569', marginLeft: 4, fontWeight: '700' },
  badgesRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginTop: 12 },
  verifiedText: { fontSize: 12, fontWeight: '800', color: colors.white, marginLeft: 6 },
  proBadgeProfile: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F2937', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginTop: 12 },
  proBadgeProfileText: { color: '#FBBF24', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  
  statsRow: { flexDirection: 'row', marginHorizontal: spacing.lg, marginTop: 24, paddingVertical: 20, borderRadius: 24, backgroundColor: colors.white, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 15, elevation: 4 },
  statBox: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: '80%', backgroundColor: '#F1F5F9', alignSelf: 'center' },
  statNum: { fontSize: 22, fontWeight: '900', color: '#0F172A' },
  statLabel: { fontSize: 13, color: '#64748B', marginTop: 4, fontWeight: '600' },
  
  menuContainer: { backgroundColor: colors.white, marginTop: 24, marginHorizontal: spacing.lg, borderRadius: 24, padding: spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.03, shadowRadius: 15, elevation: 2 },
  logoutContainer: { backgroundColor: colors.white, marginTop: 16, marginHorizontal: spacing.lg, borderRadius: 24, padding: spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.03, shadowRadius: 15, elevation: 2 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: spacing.sm },
  menuIconCircle: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  menuLabel: { flex: 1, fontSize: 16, color: '#334155', fontWeight: '700' },
  menuBadge: { backgroundColor: colors.error, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginRight: 12 },
  menuBadgeText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  
  reportBtn: { flexDirection: 'row', marginTop: 32, marginHorizontal: spacing.lg, paddingHorizontal: spacing.lg, height: 64, borderRadius: 20, backgroundColor: '#FFFBEB', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 },
  reportBtnContent: { flexDirection: 'row', alignItems: 'center' },
  reportIconCircle: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  reportBtnText: { color: '#92400E', fontWeight: '700', fontSize: 14 },
  modalMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBody: { width: '100%', maxWidth: 400, backgroundColor: colors.white, borderRadius: 25, padding: 25 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: colors.text },
  modalSub: { fontSize: 14, color: colors.textLight, lineHeight: 20, marginBottom: 20 },
  modalLabel: { fontSize: 11, fontWeight: '900', color: colors.textLight, letterSpacing: 1, marginBottom: 8 },
  bugInput: { backgroundColor: '#F9FAFB', borderRadius: 15, padding: 15, color: colors.text, fontSize: 15, height: 120, textAlignVertical: 'top', borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 20 },
  screenshotBtn: { height: 80, borderRadius: 15, borderStyle: 'dashed', borderWidth: 2, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center', marginBottom: 25, overflow: 'hidden' },
  screenshotPlaceholder: { flexDirection: 'row', alignItems: 'center' },
  screenshotText: { fontSize: 12, fontWeight: '800', color: colors.textLight, marginLeft: 10 },
  screenshotPreview: { width: '100%', height: '100%', position: 'relative' },
  screenshotImg: { width: '100%', height: '100%' },
  removeScreenshot: { position: 'absolute', top: 5, right: 5 },
  captchaRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 15, padding: 15, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 25 },
  captchaQuestion: { fontSize: 18, fontWeight: '900', color: colors.text, marginRight: 15 },
  captchaInput: { flex: 1, fontSize: 16, color: colors.text, borderBottomWidth: 1, borderBottomColor: '#D1D5DB', paddingBottom: 5 },
  sendBugBtn: { height: 56, backgroundColor: colors.primary, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  sendBugText: { color: colors.white, fontWeight: '900', fontSize: 16 },
});
