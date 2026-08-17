import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useRouter } from 'expo-router';
import { ArrowRight, Store, Tag, ShieldCheck, User, Sparkles } from 'lucide-react-native';
import Animated, { 
  FadeInDown, 
  FadeInUp, 
  FadeIn, 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withSequence, 
  withTiming, 
  Easing 
} from 'react-native-reanimated';
import { colors } from '../src/theme/colors';
import { useAuth } from '../src/services/auth';

const { width, height } = Dimensions.get('window');

const features = [
  { icon: Tag, label: 'Publica Gratis' },
  { icon: Store, label: 'Compra Local' },
  { icon: ShieldCheck, label: 'Trato Directo' },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();

  // Floating animation for logo
  const floatAnim = useSharedValue(0);

  useEffect(() => {
    floatAnim.value = withRepeat(
      withSequence(
        withTiming(-12, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
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

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Ambient background magic (Pro Max effects) */}
      <LinearGradient
        colors={['rgba(16, 185, 129, 0.15)', 'rgba(255, 255, 255, 0)']}
        locations={[0, 0.7]}
        style={styles.topGlow}
      />
      <Animated.View pointerEvents="none" style={[styles.glowOrb, styles.glowOrbLeft]} />
      <Animated.View pointerEvents="none" style={[styles.glowOrb, styles.glowOrbRight]} />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Header Brand */}
          <Animated.View 
            entering={FadeInDown.delay(100).duration(800).springify().damping(14).mass(0.9)} 
            style={[styles.brandRow, floatingStyle]}
          >
            <View style={styles.logoWrapper}>
              <Image source={require('../assets/images/igualo-icon.png')} style={styles.logoImg} contentFit="contain" />
            </View>
            <View>
              <Text style={styles.logoText}>IGUALO</Text>
              <Text style={styles.logoTag}>EL MARKETPLACE</Text>
            </View>
          </Animated.View>

          <View style={styles.bottomContent}>
            {/* Tagline */}
            <Animated.View entering={FadeInUp.delay(200).duration(800).springify().damping(14)} style={styles.taglinePill}>
              <Sparkles size={14} color="#059669" style={{ marginRight: 6 }} />
              <Text style={styles.taglineText}>La evolución de las compras</Text>
            </Animated.View>

            {/* Hero */}
            <Animated.View entering={FadeInUp.delay(300).duration(800).springify().damping(14)} style={styles.hero}>
              <Text style={styles.heroTitle}>
                Compra y vende{'\n'}
                <Text style={styles.heroTitleAccent}>al instante.</Text>
              </Text>
              <Text style={styles.heroSubtitle}>
                El ecosistema premium para negociar en Nicaragua. Seguro, rápido y sin complicaciones.
              </Text>
            </Animated.View>

            {/* Features */}
            <Animated.View entering={FadeInUp.delay(400).duration(800).springify().damping(14)} style={styles.featuresRow}>
              {features.map((feature) => (
                <View key={feature.label} style={styles.featureCard}>
                  <View style={styles.featureIcon}>
                    <feature.icon size={20} color={colors.primary} strokeWidth={2.5} />
                  </View>
                  <Text style={styles.featureLabel}>{feature.label}</Text>
                </View>
              ))}
            </Animated.View>

            {/* Actions */}
            <Animated.View entering={FadeInUp.delay(500).duration(800).springify().damping(14)} style={styles.actions}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => router.push('/auth/register')}
                style={styles.primaryBtn}
              >
                <LinearGradient
                  colors={['#34D399', '#10B981', '#059669']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryBtnGradient}
                >
                  <View style={styles.primaryBtnInner}>
                    <Text style={styles.primaryBtnText}>Comenzar ahora</Text>
                    <ArrowRight size={22} color={colors.white} strokeWidth={2.5} />
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                activeOpacity={0.8}
                onPress={() => router.push('/auth/login')}
              >
                <User size={20} color={colors.text} strokeWidth={2.2} />
                <Text style={styles.secondaryBtnText}>Ya tengo cuenta</Text>
              </TouchableOpacity>

              <Animated.Text entering={FadeIn.delay(800).duration(1000)} style={styles.footerText}>
                Al continuar aceptas los Términos y la Política de Privacidad de Igualo.
              </Animated.Text>
            </Animated.View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.5,
  },
  glowOrb: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    opacity: 0.65,
  },
  glowOrbLeft: {
    top: -120,
    left: -100,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  glowOrbRight: {
    top: -60,
    right: -140,
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 48 : 0,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingBottom: 28,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: height * 0.06,
    gap: 16,
  },
  logoWrapper: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.15)',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  logoImg: {
    width: 46,
    height: 46,
    borderRadius: 12,
  },
  logoText: {
    color: '#022c22',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 4,
  },
  logoTag: {
    color: '#059669',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 5,
    marginTop: 2,
    textAlign: 'center',
  },
  bottomContent: {
    marginTop: 'auto',
    paddingTop: 40,
  },
  taglinePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 26,
  },
  taglineText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  hero: {
    marginBottom: 32,
  },
  heroTitle: {
    color: '#0f172a',
    fontSize: 50,
    lineHeight: 56,
    fontWeight: '900',
    letterSpacing: -1.5,
  },
  heroTitleAccent: {
    color: '#10B981',
  },
  heroSubtitle: {
    color: '#64748b',
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '500',
    marginTop: 16,
    maxWidth: 340,
  },
  featuresRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 36,
  },
  featureCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureLabel: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  actions: {
    gap: 14,
  },
  primaryBtn: {
    height: 64,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
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
    borderRadius: 21,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  primaryBtnText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  secondaryBtn: {
    height: 60,
    borderRadius: 22,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
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
  secondaryBtnText: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '800',
  },
  footerText: {
    color: '#9CA3AF',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 6,
  },
});