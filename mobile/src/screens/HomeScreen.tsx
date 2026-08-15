import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  useWindowDimensions
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing } from '../theme/colors';
import { SearchBar } from '../components/SearchBar';
import { CategoryPill } from '../components/CategoryPill';
import { ProductCard } from '../components/ProductCard';
import { SectionHeader } from '../components/SectionHeader';
import { useAuth } from '../services/auth';
import { getCategories, getHome, getUnreadNotificationsCount, type Category, type ListingSummary } from '../../lib/igualo-api';
import { CATEGORIES, PRODUCTS } from '../data/mockData';

const MAX_WIDTH = 1200;

export const HomeScreen = () => {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [listings, setListings] = useState<(ListingSummary | (typeof PRODUCTS)[number])[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [categoriesScrollX, setCategoriesScrollX] = useState(0);
  const [categoriesViewportWidth, setCategoriesViewportWidth] = useState(0);
  const [categoriesContentWidth, setCategoriesContentWidth] = useState(0);
  
  // Calculate responsive values
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;
  
  const numColumns = useMemo(() => {
    if (isDesktop) return 4;
    if (isTablet) return 3;
    return 2;
  }, [isDesktop, isTablet]);

  const categoriesScrollRef = useRef<ScrollView | null>(null);

  const getCategoryName = (item: any): string => {
    if (item?.category && typeof item.category === 'object') {
      return item.category.name || 'Otros';
    }
    return item?.category || 'Otros';
  };

  const listingsByCategory = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    listings.forEach(item => {
      const catName = getCategoryName(item);
      if (!groups[catName]) {
        groups[catName] = [];
      }
      groups[catName].push(item);
    });
    return groups;
  }, [listings]);

  useEffect(() => {
    let isMounted = true;
    Promise.all([getHome(), getCategories()])
      .then(([data, allCategories]) => {
        if (!isMounted) return;
        setCategories(allCategories);
        const combined = [...(data.recommended || []), ...(data.featured || []), ...(data.latest || [])];
        const unique = combined.filter((item, index, self) =>
          self.findIndex(t => t.id === item.id) === index
        );
        setListings(unique);
        setUsingFallback(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setCategories(CATEGORIES.map((item) => ({ id: Number(item.id), name: item.name, slug: item.name.toLowerCase(), icon: item.icon })));
        setListings(PRODUCTS);
        setUsingFallback(true);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const fetchCount = async () => {
      if (!isAuthenticated) {
        setUnreadCount(0);
        return;
      }

      try {
        const data = await getUnreadNotificationsCount();
        setUnreadCount(data.unread_count);
      } catch (e) {
        // Silently fail for notification count
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      
      <View style={[styles.rootContainer, { maxWidth: MAX_WIDTH, alignSelf: 'center', width: '100%' }]}>
        
        <View style={styles.topHeader}>
          <Text style={styles.logo}>IGUALO</Text>
          
          <View style={styles.headerRightActions}>
            <TouchableOpacity style={styles.iconCircle} onPress={() => router.push('/messages')}>
              <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.text} />
              <View style={styles.notificationDot} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconCircle} onPress={() => router.push('/notifications')}>
              <Ionicons name="notifications-outline" size={22} color={colors.text} />
              {unreadCount > 0 && (
                <View style={styles.notificationDot}>
                  <Text style={styles.notificationCountText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[1]}>
          <View style={styles.titleSection}>
            <Text style={styles.mainTitle}>Compra y vende{"\n"}cerca de ti</Text>
          </View>

          <View style={styles.searchContainer}>
            <SearchBar 
              editable={false} 
              onPress={() => router.push('/search')} 
              onFilterPress={() => router.push({ pathname: '/search', params: { openFilter: 'true' } })}
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

          <View style={styles.bannerContainer}>
            <Image
              source={require('../../assets/images/banner_promo.png')}
              style={styles.bannerImage}
              contentFit="cover"
            />
            <View style={styles.bannerOverlay}>
              <View style={styles.bannerBadge}>
                <Text style={styles.bannerBadgeText}>NUEVO</Text>
              </View>
              <Text style={styles.bannerTitle}>Encuentra lo que{"\n"}buscas</Text>
              <Text style={styles.bannerPrice}>Seguir navegando</Text>
              <TouchableOpacity 
                style={styles.bannerBtn}
                onPress={() => router.push('/search')}
              >
                <Text style={styles.bannerBtnText}>Empezar a buscar</Text>
              </TouchableOpacity>
            </View>
          </View>

          <SectionHeader title={usingFallback ? 'Recomendados (modo desarrollo)' : 'Recomendados'} onPressAction={() => {}} actionLabel="Ver todo" />
          
          {isLoading ? (
            <View style={styles.loadingBox}><ActivityIndicator size="large" color={colors.primary} /></View>
          ) : listings.length > 0 ? (
            <View style={styles.categorySectionsContainer}>
              {Object.keys(listingsByCategory).map((catName) => (
                <View key={catName} style={styles.categorySection}>
                  <Text style={styles.categoryTitle}>{catName}</Text>
                  <FlatList
                    horizontal
                    data={listingsByCategory[catName]}
                    renderItem={({ item }) => <ProductCard product={item} numColumns={numColumns} width={180} />}
                    keyExtractor={(item) => `cat-${catName}-${item.id}`}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.horizontalListContent}
                    ItemSeparatorComponent={() => <View style={{ width: spacing.md }} />}
                  />
                </View>
              ))}
            </View>
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
  bannerContainer: { height: 200, marginHorizontal: spacing.md, borderRadius: 24, overflow: 'hidden', marginBottom: spacing.lg, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
  bannerImage: { width: '100%', height: '100%' },
  bannerOverlay: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.2)', padding: spacing.lg, justifyContent: 'center' },
  bannerBadge: { backgroundColor: colors.accent, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start', marginBottom: spacing.xs },
  bannerBadgeText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  bannerTitle: { color: colors.white, fontSize: 28, fontWeight: '800' },
  bannerPrice: { color: 'rgba(255,255,255,0.9)', fontSize: 18, marginBottom: spacing.md },
  bannerBtn: { backgroundColor: colors.white, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 12, alignSelf: 'flex-start' },
  bannerBtnText: { color: colors.black, fontWeight: '700', fontSize: 14 },
  productsGrid: { paddingHorizontal: spacing.md },
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
