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
import { Lock, X, Plus, XCircle, ChevronDown, MapPin, Banknote, Landmark, Smartphone, HelpCircle } from 'lucide-react-native';
import { colors, spacing } from '../theme/colors';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { createListing, getCategories, ApiError, type Category, type Subcategory } from '../services/api';
import { processImageForUpload } from '../services/upload';
import { useAuth } from '../services/auth';

const LabelWithHelp = ({ title, helpTitle, helpText, style }: { title: string, helpTitle: string, helpText: string, style?: any }) => (
  <View style={[styles.labelRow, style]}>
    <Text style={styles.label}>{title}</Text>
    <TouchableOpacity onPress={() => Alert.alert(helpTitle, helpText)}>
      <HelpCircle size={16} color={colors.textLight} strokeWidth={2} />
    </TouchableOpacity>
  </View>
);

export const PublishScreen = () => {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading, user: currentUser } = useAuth();
  const isMePro = Boolean(currentUser?.profile?.is_pro);

  // Form State
  const [images, setImages] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [isNegotiable, setIsNegotiable] = useState(false);
  const [category, setCategory] = useState<Category | null>(null);
  const [subcategory, setSubcategory] = useState<Subcategory | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [location, setLocation] = useState('Managua');
  const [paymentMethods, setPaymentMethods] = useState<string[]>(['Efectivo']);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCategoryList, setShowCategoryList] = useState(false);
  const [showSubcategoryList, setShowSubcategoryList] = useState(false);

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
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

  const imageToUpload = async (uri: string, index: number) => ({
    ...(await processImageForUpload(uri, `listing-${Date.now()}-${index}.jpg`)),
  });

  const handlePublish = async () => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }
    if (!title.trim() || (!isNegotiable && !price.trim()) || !category || !location.trim() || !description.trim()) {
      Alert.alert('Faltan datos', 'Completa título, precio (o selecciona negociable), categoría, ubicación y descripción.');
      return;
    }
    setIsSubmitting(true);
    try {
      const mainImage = images[0] ? await imageToUpload(images[0], 0) : null;
      const extraImages = await Promise.all(images.slice(1).map((uri, i) => imageToUpload(uri, i + 1)));
      const listing = await createListing({
        title: title.trim(),
        price: isNegotiable ? '0' : price.trim(),
        is_negotiable: isNegotiable,
        is_active: true,
        category: category.id,
        subcategory: subcategory?.id ?? null,
        location: location.trim(),
        description: description.trim(),
        payment_methods: paymentMethods.join(', '),
        main_image: mainImage,
        images: extraImages,
      });
      router.replace(`/listing/${listing.id}?isNew=true`);
    } catch (error) {
      const detail = error instanceof ApiError ? error.data : null;
      const message = detail && typeof detail === 'object'
        ? Object.entries(detail as Record<string, unknown>).map(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(', ') : value}`).join('\n')
        : 'Revisa los datos e inténtalo de nuevo.';
      Alert.alert('No se pudo publicar', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthLoading && !isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.authRequired}>
          <Lock size={64} color="#E5E7EB" strokeWidth={1.6} />
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
          <X size={28} color={colors.text} strokeWidth={2.2} />
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
            <View style={[styles.previewCard, isMePro && styles.proBorderStrong]}>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Text style={[styles.stepTitle, { marginBottom: 0 }]}>01. GALERÍA MULTIMEDIA</Text>
              <TouchableOpacity onPress={() => Alert.alert('Galería Multimedia', 'Sube imágenes de buena calidad y bien iluminadas de tu producto. La primera foto será la principal y servirá como portada de tu anuncio.')}>
                <HelpCircle size={16} color={colors.primary} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
              <TouchableOpacity style={[styles.addImageBtn, isMePro && styles.proDashedBorder]} onPress={pickImage}>
                <Plus size={32} color={colors.textLight} strokeWidth={2.4} />
                <Text style={styles.addImageText}>Añadir</Text>
              </TouchableOpacity>
              
              {images.map((img, index) => (
                <View key={index} style={[styles.imageWrapper, isMePro && styles.proBorder]}>
                  <Image source={{ uri: img }} style={styles.previewImage} />
                  <TouchableOpacity style={styles.removePhotoBtn} onPress={() => removeImage(index)}>
                    <XCircle size={20} color={colors.error} strokeWidth={2.2} />
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
              <LabelWithHelp 
                title="Título" 
                helpTitle="Título del Anuncio" 
                helpText="Escribe un nombre claro, directo y descriptivo para tu producto. Evita usar demasiadas mayúsculas o palabras que no describan el artículo real." 
              />
              <TextInput 
                  style={[styles.titleInput, isMePro && styles.proBottomBorder]}
                placeholder="¿Qué vendes?"
                placeholderTextColor="#9CA3AF"
                value={title}
                onChangeText={setTitle}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputBlock, { flex: 1 }]}>
                <LabelWithHelp 
                  title="Precio (C$)" 
                  helpTitle="Precio del Artículo" 
                  helpText='Introduce un precio justo para tu producto. Si prefieres estar abierto a recibir ofertas e intercambios, puedes activar la opción "Precio Negociable".' 
                />
                <TextInput 
                  style={[styles.priceInput, isNegotiable && styles.priceInputDisabled, isMePro && styles.proBottomBorder]}
                  placeholder={isNegotiable ? "Negociable" : "0.00"}
                  placeholderTextColor={isNegotiable ? colors.textLight : colors.primary}
                  keyboardType="decimal-pad"
                  value={isNegotiable ? '' : price}
                  onChangeText={setPrice}
                  editable={!isNegotiable}
                />
              </View>
              <View style={[styles.inputBlock, { flex: 1.2, marginLeft: 15 }]}>
                <LabelWithHelp 
                  title="Clasificación" 
                  helpTitle="Categoría Principal" 
                  helpText="Selecciona la clasificación general de tu producto. Esto ayuda a agrupar tu anuncio correctamente en las búsquedas y secciones principales." 
                />
                <TouchableOpacity 
                  style={[styles.selector, isMePro && styles.proBorder]} 
                  onPress={() => setShowCategoryList(!showCategoryList)}
                >
                  <Text style={styles.selectorText}>{category?.name || 'Elegir...'}</Text>
                  <ChevronDown size={16} color={colors.textLight} strokeWidth={2.4} />
                </TouchableOpacity>
              </View>
            </View>

            {showCategoryList && (
              <View style={styles.dropdownList}>
                {categories.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.dropdownItem, category?.id === item.id && styles.dropdownItemActive]}
                    onPress={() => {
                      setCategory(item);
                      setSubcategory(null);
                      setShowCategoryList(false);
                    }}
                  >
                    <Text style={[styles.dropdownItemText, category?.id === item.id && styles.dropdownItemTextActive]}>
                      {item.icon} {item.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={[styles.negotiableToggle, isMePro && styles.proBorder]}
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

            <View style={styles.inputBlock}>
              <LabelWithHelp 
                title="Subcategoría" 
                helpTitle="Subcategoría Específica" 
                helpText="Este campo se habilita únicamente cuando seleccionas una clasificación primero. Permite detallar el tipo exacto de tu producto para una búsqueda más precisa." 
              />
              <TouchableOpacity 
                style={[styles.selector, isMePro && styles.proBorder, !category && { opacity: 0.5 }]} 
                onPress={() => category && setShowSubcategoryList(!showSubcategoryList)}
                disabled={!category}
              >
                <Text style={styles.selectorText}>{subcategory?.name || 'Elegir subcategoría...'}</Text>
                <ChevronDown size={16} color={colors.textLight} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>

            {showSubcategoryList && category?.subcategories && (
              <View style={styles.dropdownList}>
                {category.subcategories.map((sub) => (
                  <TouchableOpacity
                    key={sub.id}
                    style={[styles.dropdownItem, subcategory?.id === sub.id && styles.dropdownItemActive]}
                    onPress={() => {
                      setSubcategory(subcategory?.id === sub.id ? null : sub);
                      setShowSubcategoryList(false);
                    }}
                  >
                    <Text style={[styles.dropdownItemText, subcategory?.id === sub.id && styles.dropdownItemTextActive]}>
                      {sub.icon} {sub.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.inputBlock}>
              <LabelWithHelp 
                title="Ubicación" 
                helpTitle="Formato de Ubicación" 
                helpText='Por favor, escribe tu ubicación siguiendo el patrón "Barrio, Ciudad, País" (por ejemplo: "Ciudad Jardín, Managua, Nicaragua" o "Altamira, Managua, Nicaragua"). Esto ayuda al sistema a posicionar correctamente tu anuncio para compradores cercanos.' 
              />
              <View style={[styles.inputWithIcon, isMePro && styles.proBottomBorder]}>
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

          {/* Step 03: Payments */}
          <View style={styles.section}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Text style={[styles.stepTitle, { marginBottom: 0 }]}>03. PAGOS</Text>
              <TouchableOpacity onPress={() => Alert.alert('Métodos de Pago', 'Selecciona las formas en las que estás dispuesto a recibir el dinero por tu venta (Efectivo, Transferencia Bancaria o Apps de Pago Móvil). Esto ayuda a los compradores a saber cómo concretar el trato contigo.')}>
                <HelpCircle size={16} color={colors.primary} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <View style={styles.paymentGrid}>
              {[
                { id: 'Efectivo', icon: Banknote, label: 'Cash' },
                { id: 'Transferencia', icon: Landmark, label: 'Banco' },
                { id: 'Apps de Pago', icon: Smartphone, label: 'Apps' }
              ].map((method) => (
                <TouchableOpacity 
                  key={method.id} 
                  style={[
                    styles.paymentCard, 
                    paymentMethods.includes(method.id) && styles.paymentCardActive,
                    isMePro && styles.proBorder
                  ]}
                  onPress={() => togglePaymentMethod(method.id)}
                >
                  <method.icon 
                    size={24} 
                    color={paymentMethods.includes(method.id) ? colors.primary : colors.textLight} 
                    strokeWidth={2} 
                  />
                  <Text style={[
                    styles.paymentLabel, 
                    paymentMethods.includes(method.id) && styles.paymentLabelActive
                  ]}>{method.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Description - No title on web, just the input */}
          <View style={[styles.section, { marginTop: -10 }]}>
            <TextInput 
              style={[styles.descriptionInput, isMePro && styles.proBorder]}
              placeholder="Detalles del producto..."
              multiline
              numberOfLines={4}
              value={description}
              onChangeText={setDescription}
            />
          </View>

          {/* Oculto temporalmente: Sección de Planes (Promocionar / Hacerte Pro) */}
          {false && (
            <View style={styles.planCard}>
              <View style={styles.planCardHeader}>
                <Text style={styles.planCardTitle}>Elige cómo publicar</Text>
                <Text style={styles.planCardDesc}>Por defecto se publicará gratis. Si quieres destacar solo este anuncio, actívalo aquí.</Text>
              </View>
              <View style={styles.planButtonsRow}>
                <TouchableOpacity style={styles.planPromoteBtn} onPress={() => Alert.alert('Próximamente', 'Opciones de promoción en desarrollo.')}>
                  <Text style={styles.planPromoteBtnText}>Publicitar solo esta publicación</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.planProBtn} onPress={() => router.push('/profile')}>
                  <Text style={styles.planProBtnText}>Hacerte Pro</Text>
                  <View style={styles.proPill}>
                    <Text style={styles.proPillText}>PRO</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}


          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
              <XCircle size={20} color={colors.textLight} strokeWidth={2.4} />
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.publishBtn, isMePro && styles.proPublishBorder, isSubmitting && styles.publishBtnDisabled]} onPress={handlePublish} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator color={colors.white} /> : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.publishBtnText}>Publicar Anuncio</Text>
                </View>
              )}
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
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
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
  proBorder: {
    borderWidth: 2,
    borderColor: '#D4AF37',
  },
  proBorderStrong: {
    borderWidth: 2,
    borderColor: '#D4AF37',
  },
  proDashedBorder: {
    borderWidth: 2,
    borderColor: '#D4AF37',
  },
  proBottomBorder: {
    borderBottomColor: '#D4AF37',
  },
  proPublishBorder: {
    borderWidth: 2,
    borderColor: '#D4AF37',
  },
  section: {
    marginBottom: 35,
  },
  stepTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
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
    marginBottom: 8,
  },
  priceInputDisabled: {
    color: colors.textLight,
    opacity: 0.5,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 50,
  },
  selectorText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
  dropdownList: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    marginTop: -10,
    marginBottom: 20,
    overflow: 'hidden',
  },
  dropdownItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  dropdownItemActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  dropdownItemText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
  dropdownItemTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  subcategoryBlock: {
    marginBottom: 20,
  },
  subcategoryScrollContent: {
    paddingVertical: 4,
  },
  subcategoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    marginRight: 8,
  },
  subcategoryChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  subcategoryChipText: {
    color: colors.textLight,
    fontWeight: '800',
    fontSize: 12,
  },
  subcategoryChipTextActive: {
    color: colors.primary,
  },
  subcategoryChipEmoji: {
    marginRight: 6,
    fontSize: 14,
  },
  negotiableToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 20,
  },
  negotiableCheck: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  negotiableCheckActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  negotiableCheckMark: {
    color: colors.white,
    fontWeight: '900',
    fontSize: 14,
  },
  negotiableTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  negotiableDesc: {
    color: colors.textLight,
    fontSize: 12,
    marginTop: 2,
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
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 16,
    height: 120,
    fontSize: 16,
    color: colors.text,
    textAlignVertical: 'top',
  },
  planCard: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 22,
    padding: 20,
    marginHorizontal: spacing.md,
    marginBottom: 20,
  },
  planCardHeader: {
    marginBottom: 14,
  },
  planCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  planCardDesc: {
    fontSize: 14,
    color: colors.textLight,
    lineHeight: 20,
  },
  planButtonsRow: {
    gap: 12,
  },
  planPromoteBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  planPromoteBtnText: {
    color: '#ef4444',
    fontWeight: '800',
    fontSize: 14,
  },
  planProBtn: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  planProBtnText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 14,
  },
  proPill: {
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  proPillText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '900',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 16,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textLight,
  },
  publishBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 16,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  publishBtnDisabled: {
    opacity: 0.7,
  },
  publishBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
});
