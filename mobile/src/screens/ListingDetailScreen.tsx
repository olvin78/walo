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
} from 'react-native';
import { Image } from 'expo-image';
import { ChevronLeft, Heart, Flag, X, Share2, MapPin, BadgeCheck, MessageCircle, Send, Check } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { colors, spacing } from '../theme/colors';
import { 
  createConversation, 
  getListingDetail, 
  setListingFavorite, 
  makeOffer, 
  reportListing,
  deleteListing,
  type ListingDetail, 
  type ReportReason 
} from '../services/api';
import { useAuth } from '../services/auth';
import { ProductCard } from '../components/ProductCard';
import { getListings } from '../services/api';

interface ListingDetailScreenProps {
  listingId: string;
}

export const ListingDetailScreen: React.FC<ListingDetailScreenProps> = ({ listingId }) => {
  const router = useRouter();
  const { isAuthenticated, user: currentUser } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [similar, setSimilar] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);

  // States
  const [showModal, setShowModal] = useState<'none' | 'offer' | 'report' | 'share'>('none');
  const [formData, setFormData] = useState({ amount: '', message: '', description: '' });
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
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
      setIsLoading(false);
    }
  }, [listingId]);

  useEffect(() => { load(); }, [load]);

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
    const url = `https://igualo.com/anuncio/${listingId}-${listing?.slug || ''}/`;
    return url;
  };

  const handleShare = async (channel?: string) => {
    const url = shareLink();
    const text = `${listing?.title} en Igualo - ${listing?.currency === 'USD' ? '$' : 'C$'} ${listing?.price}`;
    if (channel === 'whatsapp') {
      Linking.openURL(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`);
    } else if (channel === 'copy') {
      await RNShare.share({ message: `${text}\n${url}` });
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
              <View key={i} style={{ width: Platform.OS === 'web' ? 800 : windowWidth, height: '100%' }}>
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
              </View>
            ))}
          </ScrollView>
          {allImages.length > 1 ? (
            <View style={styles.dotsRow}>
              {allImages.map((_, i) => (
                <View key={i} style={[styles.dot, i === activeImage && styles.dotActive]} />
              ))}
            </View>
          ) : null}
          {listing.is_promoted ? (
            <View style={styles.promotedBadge}><Text style={styles.promotedText}>★ ANUNCIO PRIORIZADO</Text></View>
          ) : null}
        </View>
        
        <View style={styles.content}>
          <View style={styles.badgesRow}>
            <Text style={styles.category}>{listing.category?.name.toUpperCase()}</Text>
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
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{listing.seller?.username?.slice(0,1).toUpperCase() || '?'}</Text>
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
              <View>
                <TextInput 
                  style={styles.input} 
                  value={formData.amount} 
                  onChangeText={t => setFormData({...formData, amount:t})} 
                  keyboardType="numeric" 
                  placeholder="Monto" 
                  placeholderTextColor={colors.textLight}
                />
                <TextInput 
                  style={[styles.input, {height:100, textAlignVertical:'top'}]} 
                  value={formData.message} 
                  onChangeText={t => setFormData({...formData, message:t})} 
                  multiline 
                  placeholder="Escribe un mensaje opcional..." 
                  placeholderTextColor={colors.textLight}
                />
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
                  <View style={[styles.shareIcon, { backgroundColor: '#25D366' }]}><Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>W</Text></View>
                  <Text style={styles.shareLabel}>WhatsApp</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shareRow} onPress={() => handleShare('copy')}>
                  <View style={[styles.shareIcon, { backgroundColor: colors.primary }]}><Share2 size={18} color="#fff" strokeWidth={2.2} /></View>
                  <Text style={styles.shareLabel}>Copiar enlace / Compartir</Text>
                </TouchableOpacity>
                <View style={styles.shareHint}>
                  <Text style={styles.shareHintText}>Los anuncios compartidos se venden hasta 3 veces más rápido.</Text>
                </View>
              </View>
            )}
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
    top: Platform.OS === 'ios' ? 50 : 20,
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
  promotedBadge: {
    position: 'absolute',
    top: 15,
    left: 15,
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  promotedText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  content: { padding: 25, marginTop: -30, backgroundColor: colors.white, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
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
  avatarText: { color: colors.primary, fontWeight: '900', fontSize: 18 },
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
  confirmBtn: { height: 56, backgroundColor: colors.primary, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  confirmBtnText: { color: colors.white, fontWeight: '900', fontSize: 16 },
  reasonsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  reasonItem: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#f1f1f1' },
  reasonActive: { borderColor: colors.primary, backgroundColor: '#f0fdf4' },
  reasonText: { color: colors.textLight, fontWeight: '700' },
  reasonTextActive: { color: colors.primary },
  shareRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f1f1' },
  shareIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  shareLabel: { color: colors.text, fontWeight: '800', fontSize: 15 },
  shareHint: { marginTop: 18, padding: 14, borderRadius: 12, backgroundColor: '#F0FDF4' },
  shareHintText: { color: '#047857', fontSize: 13, fontWeight: '700', textAlign: 'center' },
});