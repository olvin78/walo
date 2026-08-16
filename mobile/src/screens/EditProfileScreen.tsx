import React, { useEffect, useState } from 'react';
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
import { Modal } from 'react-native';
import { Image } from 'expo-image';
import { X, User, Lock, ShieldCheck, Camera, Pencil, Locate, ChevronRight, Mail, ShieldCheck as ShieldIcon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { colors, spacing, borderRadius } from '../theme/colors';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../services/auth';
import { updateProfile, changePassword } from '../services/api';
import ManualMap from '../components/ManualMap';

const { width } = Dimensions.get('window');

export const EditProfileScreen = () => {
  const router = useRouter();
  const searchParams = useLocalSearchParams();
  const initialSection = (searchParams.section as 'public' | 'security' | 'verification') || 'public';
  const { user, reloadUser } = useAuth();
  const [activeSection, setActiveSection] = useState<'public' | 'security' | 'verification'>(initialSection);

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

          {activeSection === 'verification' && (
            <View style={styles.comingSoonContainer}>
              <View style={styles.soonIconWrapper}>
                <ShieldIcon size={60} color={colors.primary} strokeWidth={1.6} />
              </View>
              <Text style={styles.comingSoonTitle}>Verificación de Perfil</Text>
              <Text style={styles.comingSoonText}>
                Estamos trabajando para traerte un sistema de verificación oficial. 
                Pronto podrás obtener tu insignia de confianza.
              </Text>
              <View style={styles.activeSoonBadge}>
                <Text style={styles.activeSoonText}>Disponible Próximamente</Text>
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

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
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
  }
});
