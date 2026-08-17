import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
  Share as RNShare,
  Linking,
  Animated,
  Easing,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Heart, Flag, X, Share2, MapPin, BadgeCheck, MessageCircle, Send, Check, Link2 } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import ConfettiCannon from 'react-native-confetti-cannon';
import * as Clipboard from 'expo-clipboard';
import { colors, spacing } from '../theme/colors';
import { 
  createConversation, 
  getListingDetail, 
  setListingFavorite, 
  makeOffer, 
  reportListing,
  deleteListing,
  WEB_BASE_URL,
  type ListingDetail, 
  type ReportReason 
} from '../services/api';
import { useAuth } from '../services/auth';
import { ProductCard } from '../components/ProductCard';
import { getListings } from '../services/api';

const SPARKLE_CHARS = ['✦', '★', '•', '✧'];

const Sparkle = ({ index }: { index: number }) => {
  const char = useRef(SPARKLE_CHARS[Math.floor(Math.random() * SPARKLE_CHARS.length)]).current;
  const startX = useRef(20 + Math.random() * 130).current;
  const startY = useRef(140 + Math.random() * 30).current;
  const color = useRef(Math.random() > 0.4 ? '#4ade80' : '#fef08a').current;
  const size = useRef(10 + Math.random() * 14).current;
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 1100 + Math.random() * 500,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.Text
      style={{
        position: 'absolute',
        left: startX,
        top: startY,
        fontSize: size,
        color: color,
        textShadowColor: 'rgba(74, 222, 128, 0.8)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 8,
        opacity: anim.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 45 + Math.random() * 45] }) },
          { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, (Math.random() - 0.5) * 30] }) },
          { rotate: anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(Math.random() - 0.5) * 120}deg`] }) },
        ]
      }}
    >
      {char}
    </Animated.Text>
  );
};

const FairyDust = () => {
  const [sparkles, setSparkles] = useState<{ id: number }[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSparkles(prev => [...prev.slice(-20), { id: Date.now() }]);
    }, 80);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {sparkles.map((s, i) => <Sparkle key={s.id} index={i} />)}
    </View>
  );
};

interface ListingDetailScreenProps {
  listingId: string;
}

export const ListingDetailScreen: React.FC<ListingDetailScreenProps> = ({ listingId }) => {
  const router = useRouter();
  const params = useLocalSearchParams<{ isNew?: string; updated?: string }>();
  const { isAuthenticated, user: currentUser } = useAuth();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [similar, setSimilar] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);

  // States
  const [showModal, setShowModal] = useState<'none' | 'offer' | 'report' | 'share'>('none');
  const [showCelebration, setShowCelebration] = useState(params.isNew === 'true' || params.updated === 'true');
  const isUpdateCelebration = params.updated === 'true';
  const updateCelebrationTitles = ['¡Así se hace!', '¡No te des por vencido!', '¡Vas que vuelas!', '¡Eso es dedicación!', '¡Como nuevo!'];
  const [updateCelebrationTitle] = useState(() => updateCelebrationTitles[Math.floor(Math.random() * updateCelebrationTitles.length)]);
  const [formData, setFormData] = useState({ amount: '', message: '', description: '' });
  
  const floatAnim = React.useRef(new Animated.Value(0)).current;
  const glowAnim = React.useRef(new Animated.Value(0)).current;

  const isPromoted = Boolean(listing?.is_promoted);

  React.useEffect(() => {
    if (isPromoted) {
      glowAnim.setValue(0);
      Animated.loop(
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 5000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        })
      ).start();
    }
  }, [isPromoted, glowAnim]);

  const glowTranslateX = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-150, windowWidth + 50],
  });

  React.useEffect(() => {
    if (showCelebration) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [showCelebration]);

  const [reason, setReason] = useState<ReportReason | ''>('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await getListingDetail(listingId);
      setListing(data);
      setIsFavorite(!!data.is_favorite);
      setFormData(prev => ({ ...prev, amount: String(data.price || '') }));
      try {
        const s = await getListings();
        const others = (s.results || []).filter((l: any) => l.id !== data.id && l.category?.id === data.category?.id).slice(0, 6);
        setSimilar(others.length > 0 ? others : (s.results || []).filter((l: any) => l.id !== data.id).slice(0, 6));
      } catch { /* similar no crítico */ }
    } catch {
      Alert.alert('Error', 'No se pudo cargar el anuncio');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [listingId]);

  useEffect(() => { load(); }, [load]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await load(true);
    } finally {
      setIsRefreshing(false);
    }
  };

  const onReport = async () => {
    if (!reason) return Alert.alert('Error', 'Selecciona un motivo');
    setSubmitting(true);
    try {
      await reportListing(listingId, reason as ReportReason, formData.description);
      Alert.alert('Éxito', 'Reporte enviado correctamente');
      setShowModal('none');
    } catch {
      Alert.alert('Error', 'No se pudo enviar el reporte');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleFav = async () => {
    if (!isAuthenticated) return router.push('/auth/login');
    try {
      const newStatus = !isFavorite;
      setIsFavorite(newStatus);
      await setListingFavorite(parseInt(listingId), newStatus);
    } catch {
      setIsFavorite(!isFavorite);
      Alert.alert('Error', 'No se pudo actualizar favoritos');
    }
  };

  const handleDelete = () => {
    if (!listing) return;
    Alert.alert('Eliminar anuncio', `Vas a eliminar "${listing.title}". Esta acción lo quitará de la plataforma y borrará sus imágenes asociadas. No se puede deshacer.`, [
      { text: 'Cancelar', style: 'cancel' },
      { 
        text: 'Sí, eliminar', 
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteListing(listingId);
            Alert.alert('Eliminado', 'El anuncio ha sido eliminado.');
            router.replace('/(tabs)/profile');
          } catch {
            Alert.alert('Error', 'No se pudo eliminar el anuncio.');
          }
        }
      }
    ]);
  };

  const shareLink = () => {
    const url = `${WEB_BASE_URL}/anuncio/${listingId}${listing?.slug ? `-${listing.slug}` : ''}/`;
    return url;
  };

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(shareLink());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShare = async (channel?: string) => {
    const url = shareLink();
    let text = `🛍️ ¡Mira lo que acabo de publicar en Igualo!\n\n✨ *${listing?.title || ''}*`;
    if (listing?.location) {
      text += `\n📍 Ubicación: ${listing.location}`;
    }
    text += `\n\n👉 Entra al enlace para ver las fotos, el precio y contactarme:`;

    if (channel === 'whatsapp') {
      Linking.openURL(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`);
    } else if (channel === 'facebook') {
      Linking.openURL(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);
    } else if (channel === 'twitter') {
      Linking.openURL(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`);
    } else {
      try {
        await RNShare.share({ message: `${text}\n${url}` });
      } catch {}
    }
  };

  const openMaps = () => {
    if (!listing) return;
    const lat = listing.latitude;
    const lng = listing.longitude;
    const query = lat && lng ? `${lat},${lng}` : encodeURIComponent(listing.location || 'Nicaragua');
    const mapsUrl = Platform.OS === 'ios'
      ? `https://maps.apple.com/?q=${query}`
      : `https://www.google.com/maps/search/?api=1&query=${query}`;
    Linking.openURL(mapsUrl);
  };

  const startChat = async () => {
    if (!isAuthenticated) return router.push('/auth/login');
    const c = await createConversation(listingId);
    router.push(`/messages/${c.id}`);
  };

  const sendWhatsApp = () => {
    const phone = listing?.whatsapp;
    if (!phone) return;
    const clean = String(phone).replace(/[^0-9]/g, '');
    const url = `https://wa.me/${clean}?text=${encodeURIComponent(`Hola, me interesa tu anuncio "${listing?.title}" en Igualo`)}`;
    Linking.openURL(url);
  };

  const allImages = [
    ...(listing?.main_image ? [{ url: listing.main_image }] : []),
    ...(listing?.images || []).map(img => ({ url: img.url || '' })).filter(img => img.url),
  ].filter(img => img.url);

  if (isLoading) return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  if (!listing) return <View style={[styles.container, styles.center]}><Text style={{color: colors.text}}>No disponible</Text></View>;

  const displayPrice = listing.is_negotiable || Number(listing.price) === 0
    ? '🤝 Precio Negociable'
    : `${listing.currency === 'USD' ? '$' : 'C$'} ${Number(listing.price).toLocaleString('es-NI', { maximumFractionDigits: 0 })}`;

  return (
    <View style={[styles.container, Platform.OS === 'web' && styles.webContainer]}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[colors.primary]} tintColor={colors.primary} />
        }
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={24} color={colors.text} strokeWidth={2.4} />
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => setShowModal('share')} style={styles.backBtn}>
              <Share2 size={22} color={colors.text} strokeWidth={2.2} />
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleFav} style={styles.backBtn}>
              <Heart size={24} color={isFavorite ? colors.error : colors.text} strokeWidth={2.2} fill={isFavorite ? colors.error : "none"} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Galería de imágenes (carrusel) */}
        <View style={[styles.heroContainer, { height: Platform.OS === 'web' ? 460 : 360 }]}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setActiveImage(Math.round(e.nativeEvent.contentOffset.x / windowWidth))}
          >
            {(allImages.length > 0 ? allImages : [{ url: '' }]).map((img, i) => (
              <TouchableOpacity 
                key={i} 
                activeOpacity={0.9}
                onPress={() => setViewerVisible(true)}
                style={{ width: Platform.OS === 'web' ? 800 : windowWidth, height: '100%' }}
              >
                <Image
                  source={{ uri: img.url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800' }}
                  style={styles.heroBlurBg}
                  contentFit="cover"
                  blurRadius={12}
                />
                <Image
                  source={{ uri: img.url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800' }}
                  style={styles.heroImage}
                  contentFit="contain"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
          {allImages.length > 1 ? (
            <View style={styles.dotsRow}>
              {allImages.map((_, i) => (
                <View key={i} style={[styles.dot, i === activeImage && styles.dotActive]} />
              ))}
            </View>
          ) : null}
        </View>
        
        <View style={[styles.content, isPromoted && { overflow: 'hidden' }]}>
          {isPromoted && (
            <View style={styles.proTopBorderContainer}>
              <View style={styles.proTopBorderLine} />
              <View style={styles.proShineDustContainer}>
                {[
                  { left: '8%', top: -2, size: 8, opacity: 0.8, color: '#F59E0B' },
                  { left: '18%', top: 4, size: 10, opacity: 0.7, color: '#FBBF24' },
                  { left: '28%', top: 1, size: 6, opacity: 0.9, color: '#F59E0B' },
                  { left: '38%', top: 7, size: 8, opacity: 0.6, color: '#D97706' },
                  { left: '48%', top: -1, size: 12, opacity: 0.5, color: '#F59E0B' },
                  { left: '58%', top: 5, size: 7, opacity: 0.6, color: '#D97706' },
                  { left: '68%', top: 9, size: 6, opacity: 0.4, color: '#F59E0B' },
                  { left: '78%', top: -3, size: 9, opacity: 0.3, color: '#FBBF24' },
                  { left: '88%', top: 6, size: 8, opacity: 0.5, color: '#F59E0B' },
                  { left: '96%', top: 2, size: 6, opacity: 0.7, color: '#FBBF24' },
                ].map((dust, i) => (
                  <Text 
                    key={i} 
                    style={[
                      styles.fairyDust, 
                      { 
                        left: dust.left as any, 
                        top: dust.top, 
                        fontSize: dust.size,
                        opacity: dust.opacity,
                        color: dust.color
                      }
                    ]} 
                  >
                    ✦
                  </Text>
                ))}
              </View>

              <Animated.View style={[styles.proShineLine, { transform: [{ translateX: glowTranslateX }] }]}>
                <LinearGradient
                  colors={['#F59E0B', '#FFFFFF', '#F59E0B', '#FEF08A', '#F59E0B', '#FFFFFF', '#F59E0B']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.proShineGradient}
                />
              </Animated.View>
            </View>
          )}
          <View style={styles.badgesRow}>
            {isPromoted ? (
              <View style={styles.promotedContentBadge}>
                <Text style={styles.promotedContentText}>★ PRO</Text>
              </View>
            ) : null}
            <Text style={styles.category}>
              {listing.category?.name.toUpperCase()}
              {listing.subcategory ? ` › ${listing.subcategory.name.toUpperCase()}` : ''}
            </Text>
            {listing.is_active ? (
              <View style={styles.availableBadge}><Text style={styles.availableText}>DISPONIBLE</Text></View>
            ) : null}
          </View>
          <Text style={styles.title}>{listing.title}</Text>
          <Text style={[styles.price, listing.is_negotiable && { color: colors.primary, fontSize: 24 }]}>
            {displayPrice}
          </Text>

          {listing.location ? (
            <TouchableOpacity style={styles.locationRow} onPress={openMaps} activeOpacity={0.7}>
              <MapPin size={15} color={colors.primary} strokeWidth={2.2} />
              <Text style={styles.locationText}>{listing.location}</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.actionsBox}>
            <TouchableOpacity style={styles.btnMsg} onPress={startChat}>
              <MessageCircle size={18} color={colors.white} strokeWidth={2.2} />
              <Text style={styles.btnMsgText}>ENVIAR MENSAJE</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnOffer} onPress={() => setShowModal('offer')}>
              <Text style={styles.btnOfferText}>HACER OFERTA</Text>
            </TouchableOpacity>

            {listing.whatsapp ? (
              <TouchableOpacity style={styles.btnWhatsapp} onPress={sendWhatsApp}>
                <Send size={16} color="#25D366" strokeWidth={2.2} />
                <Text style={styles.btnWhatsappText}>WhatsApp</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.divider} />

          {/* Seller info */}
          <View style={styles.sellerRow}>
            <View style={[styles.avatar, isPromoted && styles.avatarPro]}>
              <Text style={[styles.avatarText, isPromoted && styles.avatarTextPro]}>{listing.seller?.username?.slice(0,1).toUpperCase() || '?'}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.sellerName}>{listing.seller?.username || 'Anónimo'}</Text>
                {listing.seller?.is_verified ? <BadgeCheck size={16} color="#3b82f6" strokeWidth={2.2} style={{ marginLeft: 5 }} /> : null}
              </View>
              <Text style={styles.sellerStars}>★ ★ ★ ★ ★ <Text style={{color: colors.textLight}}>(12 ventas)</Text></Text>
            </View>
            <TouchableOpacity onPress={() => listing.seller?.username && router.push(`/profile/${listing.seller.username}`)}>
              <Text style={styles.viewProfile}>Ver Perfil</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />
          
          <Text style={styles.sectionTitle}>Descripción</Text>
          <Text style={styles.description}>{listing.description}</Text>

          {similar.length > 0 ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Anuncios similares</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.similarScroll}>
                {similar.map((item) => (
                  <ProductCard key={item.id} product={item} numColumns={3} width={180} />
                ))}
              </ScrollView>
            </>
          ) : null}

          {currentUser?.id && listing.seller?.id === currentUser.id ? (
            <View style={styles.ownerActions}>
              <TouchableOpacity style={styles.editBtn} onPress={() => router.push(`/listing/${listingId}/edit`)}>
                <Text style={styles.editBtnText}>EDITAR ANUNCIO</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                <Text style={styles.deleteBtnText}>ELIMINAR</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              activeOpacity={0.7}
              style={styles.reportBtn} 
              onPress={() => setShowModal('report')}
            >
              <Flag size={14} color={colors.textLight} strokeWidth={2.2} />
              <Text style={styles.reportText}>Reportar anuncio</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* IMAGE VIEWER MODAL */}
      <Modal visible={viewerVisible} transparent animationType="fade">
        <View style={styles.viewerContainer}>
          <TouchableOpacity 
            style={styles.viewerCloseBtn} 
            onPress={() => setViewerVisible(false)}
          >
            <X size={28} color="#fff" />
          </TouchableOpacity>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: activeImage * windowWidth, y: 0 }}
          >
            {allImages.map((img, i) => (
              <ScrollView
                key={i}
                style={{ width: windowWidth, height: '100%' }}
                contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
                maximumZoomScale={3}
                minimumZoomScale={1}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
              >
                <Image
                  source={{ uri: img.url }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="contain"
                />
              </ScrollView>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* MODAL */}
      <Modal visible={showModal !== 'none'} transparent animationType="slide">
        <View style={styles.modalMask}>
          <View style={styles.modalBody}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {showModal === 'offer' ? 'Hacer Oferta' : showModal === 'report' ? 'Reportar Anuncio' : 'Compartir anuncio'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal('none')}><X size={24} color={colors.text} strokeWidth={2.4} /></TouchableOpacity>
            </View>

            {showModal === 'offer' ? (
              <View style={styles.offerContainer}>
                <View style={styles.offerAmountWrapper}>
                  <Text style={styles.offerCurrencySign}>C$</Text>
                  <TextInput 
                    style={styles.offerAmountInput} 
                    value={formData.amount} 
                    onChangeText={t => setFormData({...formData, amount:t})} 
                    keyboardType="decimal-pad" 
                    placeholder="0.00" 
                    placeholderTextColor="rgba(16, 185, 129, 0.3)"
                  />
                </View>
                <Text style={styles.offerHelperText}>El vendedor evaluará tu propuesta.</Text>

                <View style={styles.offerMessageWrapper}>
                  <TextInput 
                    style={styles.offerMessageInput} 
                    value={formData.message} 
                    onChangeText={t => setFormData({...formData, message:t})} 
                    multiline 
                    placeholder="Escribe un mensaje para el vendedor (opcional)..." 
                    placeholderTextColor={colors.textLight}
                  />
                </View>
                <TouchableOpacity style={styles.confirmBtn} onPress={async () => {
                  setSubmitting(true);
                  try {
                    const r = await makeOffer(listingId, formData.amount, formData.message);
                    setShowModal('none');
                    router.push(`/messages/${r.conversation_id}`);
                  } catch { Alert.alert('Error', 'Fallo al enviar oferta'); }
                  finally { setSubmitting(false); }
                }}>
                  {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.confirmBtnText}>ENVIAR OFERTA</Text>}
                </TouchableOpacity>
              </View>
            ) : showModal === 'report' ? (
              <View>
                <View style={styles.reasonsGrid}>
                  {['fraud', 'spam', 'inappropriate', 'other'].map((r) => (
                    <TouchableOpacity 
                      key={r} 
                      style={[styles.reasonItem, reason === r && styles.reasonActive]} 
                      onPress={() => setReason(r as any)}
                    >
                      <Text style={[styles.reasonText, reason === r && styles.reasonTextActive]}>
                        {r === 'fraud' ? 'Fraude' : r === 'spam' ? 'Spam' : r === 'inappropriate' ? 'Inapropiado' : 'Otro'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput 
                  style={[styles.input, {height:100, marginTop:15, textAlignVertical:'top'}]} 
                  value={formData.description} 
                  onChangeText={t => setFormData({...formData, description:t})} 
                  multiline 
                  placeholder="¿Por qué reportas este anuncio?" 
                  placeholderTextColor={colors.textLight}
                />
                <TouchableOpacity style={[styles.confirmBtn, {backgroundColor: colors.error}]} onPress={onReport}>
                  {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={[styles.confirmBtnText, {color: colors.white}]}>ENVIAR REPORTE</Text>}
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <TouchableOpacity style={styles.shareRow} onPress={() => handleShare('whatsapp')}>
                  <View style={[styles.shareIcon, { backgroundColor: '#25D366' }, isPromoted && styles.shareIconPro]}><Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>W</Text></View>
                  <Text style={[styles.shareLabel, isPromoted && styles.shareLabelPro]}>WhatsApp</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shareRow} onPress={() => handleShare('facebook')}>
                  <View style={[styles.shareIcon, { backgroundColor: '#1877F2' }, isPromoted && styles.shareIconPro]}><Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>f</Text></View>
                  <Text style={[styles.shareLabel, isPromoted && styles.shareLabelPro]}>Facebook</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shareRow} onPress={() => handleShare('twitter')}>
                  <View style={[styles.shareIcon, { backgroundColor: '#000000' }, isPromoted && styles.shareIconPro]}><Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>𝕏</Text></View>
                  <Text style={[styles.shareLabel, isPromoted && styles.shareLabelPro]}>X (Twitter)</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shareRow} onPress={handleCopyLink}>
                  <View style={[styles.shareIcon, { backgroundColor: copied ? '#16A34A' : colors.primary }, isPromoted && styles.shareIconPro]}>
                    {copied ? <Check size={18} color="#fff" strokeWidth={2.5} /> : <Link2 size={18} color="#fff" strokeWidth={2.2} />}
                  </View>
                  <Text style={[styles.shareLabel, isPromoted && styles.shareLabelPro]}>{copied ? '¡Enlace copiado!' : 'Copiar enlace'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shareRow} onPress={() => handleShare()}>
                  <View style={[styles.shareIcon, { backgroundColor: colors.textLight }, isPromoted && styles.shareIconPro]}><Share2 size={18} color="#fff" strokeWidth={2.2} /></View>
                  <Text style={[styles.shareLabel, isPromoted && styles.shareLabelPro]}>Otras opciones</Text>
                </TouchableOpacity>
                <View style={[styles.shareHint, isPromoted && styles.shareHintPro]}>
                  <Text style={[styles.shareHintText, isPromoted && styles.shareHintTextPro]}>Los anuncios compartidos se venden hasta 3 veces más rápido.</Text>
                </View>
                {isPromoted && (
                  <View style={[styles.shareHint, styles.shareHintPro, styles.shareHintProHighlight]}>
                    <Text style={[styles.shareHintText, styles.shareHintTextPro]}>Como anuncio PRO, te ayudamos a publicar tus anuncios más seguido y llegar a más compradores.</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Celebration Overlay Modal */}
      <Modal visible={showCelebration} transparent animationType="fade">
        <View style={styles.celebrationOverlay}>
          <ConfettiCannon 
            count={120} 
            origin={{ x: windowWidth / 2, y: windowHeight / 2 }} 
            explosionSpeed={350}
            fallSpeed={3000}
            fadeOut={true}
            autoStart={true}
          />
          <View style={styles.celebrationCard}>
            <Animated.View style={[
              styles.mascotContainer, 
              { transform: [{ translateY: floatAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 10] }) }] }
            ]}>
              <Image source={require('../../assets/images/yuhuu_mascot_transparent.png')} style={styles.mascotImg} contentFit="contain" />
              <FairyDust />
            </Animated.View>
            <Text style={styles.celebrationTitle}>{isUpdateCelebration ? updateCelebrationTitle : '¡YUHUUU!'}</Text>
            <Text style={styles.celebrationSubtitle}>
              {isUpdateCelebration ? '¡Tu anuncio se actualizó correctamente!' : '¡Tu anuncio ya está activo en Igualo!'}
            </Text>
            <Text style={styles.celebrationListingName}>{listing?.title || 'Tu Anuncio'}</Text>

            <View style={styles.celebrationButtons}>
              {!isUpdateCelebration && (
                <TouchableOpacity style={styles.btnCelebrationPrimary} onPress={() => {
                  setShowCelebration(false);
                  router.replace('/(tabs)/publish');
                }}>
                  <Text style={styles.btnCelebrationPrimaryText}>Publicar otro producto</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.btnCelebrationSecondary} onPress={() => setShowCelebration(false)}>
                <Text style={styles.btnCelebrationSecondaryText}>Ver mi anuncio</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.celebrationShareSection}>
              <Text style={styles.shareTitle}>¡Atrae compradores compartiendo tu anuncio!</Text>
              <View style={styles.shareIconsRow}>
                <TouchableOpacity style={styles.celebrationShareIconBtn} onPress={() => handleShare('whatsapp')}>
                  <View style={[styles.shareIcon, { backgroundColor: '#25D366' }]}><Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>W</Text></View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.celebrationShareIconBtn} onPress={() => handleShare('facebook')}>
                  <View style={[styles.shareIcon, { backgroundColor: '#1877F2' }]}><Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>f</Text></View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.celebrationShareIconBtn} onPress={() => handleShare('twitter')}>
                  <View style={[styles.shareIcon, { backgroundColor: '#000000' }]}><Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>𝕏</Text></View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.celebrationShareIconBtn} onPress={() => handleShare()}>
                  <View style={[styles.shareIcon, { backgroundColor: colors.primary }]}><Share2 size={16} color="#fff" strokeWidth={2.2} /></View>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  webContainer: {
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#f1f1f1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 24) + 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  headerActions: { flexDirection: 'row', gap: 10 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  heroContainer: {
    width: '100%',
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
  },
  heroBlurBg: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.45,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 15,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: colors.primary, width: 20 },
  promotedContentBadge: {
    backgroundColor: '#1F2937',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  promotedContentText: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  proTopBorderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 30,
    zIndex: 10,
  },
  proTopBorderLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#F59E0B',
  },
  proShineLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 250,
  },
  proShineGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  proShineDustContainer: {
    position: 'absolute',
    top: 3,
    left: 0,
    right: 0,
    height: 20,
    zIndex: 11,
  },
  fairyDust: {
    position: 'absolute',
    fontWeight: '400',
    textShadowColor: 'rgba(251, 191, 36, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 2,
  },
  content: { padding: 25, paddingTop: 45, marginTop: -25, backgroundColor: colors.white, borderTopLeftRadius: 35, borderTopRightRadius: 35 },
  badgesRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  category: { color: colors.primary, fontWeight: '800', fontSize: 12, letterSpacing: 2, marginBottom: 8 },
  availableBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 8,
  },
  availableText: { color: colors.primary, fontSize: 10, fontWeight: '900' },
  title: { color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.5, lineHeight: 34, marginBottom: 10 },
  price: { color: colors.text, fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  locationText: { color: colors.textLight, fontSize: 14, fontWeight: '700', marginLeft: 6, textDecorationLine: 'underline' },
  actionsBox: { marginTop: 25, gap: 12 },
  btnMsg: { backgroundColor: colors.primary, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8 },
  btnMsgText: { color: colors.white, fontWeight: '900', fontSize: 16 },
  btnOffer: { height: 56, borderRadius: 16, borderWidth: 2, borderColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  btnOfferText: { color: colors.primary, fontWeight: '900', fontSize: 16 },
  btnWhatsapp: {
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(37, 211, 102, 0.06)',
  },
  btnWhatsappText: { color: '#25D366', fontWeight: '900', fontSize: 14 },
  divider: { height: 1.5, backgroundColor: '#f1f1f1', marginVertical: 25 },
  sellerRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center' },
  avatarPro: { backgroundColor: '#FFFBEB', borderWidth: 2, borderColor: '#F59E0B', shadowColor: '#1F2937', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.25, shadowRadius: 3, elevation: 4 },
  avatarText: { color: colors.primary, fontWeight: '900', fontSize: 18 },
  avatarTextPro: { color: '#F59E0B' },
  sellerName: { color: colors.text, fontWeight: '800', fontSize: 16 },
  sellerStars: { color: colors.accent, fontSize: 12, marginTop: 2 },
  viewProfile: { color: colors.primary, fontWeight: '700' },
  sectionTitle: { color: colors.textLight, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  description: { color: colors.text, fontSize: 16, lineHeight: 26, fontWeight: '400' },
  similarScroll: { paddingVertical: 5, gap: spacing.md },
  ownerActions: { flexDirection: 'row', gap: 12, marginTop: 30 },
  editBtn: { flex: 1, height: 50, borderRadius: 15, borderWidth: 2, borderColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  editBtnText: { color: colors.primary, fontWeight: '900', fontSize: 14 },
  deleteBtn: { flex: 1, height: 50, borderRadius: 15, borderWidth: 2, borderColor: colors.error, justifyContent: 'center', alignItems: 'center' },
  deleteBtnText: { color: colors.error, fontWeight: '900', fontSize: 14 },
  reportBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', marginTop: 40, opacity: 0.6 },
  reportText: { color: colors.textLight, fontSize: 13, marginLeft: 6, textDecorationLine: 'underline' },
  modalMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBody: { backgroundColor: colors.white, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },
  input: { backgroundColor: '#F9FAFB', borderRadius: 15, padding: 15, color: colors.text, fontSize: 16, marginBottom: 15, borderWidth: 1, borderColor: '#F3F4F6' },
  offerContainer: { marginTop: 5 },
  offerAmountWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 24,
    paddingHorizontal: 25,
    height: 85,
    borderWidth: 2,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    marginBottom: 8,
  },
  offerCurrencySign: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.primary,
    marginRight: 10,
    marginTop: 2,
  },
  offerAmountInput: {
    flex: 1,
    fontSize: 40,
    fontWeight: '900',
    color: colors.primary,
    height: '100%',
  },
  offerHelperText: {
    fontSize: 13,
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '700',
  },
  offerMessageWrapper: {
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 25,
  },
  offerMessageInput: {
    fontSize: 15,
    color: colors.text,
    height: 90,
    textAlignVertical: 'top',
    fontWeight: '500',
    lineHeight: 22,
  },
  confirmBtn: { height: 56, backgroundColor: colors.primary, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  confirmBtnText: { color: colors.white, fontWeight: '900', fontSize: 16 },
  reasonsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  reasonItem: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#f1f1f1' },
  reasonActive: { borderColor: colors.primary, backgroundColor: '#f0fdf4' },
  reasonText: { color: colors.textLight, fontWeight: '700' },
  reasonTextActive: { color: colors.primary },
  shareRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f1f1' },
  shareIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  shareIconPro: { borderWidth: 2, borderColor: '#F59E0B', shadowColor: '#1F2937', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 3 },
  shareLabel: { color: colors.text, fontWeight: '800', fontSize: 15 },
  shareLabelPro: { color: '#B45309' },
  shareHint: { marginTop: 18, padding: 14, borderRadius: 12, backgroundColor: '#F0FDF4' },
  shareHintPro: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' },
  shareHintProHighlight: { borderWidth: 2, borderColor: '#000000' },
  shareHintText: { color: '#047857', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  shareHintTextPro: { color: '#B45309' },
  celebrationOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  celebrationCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#161b22',
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  mascotContainer: {
    marginTop: -100,
    marginBottom: 20,
    width: 170,
    height: 170,
    zIndex: 10,
    alignSelf: 'center',
  },
  mascotImg: {
    width: '100%',
    height: '100%',
  },
  celebrationTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.primary,
    marginBottom: 10,
    textAlign: 'center',
  },
  celebrationSubtitle: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  celebrationListingName: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
    marginBottom: 30,
    textAlign: 'center',
  },
  celebrationButtons: {
    width: '100%',
    gap: 12,
    marginBottom: 30,
  },
  btnCelebrationPrimary: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnCelebrationPrimaryText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  btnCelebrationSecondary: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnCelebrationSecondaryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  celebrationShareSection: {
    width: '100%',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 20,
  },
  shareTitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
    marginBottom: 15,
    textAlign: 'center',
  },
  shareIconsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 15,
  },
  celebrationShareIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  viewerCloseBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 24) + 12,
    right: 20,
    zIndex: 100,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});