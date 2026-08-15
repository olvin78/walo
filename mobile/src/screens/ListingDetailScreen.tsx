import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
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

const { width } = Dimensions.get('window');

interface ListingDetailScreenProps {
  listingId: string;
}

export const ListingDetailScreen: React.FC<ListingDetailScreenProps> = ({ listingId }) => {
  const router = useRouter();
  const { isAuthenticated, user: currentUser } = useAuth();
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);

  // States
  const [showModal, setShowModal] = useState<'none' | 'offer' | 'report'>('none');
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

  if (isLoading) return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  if (!listing) return <View style={[styles.container, styles.center]}><Text style={{color: colors.text}}>No disponible</Text></View>;

  return (
    <View style={[styles.container, Platform.OS === 'web' && styles.webContainer]}>
      <StatusBar barStyle="dark-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={24} color={colors.text} />
            </TouchableOpacity>
            
            <TouchableOpacity onPress={toggleFav} style={styles.backBtn}>
                <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={24} color={isFavorite ? colors.error : colors.text} />
            </TouchableOpacity>
        </View>

        <View style={styles.heroContainer}>
          <Image 
            source={{ uri: listing.main_image || '' }} 
            style={styles.heroBlurBg} 
            contentFit="cover" 
            blurRadius={15}
          />
          <Image 
            source={{ uri: listing.main_image || '' }} 
            style={styles.heroImage} 
            contentFit="contain" 
          />
        </View>
        
        <View style={styles.content}>
          <Text style={styles.category}>{listing.category?.name.toUpperCase()}</Text>
          <Text style={styles.title}>{listing.title}</Text>
          <Text style={styles.price}>
            <Text style={styles.currency}>{listing.currency === 'USD' ? '$' : 'C$'}</Text> {listing.price}
          </Text>

          <View style={styles.actionsBox}>
            <TouchableOpacity style={styles.btnMsg} onPress={async () => {
                 if (!isAuthenticated) return router.push('/auth/login');
                 const c = await createConversation(listingId);
                 router.push(`/messages/${c.id}`);
            }}>
                <Text style={styles.btnMsgText}>ENVIAR MENSAJE</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnOffer} onPress={() => setShowModal('offer')}>
                <Text style={styles.btnOfferText}>HACER OFERTA</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Seller info */}
          <View style={styles.sellerRow}>
            <View style={styles.avatar}>
                <Text style={styles.avatarText}>{listing.seller?.username?.slice(0,1).toUpperCase() || '?'}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.sellerName}>{listing.seller?.username || 'Anónimo'}</Text>
                <Text style={styles.sellerStars}>★ ★ ★ ★ ★ <Text style={{color: colors.textLight}}>(12 ventas)</Text></Text>
            </View>
            <TouchableOpacity onPress={() => listing.seller?.username && router.push(`/profile/${listing.seller.username}`)}>
                <Text style={styles.viewProfile}>Ver Perfil</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />
          
          <Text style={styles.sectionTitle}>Descripción</Text>
          <Text style={styles.description}>{listing.description}</Text>

          <TouchableOpacity 
            activeOpacity={0.7}
            style={styles.reportBtn} 
            onPress={() => setShowModal('report')}
          >
            <Ionicons name="flag" size={14} color={colors.textLight} />
            <Text style={styles.reportText}>Reportar anuncio</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* MODAL */}
      <Modal visible={showModal !== 'none'} transparent animationType="slide">
        <View style={styles.modalMask}>
          <View style={styles.modalBody}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{showModal === 'offer' ? 'Hacer Oferta' : 'Reportar Anuncio'}</Text>
              <TouchableOpacity onPress={() => setShowModal('none')}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
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
            ) : (
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
    paddingHorizontal: 20,
    zIndex: 10,
  },
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
    height: Platform.OS === 'web' ? 450 : 350,
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
  content: { padding: 25, marginTop: -30, backgroundColor: colors.white, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  category: { color: colors.primary, fontWeight: '800', fontSize: 12, letterSpacing: 2, marginBottom: 8 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.5, lineHeight: 34, marginBottom: 10 },
  price: { color: colors.text, fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  currency: { color: colors.primary, fontWeight: '900' },
  actionsBox: { marginTop: 25, gap: 12 },
  btnMsg: { backgroundColor: colors.primary, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  btnMsgText: { color: colors.white, fontWeight: '900', fontSize: 16 },
  btnOffer: { height: 56, borderRadius: 16, borderWidth: 2, borderColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  btnOfferText: { color: colors.primary, fontWeight: '900', fontSize: 16 },
  divider: { height: 1.5, backgroundColor: '#f1f1f1', marginVertical: 25 },
  sellerRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: colors.primary, fontWeight: '900', fontSize: 18 },
  sellerName: { color: colors.text, fontWeight: '800', fontSize: 16 },
  sellerStars: { color: colors.accent, fontSize: 12, marginTop: 2 },
  viewProfile: { color: colors.primary, fontWeight: '700' },
  sectionTitle: { color: colors.textLight, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  description: { color: colors.text, fontSize: 16, lineHeight: 26, fontWeight: '400' },
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
});
