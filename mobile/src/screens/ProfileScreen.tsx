import React, { useState, useCallback } from 'react';
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
  StatusBar
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { LogIn, UserPlus, MapPin, CheckCircle2, AlertCircle, ChevronRight, LogOut, X, XCircle, Camera, User, List, MessageCircle, Bell, Pencil, KeyRound, Send, Bug } from 'lucide-react-native';
import { colors, spacing } from '../theme/colors';
import { useRouter } from 'expo-router';
import { useAuth } from '../services/auth';
import { getUnreadNotificationsCount, reportBug } from '../../lib/igualo-api';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

export const ProfileScreen = () => {
  const router = useRouter();
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  
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
    { icon: User, label: 'Mi Perfil' },
    { icon: List, label: 'Mis publicaciones' },
    { icon: MessageCircle, label: 'Mensajes' },
    { icon: Bell, label: 'Notificaciones', count: unreadCount },
    { icon: Pencil, label: 'Editar mi perfil' },
    { icon: KeyRound, label: 'Cambiar contraseña' },
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
  const avatar = profile?.avatar 
    ? `${profile.avatar}?t=${new Date().getMinutes()}${new Date().getSeconds()}` 
    : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=60';
  const rating = profile?.rating || '5.0';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <Image source={{ uri: avatar }} style={styles.avatar} />
          <View style={styles.userText}>
            <View>
              <Text style={styles.userName}>{user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : `@${user.username}`}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
              {profile?.location && (
                <View style={styles.locationRow}>
                  <MapPin size={12} color={colors.textLight} strokeWidth={2.2} />
                  <Text style={styles.locationText}>{profile.location}</Text>
                </View>
              )}
            </View>
            <View style={styles.badgeRow}>
              <View style={[
                styles.verifiedBadge, 
                !profile?.is_verified && { backgroundColor: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.1)' }
              ]}>
                {profile?.is_verified 
                  ? <CheckCircle2 size={12} color={colors.primary} strokeWidth={2.4} />
                  : <AlertCircle size={12} color={colors.error} strokeWidth={2.4} />}
                <Text style={[
                  styles.verifiedText, 
                  !profile?.is_verified && { color: colors.error }
                ]}>
                  {profile?.is_verified ? 'Verificado' : 'Sin verificar'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{profile?.followers_count || 0}</Text>
            <Text style={styles.statLabel}>Seguidores</Text>
          </View>
          <View style={[styles.statBox, styles.statBorder]}>
            <Text style={styles.statNum}>{profile?.listings_count || 0}</Text>
            <Text style={styles.statLabel}>Publicaciones</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{profile?.reviews_count || 0}</Text>
            <Text style={styles.statLabel}>Opiniones</Text>
          </View>
        </View>

        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity key={index} style={styles.menuItem} onPress={() => handleMenuPress(item.label)}>
              <View style={styles.menuIconCircle}>
                <item.icon size={20} color={colors.text} strokeWidth={2} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              {'count' in item && (item.count as number) > 0 && (
                <View style={styles.menuBadge}>
                  <Text style={styles.menuBadgeText}>{item.count}</Text>
                </View>
              )}
              <ChevronRight size={16} color="#D1D5DB" strokeWidth={2.2} />
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={logout}> 
            <View style={styles.menuIconCircle}>
              <LogOut size={20} color={colors.error} strokeWidth={2.2} />
            </View>
            <Text style={[styles.menuLabel, { color: colors.error }]}>Cerrar sesión</Text>
            <ChevronRight size={16} color="#D1D5DB" strokeWidth={2.2} />
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
  profileHeader: { flexDirection: 'row', padding: spacing.lg, paddingTop: spacing.xl, backgroundColor: colors.white, alignItems: 'center' },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: '#F3F4F6' },
  userText: { marginLeft: spacing.lg, flex: 1, justifyContent: 'center' },
  userName: { fontSize: 22, fontWeight: '900', color: colors.text, letterSpacing: -0.5 },
  userEmail: { fontSize: 13, color: colors.textLight, marginTop: 1, fontWeight: '500' },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  locationText: { fontSize: 12, color: colors.textLight, marginLeft: 3, fontWeight: '600' },
  badgeRow: { flexDirection: 'row', marginTop: 10, gap: 8 },
  proBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accent, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: colors.accent },
  proText: { fontSize: 12, fontWeight: '900', color: colors.white, marginLeft: 4 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.05)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.1)' },
  verifiedText: { fontSize: 12, fontWeight: '700', color: colors.primary, marginLeft: 6 },
  statsRow: { flexDirection: 'row', marginHorizontal: spacing.md, marginVertical: spacing.sm, paddingVertical: spacing.lg, borderRadius: 20, borderWidth: 1, borderColor: '#F3F4F6', backgroundColor: '#F9FAFB' },
  statBox: { flex: 1, alignItems: 'center' },
  statBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#E5E7EB' },
  statNum: { fontSize: 18, fontWeight: '900', color: colors.text },
  statLabel: { fontSize: 12, color: colors.textLight, marginTop: 2, fontWeight: '500' },
  menuContainer: { backgroundColor: colors.white, marginTop: spacing.md, marginHorizontal: spacing.md, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden', padding: spacing.sm },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: spacing.sm, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  menuIconCircle: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center', marginRight: 14, borderWidth: 1, borderColor: '#F3F4F6' },
  menuLabel: { flex: 1, fontSize: 15, color: colors.text, fontWeight: '600' },
  menuBadge: { backgroundColor: colors.error, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginRight: 8 },
  menuBadgeText: { color: colors.white, fontSize: 11, fontWeight: 'bold' },
  reportBtn: { flexDirection: 'row', marginTop: spacing.xl, marginHorizontal: spacing.md, paddingHorizontal: spacing.md, height: 58, borderRadius: 16, borderWidth: 1, borderColor: '#FDE68A', backgroundColor: '#FFFBEB', justifyContent: 'space-between', alignItems: 'center' },
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
