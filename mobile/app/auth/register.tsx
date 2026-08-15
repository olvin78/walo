import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../src/theme/colors';
import { useAuth } from '../../src/services/auth';

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { width } = useWindowDimensions();

  const handleSubmit = async () => {
    if (!username.trim() || !email.trim() || !password || password !== password2) {
      Alert.alert('Datos inválidos', 'Completa los campos y confirma que las contraseñas coinciden.');
      return;
    }
    setIsSubmitting(true);
    try {
      await register({ username: username.trim(), email: email.trim(), password, password2 });
      router.replace('/(tabs)/profile');
    } catch {
      Alert.alert('No se pudo registrar', 'Revisa los datos e inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleRegister = () => {
    Alert.alert('Proximamente', 'El registro con Google estara disponible pronto en la app.');
  };

  const isWide = width >= 600;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.container, isWide && styles.containerWide]}>
            {/* Hero Image Section */}
            <View style={styles.heroSection}>
              <Image
                source={require('../../assets/images/auth_hero.png')}
                style={styles.heroImage}
                contentFit="cover"
                contentPosition="top"
              />
              <LinearGradient
                colors={['transparent', 'rgba(255,255,255,0.6)', 'rgba(255,255,255,1)']}
                style={styles.heroGradient}
              />
              {/* Back Button */}
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => router.back()}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-back" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Form Section */}
            <View style={[styles.formSection, isWide && styles.formSectionWide]}>
              <Text style={styles.logo}>IGUALO</Text>
              <Text style={styles.title}>Crea tu cuenta</Text>
              <Text style={styles.subtitle}>Únete a la comunidad y empieza a comprar y vender</Text>

              {/* Username Input */}
              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <View style={styles.inputIconBox}>
                    <Ionicons name="person-outline" size={18} color={colors.primary} />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Nombre de usuario"
                    placeholderTextColor="#9CA3AF"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* Email Input */}
              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <View style={styles.inputIconBox}>
                    <Ionicons name="mail-outline" size={18} color={colors.primary} />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Correo electrónico"
                    placeholderTextColor="#9CA3AF"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <View style={styles.inputIconBox}>
                    <Ionicons name="lock-closed-outline" size={18} color={colors.primary} />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Contraseña"
                    placeholderTextColor="#9CA3AF"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Password Input */}
              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <View style={styles.inputIconBox}>
                    <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Repetir contraseña"
                    placeholderTextColor="#9CA3AF"
                    value={password2}
                    onChangeText={setPassword2}
                    secureTextEntry={!showPassword}
                  />
                </View>
              </View>

              {/* Register Button */}
              <TouchableOpacity
                style={[styles.button, isSubmitting && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <View style={styles.buttonContent}>
                    <Text style={styles.buttonText}>Crear mi cuenta</Text>
                    <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.googleButton}
                onPress={handleGoogleRegister}
                activeOpacity={0.85}
              >
                <View style={styles.googleIconBox}>
                  <Ionicons name="logo-google" size={18} color="#EA4335" />
                </View>
                <Text style={styles.googleButtonText}>Crear cuenta con Google</Text>
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>o</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Login Link */}
              <TouchableOpacity
                style={styles.loginBtn}
                onPress={() => router.push('/auth/login')}
                activeOpacity={0.85}
              >
                <Text style={styles.loginBtnText}>Ya tengo cuenta</Text>
              </TouchableOpacity>

              {/* Terms */}
              <Text style={styles.termsText}>
                Al crear tu cuenta, aceptas nuestros términos de servicio y política de privacidad.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
  },
  containerWide: {
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  },
  // Hero Image
  heroSection: {
    height: 280,
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 100,
  },
  backBtn: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  // Form
  formSection: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl * 2,
    marginTop: -spacing.lg,
  },
  formSectionWide: {
    paddingHorizontal: spacing.xl + 8,
  },
  logo: {
    color: colors.primary,
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 2,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: spacing.sm,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    fontWeight: '500',
  },
  // Inputs
  inputContainer: {
    marginBottom: spacing.md - 2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    overflow: 'hidden',
  },
  inputIconBox: {
    width: 48,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
    paddingRight: spacing.md,
  },
  eyeBtn: {
    width: 48,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Buttons
  button: {
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: colors.white,
    fontWeight: '900',
    fontSize: 17,
    letterSpacing: 0.3,
  },
  googleButton: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
    flexDirection: 'row',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  googleIconBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleButtonText: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 15,
  },
  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
    marginHorizontal: spacing.md,
  },
  // Login Button
  loginBtn: {
    height: 56,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.04)',
  },
  loginBtnText: {
    color: colors.primary,
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  // Terms
  termsText: {
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 18,
    fontWeight: '500',
  },
});
