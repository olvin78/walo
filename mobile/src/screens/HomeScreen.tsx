import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  FlatList,
  TouchableOpacity,
  Platform,
  RefreshControl,
  useWindowDimensions
} from 'react-native';
import { Image } from 'expo-image';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import { MessageCircle, Bell } from 'lucide-react-native';
import { useRouter, Redirect } from 'expo-router';
import { colors, spacing } from '../theme/colors';
import { SearchBar } from '../components/SearchBar';
import { CategoryPill } from '../components/CategoryPill';
import { ProductCard } from '../components/ProductCard';
import { SectionHeader } from '../components/SectionHeader';
import { useAuth } from '../services/auth';
import { getConversations, type Conversation } from '../services/api';
import { useNotification } from '../contexts/NotificationContext';
import { getCategories, getHome, getUnreadNotificationsCount, type Category, type ListingSummary } from '../../lib/igualo-api';
import { CATEGORIES, PRODUCTS } from '../data/mockData';

const MAX_WIDTH = 1200;

export const HomeScreen = () => {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading, user: currentUser } = useAuth();
  const isMePro = Boolean(currentUser?.profile?.is_pro);
  const { showNotification } = useNotification();
  const [categories, setCategories] = useState<Category[]>([]);
  const [listings, setListings] = useState<(ListingSummary | (typeof PRODUCTS)[number])[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [categoriesScrollX, setCategoriesScrollX] = useState(0);
  const [categoriesViewportWidth, setCategoriesViewportWidth] = useState(0);
  const [categoriesContentWidth, setCategoriesContentWidth] = useState(0);
  const [bannerIndex, setBannerIndex] = useState(0);
  
  // Calculate responsive values
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;
  
  const isPhone = !isDesktop && !isTablet;

  const numColumns = useMemo(() => {
    if (isDesktop) return 4;
    if (isTablet) return 3;
    return 2;
  }, [isDesktop, isTablet]);

  const categoriesScrollRef = useRef<ScrollView | null>(null);

  const contentWidth = Math.min(width, MAX_WIDTH);
  const bannerWidth = contentWidth - spacing.md * 2;

  const cardWidth = useMemo(() => {
    return (contentWidth - spacing.sm * (numColumns + 1)) / numColumns;
  }, [contentWidth, numColumns]);

  // En móvil, los recomendados se agrupan en bandas de 2 filas independientes
  // que se deslizan hacia los lados; el scroll vertical de la página no cambia.
  const productBands = useMemo(() => {
    if (!isPhone) return [];
    const columnsPerBand = numColumns * 2;
    const bandSize = columnsPerBand * 2;
    const bands: (typeof listings)[] = [];
    for (let i = 0; i < listings.length; i += bandSize) {
      bands.push(listings.slice(i, i + bandSize));
    }
    return bands;
  }, [listings, numColumns, isPhone]);

  const splitBandRows = (band: typeof listings) => {
    const topRow: typeof listings = [];
    const bottomRow: typeof listings = [];
    band.forEach((item, i) => (i % 2 === 0 ? topRow : bottomRow).push(item));
    return [topRow, bottomRow] as const;
  };

  const banners = [
    {
      id: 'buscar',
      badge: 'NUEVO',
      title: 'Encuentra lo que\nbuscas',
      subtitle: 'Seguir navegando',
      cta: 'Empezar a buscar',
      image: require('../../assets/images/banner_promo.png'),
      onPress: () => router.push('/search'),
    },
    {
      id: 'favoritos',
      badge: 'GUARDA',
      title: 'Guarda tus\nfavoritos',
      subtitle: 'No pierdas ninguna oferta',
      cta: 'Ver favoritos',
      image: require('../../assets/images/banner_favoritos.jpg'),
      onPress: () => router.push('/favorites'),
    },
    {
      id: 'publicar',
      badge: 'VENDE YA',
      title: 'Publica y vende\nhoy mismo',
      subtitle: 'Gratis y sin comisiones',
      cta: 'Publicar ahora',
      image: require('../../assets/images/banner_vende.jpg'),
      onPress: () => router.push('/publish'),
    },
  ];



  const loadHome = useCallback(async () => {
    try {
      const [data, allCategories] = await Promise.all([getHome(), getCategories()]);
      setCategories(allCategories);
      const combined = [
        ...(data.recommended || []),
        ...(data.featured || []),
        ...(data.latest || [])
      ];
      const unique = combined.filter((item, index, self) =>
        self.findIndex(t => t.id === item.id) === index
      );
      setListings(unique);
    } catch {
      // Fallback a datos locales si la API no responde
      setCategories(CATEGORIES.map((item) => ({ id: Number(item.id), name: item.name, slug: item.name.toLowerCase(), icon: item.icon })));
      setListings(PRODUCTS);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    loadHome().finally(() => {
      if (isMounted) setIsLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, [loadHome]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadHome();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadHome]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const fetchCount = async () => {
      if (!isAuthenticated) return;
      try {
        const data = await getUnreadNotificationsCount();
        if (data.unread_count > unreadCount && unreadCount > 0) {
           showNotification({
             title: 'Nueva Notificación',
             message: 'Tienes nuevas notificaciones sin leer.',
             isPro: isMePro
           });
        }
        setUnreadCount(data.unread_count);

        const convs = await getConversations();
        const unreadMsgs = convs.filter((c: Conversation) => c.last_message && !c.last_message.is_read && !c.last_message.is_mine).length;
        setUnreadMessagesCount(unreadMsgs);
      } catch (err) {
        console.log('Error fetching counts', err);
      }
    };
    
    fetchCount();
    // Poll every 30 seconds for new notifications
    timer = setInterval(fetchCount, 30000) as unknown as NodeJS.Timeout;
    return () => clearInterval(timer);
  }, [isAuthenticated]);

  const handleCategoriesWheel = (event: any) => {
    if (Platform.OS !== 'web') return;
    const delta = event?.deltaY ?? event?.nativeEvent?.deltaY ?? 0;
    if (!delta) return;
    event.preventDefault?.();
    const nextX = Math.max(0, categoriesScrollX + delta);
    setCategoriesScrollX(nextX);
    categoriesScrollRef.current?.scrollTo({ x: nextX, animated: false });
  };

  const showCategoriesScrollbar = Platform.OS === 'web' && categoriesContentWidth > categoriesViewportWidth && categoriesViewportWidth > 0;
  const categoriesScrollbarThumbWidth = showCategoriesScrollbar
    ? Math.max((categoriesViewportWidth * categoriesViewportWidth) / categoriesContentWidth, 36)
    : 0;
  const categoriesScrollbarMaxOffset = Math.max(categoriesViewportWidth - categoriesScrollbarThumbWidth, 0);
  const categoriesScrollMax = Math.max(categoriesContentWidth - categoriesViewportWidth, 1);
  const categoriesScrollbarOffset = showCategoriesScrollbar
    ? Math.min((categoriesScrollX / categoriesScrollMax) * categoriesScrollbarMaxOffset, categoriesScrollbarMaxOffset)
    : 0;

  if (isAuthLoading) {
    return <View style={styles.rootContainer} />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/welcome" />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      
      <View style={[styles.rootContainer, { maxWidth: MAX_WIDTH, alignSelf: 'center', width: '100%' }]}>
        
        <View style={styles.topHeader}>
          <Text style={styles.logo}>IGUALO</Text>
          
          <View style={styles.headerRightActions}>
                        <TouchableOpacity style={[styles.iconCircle, isMePro && styles.iconCirclePro]} onPress={() => router.push('/messages')}>
              <MessageCircle size={22} color={colors.text} strokeWidth={2.2} />
              {unreadMessagesCount > 0 && (
                <View style={styles.notificationDot}>
                  <Text style={styles.notificationCountText}>{unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.iconCircle, isMePro && styles.iconCirclePro]} onPress={() => router.push('/notifications')}>
              <Bell size={22} color={colors.text} strokeWidth={2.2} />
              {unreadCount > 0 && (
                <View style={styles.notificationDot}>
                  <Text style={styles.notificationCountText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={[1]}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[colors.primary]} tintColor={colors.primary} />
          }
        >
          <View style={styles.titleSection}>
            <Text style={styles.mainTitle}>Compra y vende{"\n"}cerca de ti</Text>
          </View>

          <View style={styles.searchContainer}>
            <SearchBar 
              editable={false} 
              onPress={() => router.push('/search')} 
              onFilterPress={() => router.push({ pathname: '/search', params: { openFilter: 'true' } })}
              isPro={isMePro}
            />
          </View>

          <View style={styles.categoriesSection}>
            <View
              onLayout={(event) => setCategoriesViewportWidth(event.nativeEvent.layout.width)}
            >
              <ScrollView
                ref={categoriesScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoriesContent}
                onContentSizeChange={(contentWidth) => setCategoriesContentWidth(contentWidth)}
                onScroll={(event) => {
                  setCategoriesScrollX(event.nativeEvent.contentOffset.x);
                }}
                scrollEventThrottle={16}
                {...(Platform.OS === 'web' ? ({ onWheel: handleCategoriesWheel } as any) : {})}
              >
                {categories.map((item) => (
                  <CategoryPill
                    key={item.id}
                    name={item.name}
                    icon={item.icon || 'grid-outline'}
                    onPress={() => router.push({ pathname: '/search', params: { category: item.slug } })}
                    isPro={isMePro}
                  />
                ))}
              </ScrollView>
              {showCategoriesScrollbar ? (
                <View style={styles.scrollbarTrack}>
                  <View style={[styles.scrollbarThumb, { width: categoriesScrollbarThumbWidth, transform: [{ translateX: categoriesScrollbarOffset }] }]} />
                </View>
              ) : null}
            </View>
          </View>

          <FlatList
            horizontal
            data={banners}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            snapToInterval={bannerWidth + spacing.md}
            decelerationRate="fast"
            contentContainerStyle={styles.bannerCarouselContent}
            ItemSeparatorComponent={() => <View style={{ width: spacing.md }} />}
            onMomentumScrollEnd={(e) => {
              const i = Math.round(e.nativeEvent.contentOffset.x / (bannerWidth + spacing.md));
              setBannerIndex(Math.min(Math.max(i, 0), banners.length - 1));
            }}
            renderItem={({ item }) => (
              <View style={[styles.bannerContainer, { width: bannerWidth }]}>
                <Image
                  source={item.image}
                  style={styles.bannerImage}
                  contentFit="cover"
                />
                <View style={styles.bannerOverlay}>
                  <View style={styles.bannerBadge}>
                    <Text style={styles.bannerBadgeText}>{item.badge}</Text>
                  </View>
                  <Text style={styles.bannerTitle}>{item.title}</Text>
                  <Text style={styles.bannerPrice}>{item.subtitle}</Text>
                  <TouchableOpacity
                    style={styles.bannerBtn}
                    onPress={item.onPress}
                  >
                    <Text style={styles.bannerBtnText}>{item.cta}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
          <View style={styles.bannerDots}>
            {banners.map((b, i) => (
              <View key={b.id} style={[styles.bannerDot, i === bannerIndex && styles.bannerDotActive]} />
            ))}
          </View>

          <SectionHeader title="Recomendados" onPressAction={() => {}} actionLabel="Ver todo" />
          
          {isLoading ? (
            <View style={styles.loadingBox}><ActivityIndicator size="large" color={colors.primary} /></View>
          ) : listings.length > 0 ? (
            isPhone ? (
              <View style={styles.productsGrid}>
                {productBands.map((band, bandIndex) => {
                  const [topRow, bottomRow] = splitBandRows(band);
                  return (
                    <View key={`band-${bandIndex}`} style={styles.bandGroup}>
                      <GestureScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.bandContent}
                        style={styles.bandRow}
                      >
                        {topRow.map((item) => (
                          <ProductCard key={`feed-${item.id}`} product={item} numColumns={numColumns} width={cardWidth} />
                        ))}
                      </GestureScrollView>
                      <GestureScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.bandContent}
                        style={styles.bandRow}
                      >
                        {bottomRow.map((item) => (
                          <ProductCard key={`feed-${item.id}`} product={item} numColumns={numColumns} width={cardWidth} />
                        ))}
                      </GestureScrollView>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={[styles.productsGrid, { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }]}>
                {listings.map((item) => (
                  <ProductCard key={`feed-${item.id}`} product={item} numColumns={numColumns} />
                ))}
              </View>
            )
          ) : (
            <View style={styles.emptyBox}><Text style={styles.emptyText}>No se pudieron cargar anuncios reales.</Text></View>
          )}
          
          <View style={{ height: spacing.xl * 3 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.white, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  rootContainer: { flex: 1 },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    height: 60,
  },
  headerRightActions: {
    flexDirection: 'row',
    gap: 12,
  },
  logo: { fontSize: 26, fontWeight: '900', color: colors.primary, letterSpacing: -1.5 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  iconCirclePro: { borderColor: '#F59E0B', borderWidth: 1.5 },
  notificationDot: { 
    position: 'absolute', 
    top: -4, 
    right: -4, 
    minWidth: 18, 
    height: 18, 
    borderRadius: 9, 
    backgroundColor: colors.error, 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  notificationCountText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
  },
  titleSection: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xs },
  mainTitle: { fontSize: 32, fontWeight: '800', color: colors.text, lineHeight: 38 },
  searchContainer: { backgroundColor: colors.white, zIndex: 10, paddingBottom: 4 },
  categoriesSection: { marginVertical: spacing.md },
  categoriesContent: { paddingLeft: spacing.md, paddingBottom: spacing.sm },
  scrollbarTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    marginHorizontal: spacing.md,
    marginTop: 2,
    overflow: 'hidden',
  },
  scrollbarThumb: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: 'rgba(17, 24, 39, 0.35)',
  },
  bannerCarouselContent: { paddingHorizontal: spacing.md },
  bannerContainer: { height: 200, borderRadius: 24, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
  bannerDots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: spacing.md, marginBottom: spacing.lg },
  bannerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  bannerDotActive: { width: 18, backgroundColor: colors.primary },
  bannerImage: { width: '100%', height: '100%' },
  bannerOverlay: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.2)', padding: spacing.lg, justifyContent: 'center' },
  bannerBadge: { backgroundColor: colors.accent, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start', marginBottom: spacing.xs },
  bannerBadgeText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  bannerTitle: { color: colors.white, fontSize: 28, fontWeight: '800' },
  bannerPrice: { color: 'rgba(255,255,255,0.9)', fontSize: 18, marginBottom: spacing.md },
  bannerBtn: { backgroundColor: colors.white, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 12, alignSelf: 'flex-start' },
  bannerBtnText: { color: colors.black, fontWeight: '700', fontSize: 14 },
  productsGrid: { paddingHorizontal: spacing.sm },
  bandGroup: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  bandRow: {
    // Cada fila es su propio ScrollView independiente: mover una no afecta a la otra.
  },
  bandContent: {
    gap: spacing.sm,
  },
  productRow: { justifyContent: 'flex-start', gap: spacing.md },
  loadingBox: { paddingVertical: spacing.xl },
  emptyBox: { marginHorizontal: spacing.md, padding: spacing.lg, borderRadius: 18, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#F3F4F6' },
  emptyText: { color: colors.textLight, textAlign: 'center', fontWeight: '600' },
  horizontalListContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  horizontalScrollsContainer: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  categorySectionsContainer: {
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  categorySection: {
    gap: spacing.xs,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
});
