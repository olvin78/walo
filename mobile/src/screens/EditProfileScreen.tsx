import React, { useEffect, useRef, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  Dimensions,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Modal , Linking} from 'react-native';
import { Image } from 'expo-image';
import { X, User, Lock, ShieldCheck, Camera, Pencil, Locate, ChevronRight, ChevronDown, Mail, ShieldCheck as ShieldIcon , Star, CreditCard, Wallet } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as WebBrowser from 'expo-web-browser';
import * as ExpoLinking from 'expo-linking';
import { colors, spacing, borderRadius } from '../theme/colors';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../services/auth';
import { updateProfile, changePassword, togglePlan, createPaypalSubscription, confirmPaypalSubscription, cancelPaypalSubscription, createStripeCheckoutSession, confirmStripeSession, cancelStripeSubscription, WEB_BASE_URL } from '../services/api';
import ManualMap from '../components/ManualMap';

const { width, height } = Dimensions.get('window');

export const EditProfileScreen = () => {
  const router = useRouter();
  const searchParams = useLocalSearchParams();
  const initialSection = (searchParams.section as 'public' | 'security' | 'verification') || 'public';
  const { user, reloadUser } = useAuth();
  const [showProSuccessModal, setShowProSuccessModal] = useState(false);
  const [proSuccessMessage, setProSuccessMessage] = useState({ title: '', desc: '', isPro: false });
  const [showPlanPolicy, setShowPlanPolicy] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCancelPlanModal, setShowCancelPlanModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [activeSection, setActiveSection] = useState<'public' | 'security' | 'plan' | 'verification'>(initialSection);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState<number>(12.1364);
  const [longitude, setLongitude] = useState<number>(-86.2514);
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState(Date.now());
  
  // Local file state for uploads
  const [newAvatar, setNewAvatar] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [newCover, setNewCover] = useState<ImagePicker.ImagePickerAsset | null>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const isMePro = Boolean(user?.profile?.is_pro);
  const systemPaymentsEnabled = Boolean(user?.system_payments_enabled);
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [isFetchingCurrentLocation, setIsFetchingCurrentLocation] = useState(false);
  const [mapFocusToken, setMapFocusToken] = useState(0);
  const [locationStatusMessage, setLocationStatusMessage] = useState('');
  const [locationStatusError, setLocationStatusError] = useState(false);

  // Modals state
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  
  // Password form state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Email state for modal
  const [email, setEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');

  useEffect(() => {
    console.log('[EditProfile] User object updated:', { 
      email: user?.email, 
      avatar: user?.profile?.avatar 
    });
    if (user) {
      setEmail(user.email || '');
      setNewEmail(user.email || '');
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setLocation(user.profile?.location || '');
      setLatitude(user.profile?.latitude ? parseFloat(user.profile.latitude as any) : 12.1364); // Default to Nicaragua (Managua)
      setLongitude(user.profile?.longitude ? parseFloat(user.profile.longitude as any) : -86.2514);
      setPhone(user.profile?.phone || '');
      setBio(user.profile?.bio || '');
      setAvatar(user.profile?.avatar ? `${user.profile.avatar}?t=${timestamp}` : null);
      setCoverImage(user.profile?.cover_image ? `${user.profile.cover_image}?t=${timestamp}` : null);
    }
  }, [user, timestamp]);

  const handlePickImage = async (type: 'avatar' | 'cover') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'avatar' ? [1, 1] : [16, 9],
        quality: 0.8,
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        if (type === 'avatar') {
          setNewAvatar(asset);
          setAvatar(asset.uri);
        } else {
          setNewCover(asset);
          setCoverImage(asset.uri);
        }
      }
    } catch (e) {
      console.error('Error picking image', e);
      Alert.alert('Error', 'No se pudo abrir la galería.');
    }
  };

  const handleSearchLocation = async () => {
    if (!location) {
      Alert.alert('Aviso', 'Por favor ingresa una ubicación para buscar.');
      return;
    }

    setIsSearchingLocation(true);
    try {
      // Use OpenStreetMap Nominatim for free geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        setLatitude(parseFloat(lat));
        setLongitude(parseFloat(lon));
        setMapFocusToken((value) => value + 1);
        // We don't need to update 'location' as it's already there
      } else {
        Alert.alert('No encontrado', 'No pudimos encontrar esa ubicación en el mapa.');
      }
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Error', 'Hubo un problema al buscar la ubicación.');
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const geocodeLocalityCenter = async (locality: string) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locality)}&limit=1`
      );
      const data = await response.json();
      if (data?.length > 0) {
        return {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
        };
      }
    } catch (error) {
      console.error('Geocode locality center error:', error);
    }

    return null;
  };

  const reverseGeocodeCoordinates = async (lat: number, lng: number) => {
    try {
      const nativeResults = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }).catch(() => []);
      const nativeAddress = nativeResults?.[0];

      if (nativeAddress) {
        const locality = nativeAddress.city || nativeAddress.subregion || nativeAddress.region || nativeAddress.district || nativeAddress.country || '';
        if (locality) {
          setLocation(locality);
          return locality;
        }
      }

      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      const data = await response.json();

      if (data?.address) {
        const addr = data.address;
        const locality = addr.city || addr.town || addr.village || addr.municipality || addr.county || addr.state || addr.country || '';
        if (locality) {
          setLocation(locality);
          return locality;
        }
      }
    } catch (error) {
      console.error('Reverse geocoding current location error:', error);
    }

    return null;
  };

  const handleUseCurrentLocation = async () => {
    setIsFetchingCurrentLocation(true);
    setLocationStatusMessage('');
    setLocationStatusError(false);
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
          setLocationStatusError(true);
          setLocationStatusMessage('En web, la ubicación suele requerir HTTPS o abrir la app en localhost/Expo Go.');
          return;
        }

        if (!navigator.geolocation) {
          setLocationStatusError(true);
          setLocationStatusMessage('Tu navegador no soporta geolocalización.');
          return;
        }

        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 10000,
          });
        });

        const rawLat = position.coords.latitude;
        const rawLng = position.coords.longitude;
        const locality = await reverseGeocodeCoordinates(rawLat, rawLng);
        const safeCenter = locality ? await geocodeLocalityCenter(locality) : null;
        const lat = safeCenter?.latitude ?? rawLat;
        const lng = safeCenter?.longitude ?? rawLng;
        setLatitude(lat);
        setLongitude(lng);
        setMapFocusToken((value) => value + 1);
        setLocationStatusMessage('Ubicación detectada correctamente.');
        Alert.alert('Ubicación actualizada', 'Hemos seleccionado tu pueblo o municipio actual.');
        return;
      }

      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationStatusError(true);
        setLocationStatusMessage('Debes aceptar el permiso de ubicación para usar esta función.');
        Alert.alert('Permiso requerido', 'Necesitamos acceso a tu ubicación para seleccionar tu ubicación actual.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const rawLat = position.coords.latitude;
      const rawLng = position.coords.longitude;
      const locality = await reverseGeocodeCoordinates(rawLat, rawLng);
      const safeCenter = locality ? await geocodeLocalityCenter(locality) : null;
      const lat = safeCenter?.latitude ?? rawLat;
      const lng = safeCenter?.longitude ?? rawLng;
      setLatitude(lat);
      setLongitude(lng);
      setMapFocusToken((value) => value + 1);
      setLocationStatusMessage('Ubicación detectada correctamente.');
      Alert.alert('Ubicación actualizada', 'Hemos seleccionado tu pueblo o municipio actual.');
    } catch (error) {
      console.error('Current location error:', error);
      setLocationStatusError(true);
      setLocationStatusMessage('No pudimos obtener tu ubicación. Revisa permisos o prueba desde Expo Go.');
      Alert.alert('Error', 'No pudimos obtener tu ubicación actual. Revisa los permisos de ubicación y vuelve a intentarlo.');
    } finally {
      setIsFetchingCurrentLocation(false);
    }
  };


  const runCancelPlan = async () => {
    try {
      setIsSaving(true);
      if (user?.profile?.has_stripe_subscription || user?.profile?.has_paypal_subscription) {
        const result = user.profile.has_stripe_subscription
          ? await cancelStripeSubscription()
          : await cancelPaypalSubscription();
        await reloadUser();
        setProSuccessMessage({
          title: 'Plan Cancelado',
          desc: result.refunded
            ? 'Se canceló tu suscripción y se reembolsó el cargo actual, ya no eres PRO.'
            : 'No se renovará tu suscripción. Seguirás disfrutando de PRO hasta el final del período ya pagado.',
          isPro: !result.refunded,
        });
      } else {
        await togglePlan();
        await reloadUser();
        setProSuccessMessage({
          title: 'Plan Cancelado',
          desc: 'Has vuelto al plan básico y gratuito.',
          isPro: false,
        });
      }
      setShowProSuccessModal(true);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo cancelar el plan.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePro = () => {
    if (isMePro) {
      setShowCancelPlanModal(true);
      return;
    }
    setShowPaymentModal(true);
  };

  const handleConfirmCancelPlan = () => {
    setShowCancelPlanModal(false);
    runCancelPlan();
  };

  const handleSelectStripe = async () => {
    setShowPaymentModal(false);
    try {
      setIsSaving(true);
      const redirectUrl = ExpoLinking.createURL('stripe-return');
      const successUrl = `${redirectUrl}?session_id={CHECKOUT_SESSION_ID}`;
      const session = await createStripeCheckoutSession(successUrl, redirectUrl);
      if (!session.url) {
        throw new Error('No se recibió el enlace de pago de Stripe.');
      }
      const result = await WebBrowser.openAuthSessionAsync(session.url, redirectUrl);
      if (result.type !== 'success' || !result.url) {
        return; // El usuario canceló el pago en Stripe
      }
      const sessionId = ExpoLinking.parse(result.url).queryParams?.session_id as string | undefined;
      if (!sessionId) {
        throw new Error('No se recibió el identificador de la sesión de pago.');
      }
      await confirmStripeSession(sessionId);
      await reloadUser();
      setProSuccessMessage({
        title: '¡Bienvenido a PRO!',
        desc: 'Has desbloqueado todas las funciones premium de Igualo.',
        isPro: true,
      });
      setShowProSuccessModal(true);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo completar el pago con Stripe.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectPaypal = async () => {
    setShowPaymentModal(false);
    try {
      setIsSaving(true);
      const redirectUrl = ExpoLinking.createURL('paypal-return');
      const subscription = await createPaypalSubscription(redirectUrl);
      if (!subscription.approve_url) {
        throw new Error('No se recibió el enlace de pago de PayPal.');
      }
      const result = await WebBrowser.openAuthSessionAsync(subscription.approve_url, redirectUrl);
      if (result.type !== 'success') {
        return; // El usuario canceló la suscripción en PayPal
      }
      await confirmPaypalSubscription(subscription.id);
      await reloadUser();
      setProSuccessMessage({
        title: '¡Bienvenido a PRO!',
        desc: 'Has desbloqueado todas las funciones premium de Igualo.',
        isPro: true,
      });
      setShowProSuccessModal(true);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo completar el pago con PayPal.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenScanner = async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert('Permiso denegado', 'Necesitamos acceso a la cámara para tomar la foto de verificación.');
        return;
      }
    }
    setShowScanner(true);
  };

  const uploadVerificationPhoto = async (uri: string) => {
    setIsCapturing(true);
    try {
      const formData = new FormData();
      const photoFile = Platform.OS === 'web'
        ? await (await fetch(uri)).blob()
        : { uri, name: 'verification.jpg', type: 'image/jpeg' };

      formData.append('verification_photo', photoFile as any);

      await updateProfile(formData);
      await reloadUser();
      setShowScanner(false);
      Alert.alert('¡Escaneo recibido!', 'Tu identidad está siendo procesada. Te avisaremos cuando el sello de verificado aparezca en tu perfil.');
    } catch (e) {
      console.error('Error uploading verification photo', e);
      Alert.alert('Error', 'No se pudo subir la foto de verificación. Inténtalo de nuevo.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleCaptureScan = async () => {
    if (!cameraRef.current || isCapturing) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) await uploadVerificationPhoto(photo.uri);
    } catch (e) {
      console.error('Error capturing photo', e);
      Alert.alert('Error', 'No se pudo capturar la foto. Inténtalo de nuevo.');
    }
  };

  const handleSave = async () => {
    console.log('[EditProfile] handleSave ENTER');
    setIsSaving(true);
    
    try {
      const formData = new FormData();
      
      // Basic info
      formData.append('first_name', firstName || '');
      formData.append('last_name', lastName || '');
      formData.append('location', location || '');
      formData.append('phone', phone || '');
      formData.append('bio', bio || '');
      
      if (latitude !== undefined && latitude !== null) {
        formData.append('latitude', latitude.toFixed(6));
      }
      if (longitude !== undefined && longitude !== null) {
        formData.append('longitude', longitude.toFixed(6));
      }

      // Helper for media
      const processAsset = async (asset: ImagePicker.ImagePickerAsset) => {
        if (Platform.OS === 'web') {
          const res = await fetch(asset.uri);
          return await res.blob();
        }
        return {
          uri: asset.uri,
          name: asset.fileName || 'photo.jpg',
          type: asset.mimeType || 'image/jpeg',
        };
      };

      if (newAvatar) {
        console.log('[EditProfile] Processing Avatar...');
        const avatarFile = await processAsset(newAvatar);
        formData.append('avatar', avatarFile as any);
      }

      if (newCover) {
        console.log('[EditProfile] Processing Cover...');
        const coverFile = await processAsset(newCover);
        formData.append('cover_image', coverFile as any);
      }

      console.log('[EditProfile] Sending PATCH request...');
      await updateProfile(formData);
      
      console.log('[EditProfile] Success! Reloading user...');
      await reloadUser();
      setTimestamp(Date.now());
      
      Alert.alert('Éxito', 'Perfil actualizado correctamente.');
      router.back();
    } catch (error: any) {
      console.error('[EditProfile] Error in handleSave:', error);
      let errorMsg = 'No se pudieron guardar los cambios. Intenta de nuevo.';
      
      if (error.data) {
        // DRF usually returns errors as an object with field names as keys
        const firstKey = Object.keys(error.data)[0];
        const errorDetail = error.data[firstKey];
        if (Array.isArray(errorDetail)) {
          errorMsg = `${firstKey}: ${errorDetail[0]}`;
        } else if (typeof errorDetail === 'string') {
          errorMsg = `${firstKey}: ${errorDetail}`;
        } else if (error.data.detail) {
          errorMsg = error.data.detail;
        }
      }
      
      Alert.alert('Error', errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Todos los campos son obligatorios.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas nuevas no coinciden.');
      return;
    }

    setIsSavingSecurity(true);
    try {
      await changePassword({ old_password: oldPassword, new_password: newPassword, confirm_password: confirmPassword });
      Alert.alert('Éxito', 'Contraseña actualizada correctamente.');
      setPasswordModalVisible(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('[Security] Error saving password:', error);
      const msg = error.data?.old_password?.[0] || error.data?.new_password?.[0] || error.data?.confirm_password?.[0] || 'Error al actualizar contraseña.';
      Alert.alert('Error', msg);
    } finally {
      setIsSavingSecurity(false);
    }
  };

  const handleSaveEmail = async () => {
    if (!newEmail || newEmail === user?.email) {
      setEmailModalVisible(false);
      return;
    }

    setIsSavingSecurity(true);
    try {
      await updateProfile({ email: newEmail });
      await reloadUser();
      Alert.alert('Éxito', 'Correo electrónico actualizado correctamente.');
      setEmailModalVisible(false);
    } catch (error: any) {
      console.error('[Security] Error saving email:', error);
      Alert.alert('Error', error.data?.email?.[0] || 'Error al actualizar correo.');
    } finally {
      setIsSavingSecurity(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <X size={28} color={colors.text} strokeWidth={2.2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configuración</Text>
        <TouchableOpacity 
          style={styles.saveHeaderBtn} 
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.saveHeaderBtnText}>Guardar</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* TABS NAVIGATION */}
      <View style={styles.tabsWrapper}>
        <TouchableOpacity 
          style={[styles.tabItem, activeSection === 'public' && styles.activeTabItem]} 
          onPress={() => setActiveSection('public')}
        >
          <User size={18} color={activeSection === 'public' ? colors.primary : '#9CA3AF'} strokeWidth={2} />
          <Text style={[styles.tabLabel, activeSection === 'public' && styles.activeTabLabel]}>Perfil Público</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tabItem, activeSection === 'security' && styles.activeTabItem]} 
          onPress={() => setActiveSection('security')}
        >
          <Lock size={18} color={activeSection === 'security' ? colors.primary : '#9CA3AF'} strokeWidth={2} />
          <Text style={[styles.tabLabel, activeSection === 'security' && styles.activeTabLabel]}>Seguridad</Text>
        </TouchableOpacity>

        {systemPaymentsEnabled && (
          <TouchableOpacity
            style={[styles.tabItem, activeSection === 'plan' && (isMePro ? styles.activeTabItemPro : styles.activeTabItem)]}
            onPress={() => setActiveSection('plan')}
          >
            <Star size={18} color={activeSection === 'plan' ? (isMePro ? '#F59E0B' : colors.primary) : '#9CA3AF'} strokeWidth={2} />
            <Text style={[styles.tabLabel, activeSection === 'plan' && (isMePro ? styles.activeTabLabelPro : styles.activeTabLabel)]}>Mi plan</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.tabItem, activeSection === 'verification' && styles.activeTabItem]} 
          onPress={() => setActiveSection('verification')}
        >
          <ShieldCheck size={18} color={activeSection === 'verification' ? colors.primary : '#9CA3AF'} strokeWidth={2} />
          <Text style={[styles.tabLabel, activeSection === 'verification' && styles.activeTabLabel]}>Verificación</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={{ flex: 1, backgroundColor: colors.white }}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {activeSection === 'public' && (
            <View>
              {/* Visual Identity Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Identidad Visual</Text>
                
                <View style={styles.coverBox}>
                  <Image 
                    key={`${coverImage}-${timestamp}`}
                    source={{ uri: coverImage || 'https://images.unsplash.com/photo-1557683316-973673baf926?w=800' }} 
                    style={styles.coverImage} 
                  />
                  <TouchableOpacity style={styles.changeCoverBtn} onPress={() => handlePickImage('cover')}>
                    <Camera size={20} color={colors.white} strokeWidth={2} />
                    <Text style={styles.changeCoverText}>Cambiar Portada</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.avatarEditContainer}>
                  <TouchableOpacity style={styles.avatarWrapper} onPress={() => handlePickImage('avatar')}>
                    <Image 
                      key={`${avatar}-${timestamp}`}
                      source={{ uri: avatar || 'https://via.placeholder.com/150' }} 
                      style={styles.avatar} 
                    />
                    <View style={styles.avatarEditBtn}>
                      <Pencil size={14} color={colors.white} strokeWidth={2.2} />
                    </View>
                  </TouchableOpacity>
                  <View style={styles.avatarInfo}>
                    <Text style={styles.usernameText}>@{user?.username || 'usuario'}</Text>
                    <Text style={styles.avatarHint}>Recomendado: 400x400px</Text>
                  </View>
                </View>
              </View>

              {/* Profile Details Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Datos Personales</Text>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Nombre</Text>
                  <TextInput
                    style={styles.input}
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="Tu nombre"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Apellido</Text>
                  <TextInput
                    style={styles.input}
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Tu apellido"
                  />
                </View>
              </View>

              {/* Contact Information Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Información de contacto</Text>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Ubicación actual</Text>
                  <View style={styles.locationContainer}>
                    <TextInput
                      style={[styles.input, { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 }]}
                      value={location}
                      onChangeText={setLocation}
                      placeholder="Ej: Managua, Nicaragua"
                    />
                    <TouchableOpacity 
                      style={styles.searchMapBtn}
                      onPress={handleSearchLocation}
                      disabled={isSearchingLocation}
                    >
                      {isSearchingLocation ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <Text style={styles.searchMapBtnText}>Buscar en mapa</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={styles.currentLocationBtn}
                    onPress={handleUseCurrentLocation}
                    disabled={isFetchingCurrentLocation}
                  >
                    {isFetchingCurrentLocation ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Locate size={18} color={colors.primary} strokeWidth={2} />
                        <Text style={styles.currentLocationBtnText}>Seleccionar ubicación actual</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  {locationStatusMessage ? (
                    <Text style={[styles.locationStatusText, locationStatusError && styles.locationStatusErrorText]}>
                      {locationStatusMessage}
                    </Text>
                  ) : null}
                </View>

                {/* Interactive Map View */}
                <View style={styles.mapWrapper}>
                  <ManualMap 
                    latitude={latitude}
                    longitude={longitude}
                    setLatitude={setLatitude}
                    setLongitude={setLongitude}
                    setLocation={setLocation}
                    focusToken={mapFocusToken}
                    style={styles.map}
                  />
                </View>
                {latitude && longitude ? (
                  <Text style={styles.coordinatesText}>
                    Coordenadas: {latitude.toFixed(6)}, {longitude.toFixed(6)}
                  </Text>
                ) : null}

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Teléfono de contacto</Text>
                  <TextInput
                    style={styles.input}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+505 0000 0000"
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Biografía (Bio)</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={bio}
                    onChangeText={setBio}
                    placeholder="Escribe algo sobre ti..."
                    multiline
                    numberOfLines={4}
                  />
                  <Text style={styles.inputHint}>Esto aparecerá en tu perfil público bajo tu nombre.</Text>
                </View>
              </View>
            </View>
          )}

          {activeSection === 'security' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cuenta y Seguridad</Text>
              
              <View style={styles.settingsGroup}>
                <TouchableOpacity style={styles.settingsRow} onPress={() => setPasswordModalVisible(true)}>
                  <View style={[styles.iconCircle, { backgroundColor: 'rgba(52, 199, 89, 0.1)' }]}>
                    <Lock size={20} color="#34C759" strokeWidth={2} />
                  </View>
                  <View style={styles.settingsTextWrapper}>
                    <Text style={styles.settingsLabel}>Cambiar contraseña</Text>
                    <Text style={styles.settingsSubLabel}>Actualiza tu clave de acceso</Text>
                  </View>
                  <ChevronRight size={18} color="#D1D5DB" strokeWidth={2.2} />
                </TouchableOpacity>

                <View style={styles.settingsSeparator} />

                <TouchableOpacity style={styles.settingsRow} onPress={() => setEmailModalVisible(true)}>
                  <View style={[styles.iconCircle, { backgroundColor: 'rgba(0, 122, 255, 0.1)' }]}>
                    <Mail size={20} color="#007AFF" strokeWidth={2} />
                  </View>
                  <View style={styles.settingsTextWrapper}>
                    <Text style={styles.settingsLabel}>Cambiar correo electrónico</Text>
                    <Text style={styles.settingsSubLabel}>{user?.email || 'configurar correo'}</Text>
                  </View>
                  <ChevronRight size={18} color="#D1D5DB" strokeWidth={2.2} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {activeSection === 'plan' && systemPaymentsEnabled && (
            <View style={styles.section}>
              <View style={styles.verifyScannerCard}>
                <View style={styles.scannerHeader}>
                  <Text style={{ fontSize: 60, marginBottom: 15 }}>⭐</Text>
                  <Text style={styles.scannerHeaderTitle}>Tu Plan Actual</Text>
                  <Text style={styles.scannerHeaderDesc}>
                    {isMePro ? 'Estás disfrutando de todos los beneficios de la cuenta PRO en Igualo.' : 'Actualmente estás en el plan básico y gratuito de Igualo.'}
                  </Text>
                </View>

                {isMePro ? (
                  <View style={styles.verifyStatusMsg}>
                    <View style={[styles.statusIcon, {backgroundColor: '#FEF3C7'}]}><Text style={{ color: '#D97706', fontWeight: '800' }}>★</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.verifyStatusTitle, {color: '#92400E'}]}>Suscripción PRO Activa</Text>
                      <Text style={[styles.verifyStatusText, {color: '#B45309'}]}>Tienes acceso a insignias PRO, más visibilidad y contacto prioritario.</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.verifyStatusMsg}>
                    <View style={[styles.statusIcon, {backgroundColor: '#F3F4F6'}]}><Text style={{ color: '#4B5563', fontWeight: '800' }}>✓</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.verifyStatusTitle}>Plan Básico</Text>
                      <Text style={styles.verifyStatusText}>Para destacar tus anuncios y obtener beneficios exclusivos, considera actualizar tu plan.</Text>
                    </View>
                  </View>
                )}
                
                {!isMePro ? (
                  <View style={styles.scannerActions}>
                    <TouchableOpacity style={[styles.startCamBtn, {backgroundColor: '#D4AF37', borderColor: '#000', borderWidth: 2}]} onPress={handleTogglePro} disabled={isSaving}>
                      <Text style={[styles.startCamBtnText, {color: '#000'}]}>{isSaving ? 'Cargando...' : 'Actualizar a PRO'}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.scannerActions}>
                    <TouchableOpacity style={[styles.startCamBtn, {backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1}]} onPress={handleTogglePro} disabled={isSaving}>
                      <Text style={[styles.startCamBtnText, {color: '#EF4444'}]}>{isSaving ? 'Cargando...' : 'Cancelar Plan PRO'}</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.planPolicyBox}>
                  <TouchableOpacity onPress={() => setShowPlanPolicy((value) => !value)} style={styles.planPolicyToggle}>
                    <Text style={styles.planPolicyToggleText}>
                      {isMePro ? 'Política de Cancelación' : 'Términos de Suscripción PRO'}
                    </Text>
                    <ChevronDown size={16} color={colors.textLight} strokeWidth={2.4} style={showPlanPolicy ? styles.planPolicyChevronOpen : undefined} />
                  </TouchableOpacity>
                  {showPlanPolicy && (
                    <Text style={styles.planPolicyText}>
                      {isMePro
                        ? 'Al cancelar tu plan, este no se renovará para el próximo ciclo. Ten en cuenta que no se realizarán devoluciones de dinero por el período actual ya pagado, a menos que la cancelación ocurra dentro de las primeras 12 horas desde la activación y el pago sea anulado antes de nuestro período de facturación (días 23 al 25 de cada mes).'
                        : 'Al activar tu cuenta Pro, el pago se renovará automáticamente cada mes. Puedes cancelar tu suscripción en cualquier momento desde esta configuración.'}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          )}

          {activeSection === 'verification' && (
            <View style={styles.section}>
              <View style={styles.verifyScannerCard}>
                <View style={styles.scannerHeader}>
                  <Text style={{ fontSize: 60, marginBottom: 15 }}>🛡️</Text>
                  <Text style={styles.scannerHeaderTitle}>Verificación de Identidad</Text>
                  <Text style={styles.scannerHeaderDesc}>
                    Captura tu rostro para confirmar que eres una persona real. Esta foto será revisada por el equipo de Igualo.
                  </Text>
                </View>

                {user?.profile?.is_verified ? (
                  <View style={styles.verifyStatusMsg}>
                    <View style={[styles.statusIcon, { backgroundColor: '#DCFCE7' }]}><Text style={{ color: '#16A34A', fontWeight: '800' }}>✓</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.verifyStatusTitle, { color: '#15803D' }]}>Perfil verificado</Text>
                      <Text style={[styles.verifyStatusText, { color: '#166534' }]}>Tu identidad ya fue confirmada. Tu sello de verificado está activo en tu perfil.</Text>
                    </View>
                  </View>
                ) : user?.profile?.has_verification_photo ? (
                  <View style={styles.verifyStatusMsg}>
                    <View style={styles.statusIcon}><Text style={{ color: '#000', fontWeight: '800' }}>✓</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.verifyStatusTitle}>Escaneo recibido</Text>
                      <Text style={styles.verifyStatusText}>Tu identidad está siendo procesada. Te avisaremos cuando el sello de verificado aparezca en tu perfil.</Text>
                    </View>
                  </View>
                ) : null}

                {!user?.profile?.is_verified && (
                  <View style={styles.scannerActions}>
                    <TouchableOpacity style={styles.startCamBtn} onPress={handleOpenScanner}>
                      <Text style={styles.startCamBtnText}>{user?.profile?.has_verification_photo ? 'Tomar otra foto' : 'Iniciar Escáner'}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>

        {activeSection === 'public' && (
          <View style={styles.footer}>
            <TouchableOpacity 
              style={[styles.saveBtn, isSaving && { opacity: 0.7 }]} 
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.saveBtnText}>Guardar todos los cambios</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Password Modal */}
      <Modal
        visible={passwordModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cambiar Contraseña</Text>
              <TouchableOpacity onPress={() => setPasswordModalVisible(false)}>
                <X size={24} color={colors.text} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Contraseña Actual</Text>
                <TextInput 
                  style={styles.modalInput} 
                  secureTextEntry 
                  value={oldPassword}
                  onChangeText={setOldPassword}
                  placeholder="••••••••"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nueva Contraseña</Text>
                <TextInput 
                  style={styles.modalInput} 
                  secureTextEntry 
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Mínimo 8 caracteres"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirmar Nueva Contraseña</Text>
                <TextInput 
                  style={styles.modalInput} 
                  secureTextEntry 
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Repite la nueva contraseña"
                />
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.modalActionBtn, isSavingSecurity && { opacity: 0.7 }]}
              onPress={handleSavePassword}
              disabled={isSavingSecurity}
            >
              {isSavingSecurity ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.modalActionBtnText}>Actualizar Contraseña</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Email Modal */}
      <Modal
        visible={emailModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEmailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Actualizar Correo</Text>
              <TouchableOpacity onPress={() => setEmailModalVisible(false)}>
                <X size={24} color={colors.text} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nuevo Correo Electrónico</Text>
                <TextInput 
                  style={styles.modalInput} 
                  value={newEmail}
                  onChangeText={setNewEmail}
                  placeholder="tu@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <Text style={styles.inputHint}>Se requiere un correo válido para las notificaciones de Igualo.</Text>
            </View>

            <TouchableOpacity 
              style={[styles.modalActionBtn, isSavingSecurity && { opacity: 0.7 }]}
              onPress={handleSaveEmail}
              disabled={isSavingSecurity}
            >
              {isSavingSecurity ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.modalActionBtnText}>Guardar Correo</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

{/* Verification Scanner Modal */}
      <Modal
        visible={showScanner}
        animationType="slide"
        onRequestClose={() => setShowScanner(false)}
      >
        <View style={styles.scannerModalContainer}>
          <StatusBar barStyle="light-content" />
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />

          <View style={styles.scannerOverlay} pointerEvents="box-none">
            <TouchableOpacity style={styles.scannerCloseBtn} onPress={() => setShowScanner(false)}>
              <X size={22} color="#fff" strokeWidth={2.4} />
            </TouchableOpacity>

            <View style={styles.scannerGuideWrapper} pointerEvents="none">
              <User size={Math.min(width * 1.4, height * 0.68)} color="#10B981" strokeWidth={0.7} />
              <Text style={styles.scannerGuideText}>Encuadra tu rostro y hombros dentro de la guía</Text>
            </View>

            <View style={styles.scannerFooter}>
              <TouchableOpacity
                style={styles.scannerCaptureBtn}
                onPress={handleCaptureScan}
                disabled={isCapturing}
                activeOpacity={0.8}
              >
                {isCapturing ? <ActivityIndicator color="#000" /> : <View style={styles.scannerCaptureBtnInner} />}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

{/* Cancel Plan Confirm Modal */}
      <Modal
        visible={showCancelPlanModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCancelPlanModal(false)}
      >
        <View style={[styles.modalOverlay, { justifyContent: 'center', alignItems: 'center' }]}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIconWrapper}>
              <Text style={{ fontSize: 40 }}>⚠️</Text>
            </View>
            <Text style={styles.confirmTitle}>Cancelar Plan PRO</Text>
            <Text style={styles.confirmDesc}>¿Estás seguro de que quieres cancelar tu plan PRO? Perderás tu insignia y la promoción de tus anuncios de inmediato.</Text>

            <TouchableOpacity
              style={[styles.modalActionBtn, { backgroundColor: '#EF4444', width: '100%' }]}
              onPress={handleConfirmCancelPlan}
              activeOpacity={0.85}
            >
              <Text style={styles.modalActionBtnText}>Sí, cancelar PRO</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.confirmDismissBtn}
              onPress={() => setShowCancelPlanModal(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.confirmDismissBtnText}>Volver</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

{/* Payment Method Modal */}
      <Modal
        visible={showPaymentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Actualizar a PRO</Text>
              <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                <X size={24} color={colors.text} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>

            <Text style={styles.paymentModalSubtitle}>Elige tu método de pago para continuar.</Text>

            <View style={styles.settingsGroup}>
              <TouchableOpacity style={styles.settingsRow} onPress={handleSelectStripe}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(99, 91, 255, 0.1)' }]}>
                  <CreditCard size={20} color="#635BFF" strokeWidth={2} />
                </View>
                <View style={styles.settingsTextWrapper}>
                  <Text style={styles.settingsLabel}>Tarjeta / Google Pay / Apple Pay</Text>
                  <Text style={styles.settingsSubLabel}>Débito, crédito o billetera digital</Text>
                </View>
                <ChevronRight size={18} color="#D1D5DB" strokeWidth={2.2} />
              </TouchableOpacity>

              <View style={styles.settingsSeparator} />

              <TouchableOpacity style={styles.settingsRow} onPress={handleSelectPaypal}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(0, 48, 135, 0.1)' }]}>
                  <Wallet size={20} color="#003087" strokeWidth={2} />
                </View>
                <View style={styles.settingsTextWrapper}>
                  <Text style={styles.settingsLabel}>PayPal</Text>
                  <Text style={styles.settingsSubLabel}>Paga con tu cuenta PayPal</Text>
                </View>
                <ChevronRight size={18} color="#D1D5DB" strokeWidth={2.2} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

{/* PRO Success Modal */}
      <Modal
        visible={showProSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowProSuccessModal(false)}
      >
        <View style={[styles.modalOverlay, { justifyContent: 'center', alignItems: 'center' }]}>
          <View style={[styles.proSuccessCard, proSuccessMessage.isPro ? {borderColor: '#D4AF37', borderWidth: 2} : {}]}>
            <View style={styles.proSuccessIconWrapper}>
              <Text style={{ fontSize: 50 }}>{proSuccessMessage.isPro ? '👑' : '✓'}</Text>
            </View>
            <Text style={styles.proSuccessTitle}>{proSuccessMessage.title}</Text>
            <Text style={styles.proSuccessDesc}>{proSuccessMessage.desc}</Text>
            
            <TouchableOpacity 
              style={[styles.proSuccessBtn, proSuccessMessage.isPro ? {backgroundColor: '#D4AF37'} : {backgroundColor: colors.primary}]}
              onPress={() => setShowProSuccessModal(false)}
              activeOpacity={0.8}
            >
              <Text style={[styles.proSuccessBtnText, proSuccessMessage.isPro ? {color: '#000'} : {color: '#fff'}]}>Continuar</Text>
            </TouchableOpacity>

            <View style={styles.proSimpleLegal}>
              <Text style={styles.proSimpleLegalText}>
                Consulta nuestras{' '}
                <Text style={styles.proSimpleLegalLink} onPress={() => Linking.openURL(`${WEB_BASE_URL}/terminos/`)}>
                  Políticas y Condiciones
                </Text>
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
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
    backgroundColor: colors.white,
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
  tabsWrapper: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    marginRight: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabItem: {
    borderBottomColor: colors.primary,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
    marginLeft: 6,
  },
  activeTabLabel: {
    color: colors.primary,
  },
  soonBadge: {
    backgroundColor: '#1F2937',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  soonText: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '800',
  },
  comingSoonContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soonIconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  comingSoonTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  comingSoonText: {
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  activeSoonBadge: {
    backgroundColor: 'rgba(234, 179, 8, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.4)',
  },
  activeSoonText: {
    color: '#EAB308',
    fontWeight: '800',
    fontSize: 12,
  },
  saveHeaderBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  saveHeaderBtnText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 15,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  section: {
    marginBottom: 35,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.textLight,
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  coverBox: {
    height: 140,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F3F4F6',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  changeCoverBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  changeCoverText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  avatarEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#F3F4F6',
  },
  avatarEditBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.white,
  },
  avatarInfo: {
    marginLeft: 20,
  },
  usernameText: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
  },
  avatarHint: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: 4,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    marginLeft: 4,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchMapBtn: {
    backgroundColor: '#10B981',
    height: 52,
    paddingHorizontal: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  searchMapBtnText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 13,
  },
  currentLocationBtn: {
    marginTop: 10,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  currentLocationBtnText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 14,
  },
  locationStatusText: {
    marginTop: 8,
    fontSize: 12,
    color: '#047857',
    fontWeight: '600',
  },
  locationStatusErrorText: {
    color: colors.error,
  },
  mapWrapper: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapPlaceholder: {
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  mapPlaceholderText: {
    fontSize: 14,
    color: colors.textLight,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
  },
  coordinatesText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '700',
    marginTop: 5,
  },
  textArea: {
    height: 120,
    paddingTop: 15,
    textAlignVertical: 'top',
    paddingHorizontal: 14,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 52,
    fontSize: 15,
    color: colors.text,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 52,
  },
  settingsGroup: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    overflow: 'hidden',
    paddingHorizontal: 15,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsTextWrapper: {
    flex: 1,
    marginLeft: 15,
  },
  settingsLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  settingsSubLabel: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: 2,
  },
  settingsSeparator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 55,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: colors.white,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  saveBtnText: {
    color: colors.white,
    fontWeight: '900',
    fontSize: 16,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
  },
  paymentModalSubtitle: {
    fontSize: 14,
    color: colors.textLight,
    marginBottom: 20,
  },
  modalBody: {
    marginBottom: 30,
  },
  modalInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 52,
    fontSize: 15,
    color: colors.text,
  },
  modalActionBtn: {
    backgroundColor: colors.primary,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalActionBtnText: {
    color: colors.white,
    fontWeight: '900',
    fontSize: 16,
  },
  inputHint: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: 8,
    marginBottom: 10,
    lineHeight: 18,
  },
  verifyScannerCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  scannerHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  scannerHeaderTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  scannerHeaderDesc: {
    fontSize: 15,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 22,
  },
  verifyStatusMsg: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 15,
    borderRadius: 16,
    marginBottom: 30,
    width: '100%',
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  verifyStatusTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  verifyStatusText: {
    fontSize: 13,
    color: colors.textLight,
    lineHeight: 18,
  },
  planPolicyBox: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    width: '100%',
  },
  planPolicyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planPolicyToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textLight,
  },
  planPolicyChevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  planPolicyText: {
    fontSize: 12,
    color: colors.textLight,
    lineHeight: 18,
    textAlign: 'justify',
    marginTop: 10,
  },
  scannerActions: {
    width: '100%',
  },
  startCamBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  startCamBtnText: {
    fontSize: 16,
    fontWeight: '900',
  },
  activeTabItemPro: {
    borderBottomColor: '#D4AF37',
  },
  activeTabLabelPro: {
    color: '#D4AF37',
  },
  scannerModalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  scannerOverlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  scannerCloseBtn: {
    marginTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 50,
    marginLeft: spacing.md,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerGuideWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerGuideText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 40,
  },
  scannerFooter: {
    alignItems: 'center',
    paddingBottom: 50,
  },
  scannerCaptureBtn: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 5,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerCaptureBtnInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#fff',
  },
  confirmCard: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  confirmIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  confirmDesc: {
    fontSize: 14,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  confirmDismissBtn: {
    marginTop: 12,
    paddingVertical: 8,
  },
  confirmDismissBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textLight,
  },
  proSuccessCard: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  proSuccessIconWrapper: {
    marginBottom: 20,
  },
  proSuccessTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  proSuccessDesc: {
    fontSize: 15,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 25,
  },
  proSuccessBtn: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  proSuccessBtnText: {
    fontSize: 16,
    fontWeight: '900',
  },
  proSimpleLegal: {
    marginTop: 20,
    width: '100%',
    alignItems: 'center',
  },
  proSimpleLegalText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  proSimpleLegalLink: {
    color: colors.primary,
    fontWeight: '700',
  },
});