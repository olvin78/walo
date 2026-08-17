import { useState, useEffect } from 'react';
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
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

WebBrowser.maybeCompleteAuthSession();
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { User, Lock, AlertCircle, ArrowRight, Eye, EyeOff, ArrowLeft } from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp, useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { colors, spacing } from '../../src/theme/colors';
import { useAuth } from '../../src/services/auth';
import { ApiError } from '../../src/services/api';

export default function LoginScreen() {
  const router = useRouter();
  const { login, loginWithGoogle } = useAuth();
  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { width } = useWindowDimensions();

  // Floating animation for logo
  const floatAnim = useSharedValue(0);

  useEffect(() => {
    floatAnim.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const floatingStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: floatAnim.value }]
    };
  });

  const handleSubmit = async () => {
    if (!loginValue.trim() || !password) {
      Alert.alert('Datos incompletos', 'Escribe tu usuario/correo y contraseña.');
      return;
    }
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      await login(loginValue.trim(), password);
      router.replace('/(tabs)');
    } catch (error) {
      console.error('[Igualo Login] Failed', error instanceof ApiError ? { status: error.status, body: error.data } : error);
      const message = error instanceof ApiError && [400, 401].includes(error.status)
        ? 'Usuario o contraseña incorrectos'
        : 'No se pudo conectar con el servidor';
      setErrorMessage(message);
      Alert.alert('No se pudo iniciar sesión', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: 'REPLACED_GOOGLE_OAUTH_CLIENT_ID',
    androidClientId: 'REPLACED_GOOGLE_OAUTH_CLIENT_ID',
    iosClientId: 'REPLACED_GOOGLE_OAUTH_CLIENT_ID',
  });

  useEffect(() => {
    if (response?.type === 'success' && response.authentication?.idToken) {
      handleServerGoogleLogin(response.authentication.idToken);
    }
  }, [response]);

  const handleServerGoogleLogin = async (idToken: string) => {
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      await loginWithGoogle(idToken);
      router.replace('/(tabs)');
    } catch (error) {
      console.error('[Igualo Google Login] Failed', error);
      setErrorMessage('No se pudo iniciar sesión con Google');
      Alert.alert('Error', 'No se pudo iniciar sesión con Google');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      if (!request) {
        Alert.alert('Cargando', 'El servicio de Google se está inicializando, espera un segundo.');
        return;
      }
      await promptAsync();
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error de Google', error?.message || 'Asegúrate de configurar los Client IDs de Android/iOS en login.tsx');
    }
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
          {/* Ambient background magic (Pro Max effects) */}
          <LinearGradient
            colors={['rgba(16, 185, 129, 0.12)', 'rgba(255, 255, 255, 0)']}
            locations={[0, 1]}
            style={styles.topGlow}
          />
          <Animated.View pointerEvents="none" style={[styles.glowOrb, styles.glowOrbLeft]} />
          <Animated.View pointerEvents="none" style={[styles.glowOrb, styles.glowOrbRight]} />

          <View style={[styles.container, isWide && styles.containerWide]}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => router.back()}
                activeOpacity={0.8}
              >
                <ArrowLeft size={22} color={colors.text} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>

            {/* Form Section */}
            <View style={[styles.formSection, isWide && styles.formSectionWide]}>
              <Animated.View 
                entering={FadeInDown.delay(100).duration(800).springify().damping(14)}
                style={[styles.logoContainer, floatingStyle]}
              >
                <View style={styles.logoWrapper}>
                  <Image source={require('../../assets/images/igualo-icon.png')} style={styles.logoImg} contentFit="contain" />
                </View>
                <Text style={styles.logoText}>IGUALO</Text>
              </Animated.View>

              <Animated.View entering={FadeInUp.delay(200).duration(800).springify().damping(14)}>
                <Text style={styles.title}>¡Bienvenido de vuelta!</Text>
                <Text style={styles.subtitle}>Inicia sesión para acceder a tu cuenta</Text>
              </Animated.View>

              <Animated.View entering={FadeInUp.delay(300).duration(800).springify().damping(14)} style={styles.inputsBlock}>
                {/* Username / Email Input */}
                <View style={styles.inputContainer}>
                  <View style={styles.inputWrapper}>
                    <View style={styles.inputIconBox}>
                      <User size={18} color={colors.primary} strokeWidth={2.5} />
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="Usuario o email"
                      placeholderTextColor="#94a3b8"
                      value={loginValue}
                      onChangeText={setLoginValue}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>

                {/* Password Input */}
                <View style={styles.inputContainer}>
                  <View style={styles.inputWrapper}>
                    <View style={styles.inputIconBox}>
                      <Lock size={18} color={colors.primary} strokeWidth={2.5} />
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="Contraseña"
                      placeholderTextColor="#94a3b8"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      {showPassword 
                        ? <EyeOff size={20} color="#94a3b8" strokeWidth={2} />
                        : <Eye size={20} color="#94a3b8" strokeWidth={2} />}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Error Message */}
                {errorMessage ? (
                  <View style={styles.errorBox}>
                    <AlertCircle size={16} color={colors.error} strokeWidth={2.2} />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                ) : null}
              </Animated.View>

              <Animated.View entering={FadeInUp.delay(400).duration(800).springify().damping(14)}>
                {/* Login Button */}
                <TouchableOpacity
                  style={[styles.primaryBtn, isSubmitting && styles.buttonDisabled]}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={['#34D399', '#10B981', '#059669']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.primaryBtnGradient}
                  >
                    <View style={styles.primaryBtnInner}>
                      {isSubmitting ? (
                        <ActivityIndicator color={colors.white} />
                      ) : (
                        <>
                          <Text style={styles.primaryBtnText}>Entrar</Text>
                          <ArrowRight size={18} color={colors.white} strokeWidth={2.4} />
                        </>
                      )}
                    </View>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.googleButton, (!request || isSubmitting) && styles.buttonDisabled]}
                  onPress={handleGoogleLogin}
                  disabled={!request || isSubmitting}
                  activeOpacity={0.8}
                >
                  <Image 
                    source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/120px-Google_%22G%22_logo.svg.png' }}
                    style={{ width: 22, height: 22 }}
                    contentFit="contain"
                  />
                  <Text style={styles.googleButtonText}>Iniciar sesión con Google</Text>
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>O</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Register Link */}
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => router.push('/auth/register')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.secondaryBtnText}>Crear cuenta nueva</Text>
                </TouchableOpacity>
              </Animated.View>
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
    backgroundColor: '#FAFAFA',
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
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
  },
  glowOrb: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 0.5,
  },
  glowOrbLeft: {
    top: -80,
    left: -100,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  glowOrbRight: {
    top: -40,
    right: -100,
    backgroundColor: 'rgba(14, 165, 233, 0.06)',
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  formSection: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl * 2,
  },
  formSectionWide: {
    paddingHorizontal: spacing.xl + 8,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoWrapper: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.15)',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
    marginBottom: 12,
  },
  logoImg: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  logoText: {
    color: '#022c22',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 4,
  },
  title: {
    color: '#0f172a',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#64748b',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
    fontWeight: '500',
  },
  inputsBlock: {
    gap: 16,
    marginBottom: 32,
  },
  inputContainer: {
    width: '100%',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.04)',
    backgroundColor: colors.white,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  inputIconBox: {
    width: 52,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '600',
    paddingRight: spacing.md,
  },
  eyeBtn: {
    width: 52,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: 12,
    marginTop: -8,
    marginBottom: 8,
    gap: 8,
  },
  errorText: {
    color: colors.error,
    fontWeight: '700',
    fontSize: 13,
    flex: 1,
  },
  primaryBtn: {
    height: 60,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
    marginBottom: 16,
  },
  primaryBtnGradient: {
    flex: 1,
    padding: 1,
  },
  primaryBtnInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: 19,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: colors.white,
    fontWeight: '900',
    fontSize: 17,
    letterSpacing: 0.3,
  },
  googleButton: {
    height: 60,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.06)',
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  googleButtonText: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 16,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  dividerText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '800',
    marginHorizontal: 16,
  },
  secondaryBtn: {
    height: 60,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.04)',
  },
  secondaryBtnText: {
    color: '#059669',
    fontWeight: '900',
    fontSize: 16,
  },
});
