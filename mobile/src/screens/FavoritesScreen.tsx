import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { colors, spacing } from '../theme/colors';
import { getFavoriteListings, setListingFavorite, type ListingSummary } from '../../lib/igualo-api';
import { useAuth } from '../services/auth';

function formatPrice(value: any) {
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (isNaN(numeric)) return `C$ ${value}`;
  return `C$ ${new Intl.NumberFormat('es-NI', { maximumFractionDigits: 0 }).format(numeric)}`;
}

export const FavoritesScreen = () => {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { width } = useWindowDimensions();
  const [favorites, setFavorites] = useState<ListingSummary[]>([]);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const scrollY = React.useRef(new Animated.Value(0)).current;

  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;
  const isMobile = width < 768;
  const numColumns = isDesktop ? 4 : isTablet ? 3 : 2;
  const cardWidth = (Math.min(width, 1200) - spacing.md * (numColumns + 1)) / numColumns;
  const headerMaxHeight = isMobile ? 132 : 180;
  const headerMinHeight = isMobile ? (Platform.OS === 'ios' ? 72 : 56) : (Platform.OS === 'ios' ? 90 : 60);
  const headerScrollDistance = headerMaxHeight - headerMinHeight;

  const headerHeight = scrollY.interpolate({
    inputRange: [0, headerScrollDistance],
    outputRange: [headerMaxHeight, headerMinHeight],
    extrapolate: 'clamp',
  });

  const imageOpacity = scrollY.interpolate({
    inputRange: [0, headerScrollDistance / 1.5, headerScrollDistance],
    outputRange: [1, 0.4, 0],
    extrapolate: 'clamp',
  });

  const headerShadow = scrollY.interpolate({
    inputRange: [0, headerScrollDistance],
    outputRange: [0, 0.1],
    extrapolate: 'clamp',
  });

  const loadFavorites = useCallback(async (isInitial = true) => {
    if (!isAuthenticated) {
      setFavorites([]);
      setIsLoading(false);
      return;
    }
    if (!isInitial && (!nextUrl || isLoadingMore)) return;
    if (isInitial && !refreshing) setIsLoading(true);
    if (!isInitial) setIsLoadingMore(true);

    try {
      const data = await getFavoriteListings(isInitial ? undefined : nextUrl || undefined);
      setFavorites(prev => isInitial ? data.results : [...prev, ...data.results]);
      setNextUrl(data.next);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      setRefreshing(false);
    }
  }, [isAuthenticated, nextUrl, isLoadingMore, refreshing]);

  useEffect(() => {
    if (!isAuthLoading) loadFavorites(true);
  }, [isAuthLoading]);

  const removeFavorite = async (listingId: number) => {
    setFavorites(prev => prev.filter(item => item.id !== listingId));
    try {
      await setListingFavorite(listingId, false);
    } catch {
      loadFavorites(true);
    }
  };

  const renderItem = ({ item }: { item: ListingSummary }) => (
    <TouchableOpacity
      style={[styles.card, { width: cardWidth }]}
      activeOpacity={0.9}
      onPress={() => router.push(`/listing/${item.id}`)}
    >
      <View style={styles.imageBox}>
        <Image source={{ uri: item.main_image || '' }} style={styles.image} contentFit="cover" transition={400} />
        <BlurView intensity={30} tint="light" style={styles.favBox}>
          <TouchableOpacity onPress={() => removeFavorite(item.id)}>
            <Ionicons name="heart" size={16} color={colors.error} />
          </TouchableOpacity>
        </BlurView>
        {item.is_promoted && (
          <View style={styles.promoBadge}>
            <Ionicons name="star" size={8} color={colors.white} />
            <Text style={styles.promoText}>TOP</Text>
          </View>
        )}
      </View>
      <View style={styles.infoBox}>
        <Text style={styles.priceText}>{formatPrice(item.price)}</Text>
        <Text style={styles.titleText} numberOfLines={1}>{item.title}</Text>
        <View style={styles.locBox}>
          <Ionicons name="location-outline" size={10} color={colors.textLight} />
          <Text style={styles.locText}>{item.city || item.location}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      
      <Animated.View style={[styles.header, { height: headerHeight, shadowOpacity: headerShadow }]}> 
        <Animated.Image
          source={require('../../assets/images/favorites_art_light.png')}
          style={[styles.headerBg, { opacity: imageOpacity }]}
          resizeMode="cover"
        />
        <View style={styles.headerOverlay} />
        <View style={[styles.headerContent, isMobile && styles.headerContentMobile]}>
          <Text style={styles.headerTitle}>Favoritos</Text>
          <Text style={[styles.headerMeta, isMobile && styles.headerMetaMobile]}>
            {favorites.length} {favorites.length === 1 ? 'guardado' : 'guardados'}
          </Text>
        </View>
      </Animated.View>

      <Animated.FlatList
        data={favorites}
        renderItem={renderItem}
        keyExtractor={(item) => `art-${item.id}`}
        numColumns={numColumns}
        key={numColumns}
        contentContainerStyle={[styles.list, { paddingTop: headerMaxHeight + (isMobile ? 6 : 10) }]}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        onRefresh={() => { setRefreshing(true); loadFavorites(true); }}
        refreshing={refreshing}
        ListEmptyComponent={() => !isLoading && (
          <View style={[styles.empty, isMobile && styles.emptyMobile]}>
            <View style={[styles.emptyHeroCard, isMobile && styles.emptyHeroCardMobile]}>
              <Image
                source={require('../../assets/images/favorites_art_light.png')}
                style={[styles.emptyHeroImage, isMobile && styles.emptyHeroImageMobile]}
                contentFit="cover"
              />
              <View style={styles.emptyGlow} />
              <View style={[styles.emptyCopyBox, isMobile && styles.emptyCopyBoxMobile]}>
                <View style={styles.emptyMiniBadge}>
                  <Ionicons name="heart" size={12} color={colors.favorite} />
                  <Text style={styles.emptyMiniBadgeText}>Guardados para ti</Text>
                </View>
                <Text style={[styles.emptyTitle, isMobile && styles.emptyTitleMobile]}>Todavia no has guardado nada</Text>
                <Text style={[styles.emptySub, isMobile && styles.emptySubMobile]}>Cuando encuentres algo interesante, aparecera aqui para que lo tengas siempre a mano.</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.exploreBtn}
              onPress={() => router.push('/(tabs)/search')}
            >
              <Ionicons name="search" size={16} color={colors.white} />
              <Text style={styles.exploreBtnText}>Descubrir productos</Text>
            </TouchableOpacity>
          </View>
        )}
        ListFooterComponent={() => <View style={{ height: 120 }} />}
      />

      {isLoading && !refreshing && (
        <View style={styles.loader}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: colors.white,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 10,
    elevation: 5,
  },
  headerBg: { width: '100%', height: '100%', position: 'absolute' },
  headerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(16,185,129,0.08)' },
  headerContent: {
    paddingHorizontal: 30,
    height: '100%',
    justifyContent: 'flex-end',
    paddingBottom: 18,
  },
  headerContentMobile: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    color: '#064E3B',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  headerMeta: {
    color: '#065F46',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  headerMetaMobile: {
    fontSize: 12,
  },
  list: { paddingHorizontal: spacing.md },
  card: {
    backgroundColor: colors.white,
    borderRadius: 24,
    marginHorizontal: spacing.sm,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F1F1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  imageBox: { height: 170, position: 'relative', backgroundColor: '#F9FAFB' },
  image: { width: '100%', height: '100%' },
  favBox: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  promoBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  promoText: { color: colors.white, fontSize: 9, fontWeight: '900' },
  infoBox: { padding: 15 },
  priceText: { color: colors.text, fontSize: 19, fontWeight: '900', letterSpacing: -0.5 },
  titleText: { color: colors.textLight, fontSize: 13, marginTop: 4, fontWeight: '500' },
  locBox: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  locText: { color: '#9CA3AF', fontSize: 11, fontWeight: '600' },
  empty: { marginTop: 64, alignItems: 'center', paddingHorizontal: 20 },
  emptyMobile: { marginTop: 8, paddingHorizontal: 12 },
  emptyHeroCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#F3FBF7',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.07,
    shadowRadius: 24,
    elevation: 3,
  },
  emptyHeroCardMobile: {
    borderRadius: 24,
  },
  emptyHeroImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#ECFDF5',
  },
  emptyHeroImageMobile: {
    height: 118,
  },
  emptyGlow: {
    position: 'absolute',
    top: 24,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(16,185,129,0.10)',
  },
  emptyCopyBox: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 24,
  },
  emptyCopyBoxMobile: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
  },
  emptyMiniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
  },
  emptyMiniBadgeText: {
    color: '#047857',
    fontSize: 11,
    fontWeight: '800',
  },
  emptyTitle: { color: '#111827', fontSize: 27, fontWeight: '900', textAlign: 'center', letterSpacing: -0.8 },
  emptySub: { color: '#6B7280', fontSize: 15, textAlign: 'center', marginTop: 12, lineHeight: 23, fontWeight: '600' },
  emptyTitleMobile: { fontSize: 20, lineHeight: 24 },
  emptySubMobile: { fontSize: 13, lineHeight: 19, marginTop: 8 },
  exploreBtn: {
    marginTop: 24,
    backgroundColor: '#111827',
    paddingHorizontal: 24,
    paddingVertical: 15,
    borderRadius: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 3,
  },
  exploreBtnText: { color: colors.white, fontWeight: '800', fontSize: 14 },
  loader: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.8)', zIndex: 100 },
});
