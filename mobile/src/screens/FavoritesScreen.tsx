import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import { Heart, Star, MapPin, Search } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing } from '../theme/colors';
import { getFavoriteListings, setListingFavorite, type ListingSummary } from '../../lib/igualo-api';
import { useAuth } from '../services/auth';
import { ProFooter } from '../components/ProFooter';

function formatPrice(value: any, currency?: string) {
  const numeric = typeof value === 'string' ? Number(value) : value;
  const prefix = currency === 'USD' ? '$' : 'C$';
  if (isNaN(numeric)) return `${prefix} ${value}`;
  return `${prefix} ${new Intl.NumberFormat('es-NI', { maximumFractionDigits: 0 }).format(numeric)}`;
}

export const FavoritesScreen = () => {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();
  const isMePro = Boolean(user?.profile?.is_pro);
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
  const cardWidth = (Math.min(width, 1200) - spacing.sm * (numColumns + 1)) / numColumns;

  // En móvil, los favoritos se agrupan en bandas de 2 filas independientes
  // que se deslizan hacia los lados; el scroll vertical de la página no cambia.
  const productBands = React.useMemo(() => {
    if (!isMobile) return [];
    const columnsPerBand = numColumns * 2;
    const bandSize = columnsPerBand * 2;
    const bands: ListingSummary[][] = [];
    for (let i = 0; i < favorites.length; i += bandSize) {
      bands.push(favorites.slice(i, i + bandSize));
    }
    return bands;
  }, [favorites, numColumns, isMobile]);

  const splitBandRows = (band: ListingSummary[]) => {
    const topRow: ListingSummary[] = [];
    const bottomRow: ListingSummary[] = [];
    band.forEach((item, i) => (i % 2 === 0 ? topRow : bottomRow).push(item));
    return [topRow, bottomRow] as const;
  };
  const headerMaxHeight = isMobile ? 132 : 180;
  const headerMinHeight = isMobile ? (Platform.OS === 'ios' ? 100 : 90) : (Platform.OS === 'ios' ? 120 : 100);
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
    outputRange: [0, 0.08],
    extrapolate: 'clamp',
  });

  const titleScale = scrollY.interpolate({
    inputRange: [0, headerScrollDistance],
    outputRange: [1, 0.85],
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

  const renderCard = (item: ListingSummary) => (
    <TouchableOpacity
      key={`art-${item.id}`}
      style={[styles.card, { width: cardWidth }, item.is_promoted && styles.promotedCard]}
      activeOpacity={0.9}
      onPress={() => router.push(`/listing/${item.id}`)}
    >
      <View style={styles.imageBox}>
        <Image source={{ uri: item.main_image || '' }} style={styles.image} contentFit="cover" transition={400} />
        <BlurView intensity={30} tint="light" style={styles.favBox}>
          <TouchableOpacity onPress={() => removeFavorite(item.id)}>
            <Heart size={16} color={colors.error} strokeWidth={2.4} fill={colors.error} />
          </TouchableOpacity>
        </BlurView>
        {item.is_promoted && (
          <View style={styles.promoBadge}>
            <Text style={styles.promoText}>★ PRO</Text>
          </View>
        )}
      </View>
      <View style={styles.infoBox}>
        {item.is_negotiable ? (
          <Text style={styles.negotiableText}>🤝 Precio Negociable</Text>
        ) : (
          <Text style={styles.priceText}>{formatPrice(item.price, item.currency)}</Text>
        )}
        <Text style={styles.titleText} numberOfLines={1}>{item.title}</Text>
        <View style={styles.locBox}>
          <MapPin size={10} color={colors.textLight} strokeWidth={2.2} />
          <Text style={styles.locText}>{item.city || item.location}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderItem = ({ item }: { item: ListingSummary }) => renderCard(item);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      
      <Animated.View pointerEvents="box-none" style={[styles.header, { height: headerHeight, shadowOpacity: headerShadow }]}>
        <LinearGradient
          colors={['#0F172A', '#064E3B', '#10B981']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1.5 }}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Glow Orbs for the header */}
        <View style={styles.headerOrb1} />
        <View style={styles.headerOrb2} />
        
        <View style={[styles.headerContent, isMobile && styles.headerContentMobile]}>
          <Animated.View style={[styles.headerTitleRow, { transform: [{ scale: titleScale }] }]}>
            <Text style={styles.headerTitle}>Tus Favoritos</Text>
            {favorites.length > 0 && (
              <View style={styles.countBadge}>
                <Heart size={14} color="#10B981" fill="#10B981" strokeWidth={2.5} />
                <Text style={styles.countBadgeText}>{favorites.length}</Text>
              </View>
            )}
          </Animated.View>
        </View>
      </Animated.View>

      {isMobile ? (
        <Animated.ScrollView
          contentContainerStyle={[styles.list, { paddingTop: headerMaxHeight + 6 }]}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadFavorites(true); }}
              progressViewOffset={headerMaxHeight + 6}
            />
          }
        >
          {favorites.length === 0 ? (
            !isLoading && (
              <View style={[styles.empty, styles.emptyMobile]}>
                <View style={[styles.emptyHeroCard, styles.emptyHeroCardMobile]}>
                  <View style={styles.emptyGlow} />
                  <View style={[styles.emptyCopyBox, styles.emptyCopyBoxMobile]}>
                    <View style={styles.emptyIconCircle}>
                      <Heart size={38} color={colors.white} strokeWidth={2.5} fill={colors.white} />
                    </View>
                    <Text style={[styles.emptyTitle, styles.emptyTitleMobile]}>Ningún favorito aún</Text>
                    <Text style={[styles.emptySub, styles.emptySubMobile]}>Los tesoros que guardes dándole al corazón aparecerán aquí mágicamente.</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.exploreBtn}
                  onPress={() => router.push('/(tabs)/search')}
                  activeOpacity={0.8}
                >
                  <Search size={18} color={colors.white} strokeWidth={2.5} />
                  <Text style={styles.exploreBtnText}>Explorar artículos</Text>
                </TouchableOpacity>
              </View>
            )
          ) : (
            productBands.map((band, bandIndex) => {
              const [topRow, bottomRow] = splitBandRows(band);
              return (
                <View key={`band-${bandIndex}`} style={styles.bandGroup}>
                  <GestureScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.bandContent}
                    style={styles.bandRow}
                  >
                    {topRow.map((item) => renderCard(item))}
                  </GestureScrollView>
                  <GestureScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.bandContent}
                    style={styles.bandRow}
                  >
                    {bottomRow.map((item) => renderCard(item))}
                  </GestureScrollView>
                </View>
              );
            })
          )}
          <View style={{ paddingBottom: 120 }}>
            {isMePro && favorites.length > 0 && <ProFooter />}
          </View>
        </Animated.ScrollView>
      ) : (
        <Animated.FlatList
          data={favorites}
          renderItem={renderItem}
          keyExtractor={(item) => `art-${item.id}`}
          numColumns={numColumns}
          key={numColumns}
          contentContainerStyle={[styles.list, { paddingTop: headerMaxHeight + 10 }]}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          onRefresh={() => { setRefreshing(true); loadFavorites(true); }}
          refreshing={refreshing}
          progressViewOffset={headerMaxHeight + 10}
          ListEmptyComponent={() => !isLoading && (
            <View style={styles.empty}>
              <View style={styles.emptyHeroCard}>
                <View style={styles.emptyGlow} />
                <View style={styles.emptyCopyBox}>
                  <View style={styles.emptyIconCircle}>
                    <Heart size={38} color={colors.white} strokeWidth={2.5} fill={colors.white} />
                  </View>
                  <Text style={styles.emptyTitle}>Ningún favorito aún</Text>
                  <Text style={styles.emptySub}>Los tesoros que guardes dándole al corazón aparecerán aquí mágicamente.</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.exploreBtn}
                onPress={() => router.push('/(tabs)/search')}
                activeOpacity={0.8}
              >
                <Search size={18} color={colors.white} strokeWidth={2.5} />
                <Text style={styles.exploreBtnText}>Explorar artículos</Text>
              </TouchableOpacity>
            </View>
          )}
          ListFooterComponent={() => (
            <View style={{ paddingBottom: 120 }}>
              {isMePro && favorites.length > 0 && <ProFooter />}
            </View>
          )}
        />
      )}

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
    backgroundColor: '#0F172A',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  headerOrb1: {
    position: 'absolute',
    top: -50,
    left: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
  },
  headerOrb2: {
    position: 'absolute',
    bottom: -80,
    right: -40,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
  },
  headerContent: {
    paddingHorizontal: 30,
    height: '100%',
    justifyContent: 'flex-end',
    paddingBottom: 25,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 44,
  },
  headerContentMobile: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    transformOrigin: 'left bottom',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  countBadge: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  countBadgeText: {
    color: '#064E3B',
    fontSize: 15,
    fontWeight: '900',
  },
  list: { paddingHorizontal: spacing.sm / 2 },
  bandGroup: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  bandRow: {
    // Cada fila es su propio ScrollView independiente: mover una no afecta a la otra.
  },
  bandContent: {
    gap: spacing.sm,
    paddingHorizontal: spacing.sm / 2,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 24,
    marginHorizontal: spacing.sm / 2,
    marginBottom: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F1F1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  promotedCard: {
    borderColor: '#F59E0B',
    borderWidth: 2,
  },
  imageBox: { height: 190, position: 'relative', backgroundColor: '#F9FAFB' },
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
    top: 12,
    left: 12,
    backgroundColor: '#1F2937',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    zIndex: 1,
  },
  promoText: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  infoBox: { padding: 14 },
  priceText: { fontSize: 20, fontWeight: '900', color: colors.text, marginBottom: 4, letterSpacing: -0.5 },
  negotiableText: { fontSize: 14, fontWeight: '800', color: colors.primary, marginBottom: 4 },
  titleText: { fontSize: 14, color: '#4B5563', fontWeight: '600', marginBottom: 8 },
  locBox: { flexDirection: 'row', alignItems: 'center' },
  locText: { fontSize: 11, color: colors.textLight, fontWeight: '700', marginLeft: 4 },
  empty: { marginTop: 64, alignItems: 'center', paddingHorizontal: 20 },
  emptyMobile: { marginTop: 8, paddingHorizontal: 12 },
  emptyHeroCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 36,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 3,
    alignItems: 'center',
  },
  emptyHeroCardMobile: {
    borderRadius: 30,
  },
  emptyGlow: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(16,185,129,0.15)',
    filter: 'blur(30px)',
  },
  emptyCopyBox: {
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 50,
    alignItems: 'center',
  },
  emptyCopyBoxMobile: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 40,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6,
  },
  emptyTitle: { color: '#0f172a', fontSize: 26, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 },
  emptySub: { color: '#64748b', fontSize: 16, textAlign: 'center', marginTop: 12, lineHeight: 24, fontWeight: '500' },
  emptyTitleMobile: { fontSize: 22 },
  emptySubMobile: { fontSize: 14, marginTop: 10 },
  exploreBtn: {
    marginTop: 32,
    backgroundColor: '#0F172A',
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 6,
  },
  exploreBtnText: { color: colors.white, fontWeight: '900', fontSize: 16, letterSpacing: 0.5 },
  loader: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.8)', zIndex: 100 },
});
