import React, { useEffect, useState } from 'react';
import { 
  ActivityIndicator,
  Alert,
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  Platform,
  StatusBar,
  KeyboardAvoidingView
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme/colors';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { createListing, getCategories, type Category } from '../services/api';
import { useAuth } from '../services/auth';

export const PublishScreen = () => {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  // Form State
  const [images, setImages] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [location, setLocation] = useState('Managua');
  const [paymentMethods, setPaymentMethods] = useState<string[]>(['Efectivo']);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
    });

    if (!result.canceled) {
      const newImages = result.assets.map(asset => asset.uri);
      setImages([...images, ...newImages]);
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages);
  };

  const togglePaymentMethod = (method: string) => {
    if (paymentMethods.includes(method)) {
      setPaymentMethods(paymentMethods.filter(m => m !== method));
    } else {
      setPaymentMethods([...paymentMethods, method]);
    }
  };

  const imageToUpload = (uri: string, index: number) => ({
    uri,
    name: `listing-${Date.now()}-${index}.jpg`,
    type: 'image/jpeg',
  });

  const handlePublish = async () => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }
    if (!title.trim() || !price.trim() || !category || !location.trim() || !description.trim()) {
      Alert.alert('Faltan datos', 'Completa título, precio, categoría, ubicación y descripción.');
      return;
    }
    setIsSubmitting(true);
    try {
      const listing = await createListing({
        title: title.trim(),
        price: price.trim(),
        category: category.id,
        location: location.trim(),
        description: description.trim(),
        payment_methods: paymentMethods.join(', '),
        main_image: images[0] ? imageToUpload(images[0], 0) : null,
        images: images.slice(1).map(imageToUpload),
      });
      router.replace(`/listing/${listing.id}`);
    } catch {
      Alert.alert('No se pudo publicar', 'Revisa los datos e inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthLoading && !isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.authRequired}>
          <Ionicons name="lock-closed-outline" size={64} color="#E5E7EB" />
          <Text style={styles.authTitle}>Inicia sesión para publicar</Text>
          <Text style={styles.authText}>Necesitas una cuenta para crear anuncios reales en Igualo.</Text>
          <TouchableOpacity style={styles.authBtn} onPress={() => router.push('/auth/login')}>
            <Text style={styles.authBtnText}>Iniciar sesión</Text>
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
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Igualo Studio</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* LIVE PREVIEW SECTION (The Simulation) */}
          <View style={styles.previewContainer}>
            <Text style={styles.sectionHeader}>VISTA PREVIA EN TIEMPO REAL</Text>
            <View style={styles.previewCard}>
              <View style={styles.previewImageWrapper}>
                <Image 
                  source={{ uri: images.length > 0 ? images[0] : 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800' }} 
                  style={styles.previewImg}
                  contentFit="cover"
                />
                <View style={styles.previewOverlay}>
                  <View style={styles.previewBadge}>
                    <Text style={styles.previewBadgeText}>{category?.name || 'Categoría'}</Text>
                  </View>
                  <Text style={styles.previewTitle} numberOfLines={1}>{title || 'Título del anuncio'}</Text>
                  <View style={styles.previewFooter}>
                    <Text style={styles.previewPrice}>C$ {price || '0.00'}</Text>
                    <Text style={styles.previewLocation}>📍 {location || 'Ubicación'}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Step 01: Multimedia */}
          <View style={styles.section}>
            <Text style={styles.stepTitle}>01. GALERÍA MULTIMEDIA</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
              <TouchableOpacity style={styles.addImageBtn} onPress={pickImage}>
                <Ionicons name="add" size={32} color={colors.textLight} />
                <Text style={styles.addImageText}>Añadir</Text>
              </TouchableOpacity>
              
              {images.map((img, index) => (
                <View key={index} style={styles.imageWrapper}>
                  <Image source={{ uri: img }} style={styles.previewImage} />
                  <TouchableOpacity style={styles.removePhotoBtn} onPress={() => removeImage(index)}>
                    <Ionicons name="close-circle" size={20} color={colors.error} />
                  </TouchableOpacity>
                  {index === 0 && (
                    <View style={styles.mainPhotoLabel}>
                      <Text style={styles.mainPhotoText}>PRINCIPAL</Text>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Step 02: Technical Details */}
          <View style={styles.section}>
            <Text style={styles.stepTitle}>02. FICHA TÉCNICA</Text>
            
            <View style={styles.inputBlock}>
              <Text style={styles.label}>Título</Text>
              <TextInput 
                style={styles.titleInput}
                placeholder="¿Qué vendes?"
                placeholderTextColor="#9CA3AF"
                value={title}
                onChangeText={setTitle}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputBlock, { flex: 1 }]}>
                <Text style={styles.label}>Precio (C$)</Text>
                <TextInput 
                  style={styles.priceInput}
                  placeholder="0.00"
                  placeholderTextColor={colors.primary}
                  keyboardType="decimal-pad"
                  value={price}
                  onChangeText={setPrice}
                />
              </View>
              <View style={[styles.inputBlock, { flex: 1.2, marginLeft: 15 }]}>
                <Text style={styles.label}>Clasificación</Text>
                <TouchableOpacity style={styles.selector}>
                  <Text style={styles.selectorText}>{category?.name || 'Elegir...'}</Text>
                  <Ionicons name="chevron-down" size={16} color={colors.textLight} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {categories.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.categoryChip, category?.id === item.id && styles.categoryChipActive]}
                  onPress={() => setCategory(item)}
                >
                  <Text style={[styles.categoryChipText, category?.id === item.id && styles.categoryChipTextActive]}>{item.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.inputBlock}>
              <Text style={styles.label}>Ubicación</Text>
              <View style={styles.inputWithIcon}>
                <Ionicons name="location-outline" size={18} color={colors.textLight} />
                <TextInput 
                  style={styles.input}
                  placeholder="Ciudad/Barrio"
                  value={location}
                  onChangeText={setLocation}
                />
              </View>
            </View>
          </View>

          {/* Step 03: Payments */}
          <View style={styles.section}>
            <Text style={styles.stepTitle}>03. PAGOS</Text>
            <View style={styles.paymentGrid}>
              {[
                { id: 'Efectivo', icon: 'cash-outline', label: 'Cash' },
                { id: 'Transferencia', icon: 'business-outline', label: 'Banco' },
                { id: 'Apps de Pago', icon: 'phone-portrait-outline', label: 'Apps' }
              ].map((method) => (
                <TouchableOpacity 
                  key={method.id} 
                  style={[
                    styles.paymentCard, 
                    paymentMethods.includes(method.id) && styles.paymentCardActive
                  ]}
                  onPress={() => togglePaymentMethod(method.id)}
                >
                  <Ionicons 
                    name={method.icon as any} 
                    size={24} 
                    color={paymentMethods.includes(method.id) ? colors.primary : colors.textLight} 
                  />
                  <Text style={[
                    styles.paymentLabel, 
                    paymentMethods.includes(method.id) && styles.paymentLabelActive
                  ]}>{method.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Step 04: Description */}
          <View style={styles.section}>
            <Text style={styles.stepTitle}>04. DESCRIPCIÓN</Text>
            <TextInput 
              style={styles.descriptionInput}
              placeholder="Detalles del producto..."
              multiline
              numberOfLines={4}
              value={description}
              onChangeText={setDescription}
            />
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={[styles.publishBtn, isSubmitting && styles.publishBtnDisabled]} onPress={handlePublish} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.publishBtnText}>Publicar</Text>}
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  authRequired: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  authTitle: {
    marginTop: spacing.md,
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
  },
  authText: {
    marginTop: spacing.sm,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 22,
  },
  authBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  authBtnText: {
    color: colors.white,
    fontWeight: '900',
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
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  previewContainer: {
    marginBottom: 30,
    alignItems: 'center',
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textLight,
    letterSpacing: 2,
    marginBottom: 15,
    alignSelf: 'flex-start',
  },
  previewCard: {
    width: '100%',
    aspectRatio: 3/3.8,
    borderRadius: 25,
    backgroundColor: '#000',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  previewImageWrapper: {
    flex: 1,
    position: 'relative',
  },
  previewImg: {
    width: '100%',
    height: '100%',
    opacity: 0.7,
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
    padding: 20,
  },
  previewBadge: {
    position: 'absolute',
    top: 15,
    left: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  previewBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
  },
  previewTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.white,
    marginBottom: 5,
  },
  previewFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewPrice: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.primary,
  },
  previewLocation: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 10,
    marginBottom: 30,
  },
  section: {
    marginBottom: 35,
  },
  stepTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 1.5,
    marginBottom: 20,
  },
  imageScroll: {
    flexDirection: 'row',
  },
  addImageBtn: {
    width: 100,
    height: 100,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#F3F4F6',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    marginRight: 12,
  },
  addImageText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textLight,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  imageWrapper: {
    width: 100,
    height: 100,
    borderRadius: 20,
    marginRight: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: colors.white,
    borderRadius: 10,
  },
  mainPhotoLabel: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mainPhotoText: {
    color: colors.white,
    fontSize: 8,
    fontWeight: '900',
  },
  inputBlock: {
    marginBottom: 25,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textLight,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  titleInput: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
    borderBottomWidth: 2,
    borderBottomColor: '#F3F4F6',
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  priceInput: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.primary,
    borderBottomWidth: 2,
    borderBottomColor: '#F3F4F6',
    paddingVertical: 8,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: '#F3F4F6',
    paddingVertical: 10,
  },
  selectorText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    flex: 1,
  },
  categoryScroll: {
    marginTop: -10,
    marginBottom: 20,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    marginRight: 8,
  },
  categoryChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  categoryChipText: {
    color: colors.textLight,
    fontWeight: '800',
    fontSize: 12,
  },
  categoryChipTextActive: {
    color: colors.primary,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#F3F4F6',
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  paymentGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  paymentCard: {
    flex: 1,
    height: 80,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentCardActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    borderColor: colors.primary,
  },
  paymentLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textLight,
    marginTop: 8,
  },
  paymentLabelActive: {
    color: colors.primary,
  },
  descriptionInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 18,
    fontSize: 16,
    color: colors.text,
    height: 140,
    textAlignVertical: 'top',
  },
  footer: {
    marginTop: 20,
  },
  publishBtn: {
    width: '100%',
    backgroundColor: colors.primary,
    height: 56,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  publishBtnDisabled: {
    opacity: 0.7,
  },
  publishBtnText: {
    color: colors.white,
    fontWeight: '900',
    fontSize: 18,
  }
});
