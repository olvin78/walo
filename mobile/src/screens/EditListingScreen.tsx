import React, { useEffect, useState, useCallback } from 'react';
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
import { X, Plus, XCircle, ChevronDown, MapPin, Eye, EyeOff } from 'lucide-react-native';
import { colors, spacing } from '../theme/colors';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { 
  getListingDetail, 
  updateListing, 
  getCategories, 
  type Category, 
  type Subcategory,
  type ListingDetail 
} from '../services/api';
import { useAuth } from '../services/auth';

interface EditListingScreenProps {
  listingId: string;
}

export const EditListingScreen: React.FC<EditListingScreenProps> = ({ listingId }) => {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  // Form State
  const [existingImages, setExistingImages] = useState<{id: number, url: string}[]>([]);
  const [newImages, setNewImages] = useState<string[]>([]);
  const [deletedImageIds, setDeletedImageIds] = useState<number[]>([]);
  
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [isNegotiable, setIsNegotiable] = useState(false);
  const [category, setCategory] = useState<Category | null>(null);
  const [subcategory, setSubcategory] = useState<Subcategory | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [location, setLocation] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [listingData, categoriesData] = await Promise.all([
        getListingDetail(listingId),
        getCategories()
      ]);
      
      setCategories(categoriesData);
      
      // Fill form
      setTitle(listingData.title);
      setPrice(String(listingData.price));
      setLocation(listingData.location || '');
      setDescription(listingData.description || '');
      setIsActive(listingData.is_active !== false);
      setIsNegotiable(listingData.is_negotiable === true);
      
      if (listingData.category) {
        setCategory(listingData.category);
      }

      if (listingData.subcategory) {
        setSubcategory(listingData.subcategory);
      }
      
      if (listingData.payment_methods) {
        setPaymentMethods(listingData.payment_methods.split(',').map(m => m.trim()));
      }

      // Handle images: Include main_image if not already in images list
      const imgs = listingData.images || [];
      const mainUrl = listingData.main_image;
      
      const allExisting = imgs.map(img => ({ id: img.id, url: img.url || '' }));
      
      // If main image is not in the related images list, add it at the beginning with id 0 (reserved for main)
      if (mainUrl && !allExisting.some(img => img.url === mainUrl)) {
        setExistingImages([{ id: 0, url: mainUrl }, ...allExisting]);
      } else {
        setExistingImages(allExisting);
      }
      
    } catch (error) {
      Alert.alert('Error', 'No se pudo cargar la información del anuncio');
      router.back();
    } finally {
      setIsLoading(false);
    }
  }, [listingId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const uris = result.assets.map(asset => asset.uri);
      setNewImages([...newImages, ...uris]);
    }
  };

  const removeExistingImage = (id: number) => {
    setExistingImages(existingImages.filter(img => img.id !== id));
    if (id !== 0) {
      setDeletedImageIds([...deletedImageIds, id]);
    } else {
      // If id is 0, we are "deleting" the main image field from the database
      // The backend logic I added will pick a new main if this is null
    }
  };

  const removeNewImage = (uri: string) => {
    setNewImages(newImages.filter(img => img !== uri));
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
    name: `listing-edit-${Date.now()}-${index}.jpg`,
    type: 'image/jpeg',
  });

  const allImages = [...existingImages.map(img => img.url), ...newImages];

  const handleUpdate = async () => {
    if (!title.trim() || !price.trim() || !category || !location.trim() || !description.trim()) {
      Alert.alert('Faltan datos', 'Completa los campos obligatorios.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const payload: any = {
        title: title.trim(),
        price: price.trim(),
        category: category.id,
        subcategory: subcategory?.id ?? null,
        is_negotiable: isNegotiable,
        location: location.trim(),
        description: description.trim(),
        payment_methods: paymentMethods.join(', '),
        is_active: isActive,
        deleted_images: deletedImageIds,
      };

      // Si no quedan fotos existentes y no hay nuevas, avisar
      if (existingImages.length === 0 && newImages.length === 0) {
        Alert.alert('Faltan fotos', 'Tu anuncio debe tener al menos una foto.');
        setIsSubmitting(false);
        return;
      }

      // Si la foto principal (la primera) es nueva, enviarla como main_image
      if (allImages[0] && newImages.includes(allImages[0])) {
         payload.main_image = imageToUpload(allImages[0], 0);
         // Quitarla de la lista de 'images' adicionales para no duplicarla
         payload.images = newImages.filter(uri => uri !== allImages[0]).map((uri, i) => imageToUpload(uri, i + 1));
      } else {
         payload.images = newImages.map((uri, index) => imageToUpload(uri, index));
      }

      // Si borramos la principal y no pusimos una nueva primera, el backend pondrá la siguiente disponible
      if (!existingImages.some(img => img.id === 0) && !payload.main_image) {
        // Marcamos main_image como null para que el backend busque la siguiente
        payload.main_image = null;
      }

      await updateListing(listingId, payload);
      
      Alert.alert('Éxito', 'Anuncio actualizado correctamente');
      router.push(`/listing/${listingId}`);
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el anuncio');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || isAuthLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <X size={28} color={colors.text} strokeWidth={2.2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Editar Anuncio</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* SIMULATION PREVIEW */}
          <View style={styles.previewContainer}>
            <Text style={styles.sectionHeader}>VISTA PREVIA</Text>
            <View style={styles.previewCard}>
              <View style={styles.previewImageWrapper}>
                <Image 
                  source={{ uri: allImages.length > 0 ? allImages[0] : 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800' }} 
                  style={styles.previewImg}
                  contentFit="cover"
                />
                <View style={styles.previewOverlay}>
                  <View style={styles.previewBadge}>
                    <Text style={styles.previewBadgeText}>{category?.name || 'Categoría'}</Text>
                  </View>
                  <Text style={styles.previewTitle} numberOfLines={1}>{title || 'Título'}</Text>
                  <View style={styles.previewFooter}>
                    <Text style={styles.previewPrice}>C$ {price || '0.00'}</Text>
                    <Text style={styles.previewLocation}>📍 {location || 'Ubicación'}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Multimedia */}
          <View style={styles.section}>
            <Text style={styles.stepTitle}>01. GALERÍA MULTIMEDIA</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
              <TouchableOpacity style={styles.addImageBtn} onPress={pickImage}>
                <Plus size={32} color={colors.textLight} strokeWidth={2.4} />
                <Text style={styles.addImageText}>Añadir</Text>
              </TouchableOpacity>
              
              {existingImages.map((img) => (
                <View key={`existing-${img.id}`} style={styles.imageWrapper}>
                  <Image source={{ uri: img.url }} style={styles.previewImage} />
                  <TouchableOpacity style={styles.removePhotoBtn} onPress={() => removeExistingImage(img.id)}>
                    <XCircle size={20} color={colors.error} strokeWidth={2.2} />
                  </TouchableOpacity>
                </View>
              ))}

              {newImages.map((uri, index) => (
                <View key={`new-${index}`} style={styles.imageWrapper}>
                  <Image source={{ uri }} style={styles.previewImage} />
                  <TouchableOpacity style={styles.removePhotoBtn} onPress={() => removeNewImage(uri)}>
                    <XCircle size={20} color={colors.error} strokeWidth={2.2} />
                  </TouchableOpacity>
                  <View style={styles.newImageBadge}>
                    <Text style={styles.newImageText}>NUEVA</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Technical Details */}
          <View style={styles.section}>
            <Text style={styles.stepTitle}>02. FICHA TÉCNICA</Text>
            
            <View style={styles.inputBlock}>
              <Text style={styles.label}>Título</Text>
              <TextInput 
                style={styles.titleInput}
                placeholder="¿Qué vendes?"
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
                  keyboardType="decimal-pad"
                  value={price}
                  onChangeText={setPrice}
                />
              </View>
              <View style={[styles.inputBlock, { flex: 1.2, marginLeft: 15 }]}>
                <Text style={styles.label}>Clasificación</Text>
                <TouchableOpacity style={styles.selector}>
                  <Text style={styles.selectorText}>{category?.name || 'Elegir...'}</Text>
                  <ChevronDown size={16} color={colors.textLight} strokeWidth={2.4} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.negotiableToggle}
              onPress={() => setIsNegotiable(!isNegotiable)}
              activeOpacity={0.7}
            >
              <View style={[styles.negotiableCheck, isNegotiable && styles.negotiableCheckActive]}>
                {isNegotiable ? <Text style={styles.negotiableCheckMark}>✓</Text> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.negotiableTitle}>Precio Negociable</Text>
                <Text style={styles.negotiableDesc}>Muestra "🤝 Precio Negociable" en vez de un precio fijo</Text>
              </View>
            </TouchableOpacity>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {categories.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.categoryChip, category?.id === item.id && styles.categoryChipActive]}
                  onPress={() => {
                    setCategory(item);
                    setSubcategory(null);
                  }}
                >
                  <Text style={[styles.categoryChipText, category?.id === item.id && styles.categoryChipTextActive]}>{item.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {category?.subcategories && category.subcategories.length > 0 ? (
              <View style={styles.subcategoryBlock}>
                <Text style={styles.label}>Subcategoría</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subcategoryScrollContent}>
                  {category.subcategories.map((sub) => (
                    <TouchableOpacity
                      key={sub.id}
                      style={[styles.subcategoryChip, subcategory?.id === sub.id && styles.subcategoryChipActive]}
                      onPress={() => setSubcategory(subcategory?.id === sub.id ? null : sub)}
                    >
                      {sub.icon ? <Text style={styles.subcategoryChipEmoji}>{sub.icon}</Text> : null}
                      <Text style={[styles.subcategoryChipText, subcategory?.id === sub.id && styles.subcategoryChipTextActive]}>{sub.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <View style={styles.inputBlock}>
              <Text style={styles.label}>Ubicación</Text>
              <View style={styles.inputWithIcon}>
                <MapPin size={18} color={colors.textLight} strokeWidth={2} />
                <TextInput 
                  style={styles.input}
                  placeholder="Ciudad/Barrio"
                  value={location}
                  onChangeText={setLocation}
                />
              </View>
            </View>
          </View>

          {/* Availability */}
          <View style={styles.section}>
            <Text style={styles.stepTitle}>03. DISPONIBILIDAD</Text>
            <TouchableOpacity 
              style={[styles.statusToggle, !isActive && styles.statusToggleInactive]} 
              onPress={() => setIsActive(!isActive)}
            >
              <View>
                <Text style={styles.statusTitle}>{isActive ? 'Anuncio Activo' : 'Anuncio Pausado'}</Text>
                <Text style={styles.statusDesc}>{isActive ? 'Todos pueden ver tu publicación' : 'Nadie podrá ver este anuncio'}</Text>
              </View>
              {isActive ? <Eye size={24} color={colors.primary} strokeWidth={2.2} /> : <EyeOff size={24} color={colors.textLight} strokeWidth={2.2} />}
            </TouchableOpacity>
          </View>

          {/* Description */}
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
            <TouchableOpacity style={[styles.publishBtn, isSubmitting && styles.publishBtnDisabled]} onPress={handleUpdate} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.publishBtnText}>Guardar Cambios ✨</Text>}
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: colors.text },
  scrollContent: { padding: spacing.lg },
  previewContainer: { marginBottom: 30, alignItems: 'center' },
  sectionHeader: { fontSize: 10, fontWeight: '800', color: colors.textLight, letterSpacing: 2, marginBottom: 15, alignSelf: 'flex-start' },
  previewCard: { width: '100%', aspectRatio: 3/3, borderRadius: 25, backgroundColor: '#000', overflow: 'hidden', elevation: 5 },
  previewImageWrapper: { flex: 1, position: 'relative' },
  previewImg: { width: '100%', height: '100%', opacity: 0.7 },
  previewOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'flex-end', padding: 20 },
  previewBadge: { position: 'absolute', top: 15, left: 15, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  previewBadgeText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  previewTitle: { fontSize: 22, fontWeight: '900', color: colors.white, marginBottom: 5 },
  previewFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewPrice: { fontSize: 18, fontWeight: '900', color: colors.primary },
  previewLocation: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 30 },
  section: { marginBottom: 35 },
  stepTitle: { fontSize: 11, fontWeight: '900', color: colors.primary, letterSpacing: 1.5, marginBottom: 20 },
  imageScroll: { flexDirection: 'row' },
  addImageBtn: { width: 90, height: 90, borderRadius: 15, borderWidth: 2, borderColor: '#F3F4F6', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB', marginRight: 12 },
  addImageText: { fontSize: 10, fontWeight: '800', color: colors.textLight, marginTop: 4 },
  imageWrapper: { width: 90, height: 90, borderRadius: 15, marginRight: 12, position: 'relative', overflow: 'hidden' },
  previewImage: { width: '100%', height: '100%' },
  removePhotoBtn: { position: 'absolute', top: 5, right: 5, backgroundColor: colors.white, borderRadius: 10 },
  newImageBadge: { position: 'absolute', bottom: 5, right: 5, backgroundColor: colors.accent, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
  newImageText: { color: colors.white, fontSize: 7, fontWeight: '900' },
  inputBlock: { marginBottom: 25 },
  label: { fontSize: 12, fontWeight: '800', color: colors.textLight, textTransform: 'uppercase', marginBottom: 8 },
  titleInput: { fontSize: 20, fontWeight: '900', color: colors.text, borderBottomWidth: 2, borderBottomColor: '#F3F4F6', paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  priceInput: { fontSize: 18, fontWeight: '900', color: colors.primary, borderBottomWidth: 2, borderBottomColor: '#F3F4F6', paddingVertical: 8 },
  selector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 2, borderBottomColor: '#F3F4F6', paddingVertical: 10 },
  selectorText: { fontSize: 15, fontWeight: '800', color: colors.text, flex: 1 },
  categoryScroll: { marginTop: -5, marginBottom: 20 },
  categoryChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', marginRight: 8 },
  categoryChipActive: { borderColor: colors.primary, backgroundColor: 'rgba(16, 185, 129, 0.08)' },
  categoryChipText: { color: colors.textLight, fontWeight: '800', fontSize: 11 },
  categoryChipTextActive: { color: colors.primary },
  subcategoryBlock: { marginBottom: 25 },
  subcategoryScrollContent: { paddingVertical: 4 },
  subcategoryChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', marginRight: 8 },
  subcategoryChipActive: { borderColor: colors.primary, backgroundColor: 'rgba(16, 185, 129, 0.08)' },
  subcategoryChipText: { color: colors.textLight, fontWeight: '800', fontSize: 11 },
  subcategoryChipTextActive: { color: colors.primary },
  subcategoryChipEmoji: { marginRight: 6, fontSize: 14 },
  negotiableToggle: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 25 },
  negotiableCheck: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#D1D5DB', marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  negotiableCheckActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  negotiableCheckMark: { color: colors.white, fontWeight: '900', fontSize: 14 },
  negotiableTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  negotiableDesc: { color: colors.textLight, fontSize: 12, marginTop: 2 },
  inputWithIcon: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#F3F4F6', paddingVertical: 8 },
  input: { flex: 1, marginLeft: 10, fontSize: 16, fontWeight: '700', color: colors.text },
  statusToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderRadius: 15, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#D1FAE5' },
  statusToggleInactive: { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' },
  statusTitle: { fontSize: 15, fontWeight: '900', color: colors.text },
  statusDesc: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  descriptionInput: { backgroundColor: '#F9FAFB', borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', padding: 18, fontSize: 16, color: colors.text, height: 120, textAlignVertical: 'top' },
  footer: { marginTop: 10 },
  publishBtn: { width: '100%', backgroundColor: colors.primary, height: 56, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  publishBtnDisabled: { opacity: 0.7 },
  publishBtnText: { color: colors.white, fontWeight: '900', fontSize: 17 },
});
