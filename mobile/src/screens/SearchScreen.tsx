import React, { useEffect, useMemo, useRef, useState } from 'react';
import { 
  ActivityIndicator,
  Alert,
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  FlatList, 
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  Platform,
  StatusBar,
  RefreshControl
} from 'react-native';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import { XCircle, ArrowUpDown, MapPin, SlidersHorizontal } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, spacing, borderRadius } from '../theme/colors';
import { POPULAR_SEARCHES } from '../data/mockData';
import { SearchBar } from '../components/SearchBar';
import { CategoryPill } from '../components/CategoryPill';
import { ProductCard } from '../components/ProductCard';
import { getCategories, searchListings, type Category, type ListingSummary, type Subcategory } from '../../lib/igualo-api';
import { FilterModal, type FilterValues } from '../components/FilterModal';
import * as Location from 'expo-location';
import { useAuth } from '../services/auth';

const MAX_WIDTH = 1200;

export const SearchScreen = () => {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const isMePro = Boolean(currentUser?.profile?.is_pro);
  const params = useLocalSearchParams<{ q?: string; category?: string; subcategory?: string; openFilter?: string }>();
  const [query, setQuery] = useState(typeof params.q === 'string' ? params.q : '');
  const [activeCategory, setActiveCategory] = useState(typeof params.category === 'string' ? params.category : '');
  const [activeSubcategory, setActiveSubcategory] = useState(typeof params.subcategory === 'string' ? params.subcategory : '');
  const [categories, setCategories] = useState<Category[]>([]);
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [exactMatches, setExactMatches] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [categoriesScrollX, setCategoriesScrollX] = useState(0);
  const [categoriesViewportWidth, setCategoriesViewportWidth] = useState(0);
  const [categoriesContentWidth, setCategoriesContentWidth] = useState(0);
  const [filters, setFilters] = useState<FilterValues>({
    minPrice: '',
    maxPrice: '',
    location: 'Todo Nicaragua',
    sortBy: 'newest',
    radius: 20
  });
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyActive, setNearbyActive] = useState(false);
  const { width } = useWindowDimensions();

  // Responsive logic
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;
  
  const isPhone = !isDesktop && !isTablet;

  const numColumns = useMemo(() => {
    if (isDesktop) return 4;
    if (isTablet) return 3;
    return 2;
  }, [isDesktop, isTablet]);

  const cardWidth = useMemo(() => {
    const contentWidth = Math.min(width, MAX_WIDTH);
    return (contentWidth - spacing.sm * (numColumns + 1)) / numColumns;
  }, [width, numColumns]);

  // En móvil, cada banda de resultados muestra 2 filas fijas y se desliza hacia
  // los lados para ver más columnas; el scroll vertical de la página (paginación
  // infinita) no cambia, solo se agrupan los items en bandas horizontales.
  const productBands = useMemo(() => {
    if (!isPhone) return [];
    const columnsPerBand = numColumns * 2;
    const bandSize = columnsPerBand * 2;
    const bands: ListingSummary[][] = [];
    for (let i = 0; i < listings.length; i += bandSize) {
      bands.push(listings.slice(i, i + bandSize));
    }
    return bands;
  }, [listings, numColumns, isPhone]);

  const splitBandRows = (band: ListingSummary[]) => {
    const topRow: ListingSummary[] = [];
    const bottomRow: ListingSummary[] = [];
    band.forEach((item, i) => (i % 2 === 0 ? topRow : bottomRow).push(item));
    return [topRow, bottomRow] as const;
  };

  const categoriesScrollRef = useRef<ScrollView | null>(null);

  const activeCategoryObj = useMemo(() => {
    return categories.find((c) => c.slug === activeCategory) || null;
  }, [categories, activeCategory]);

  const activeCategorySubs = useMemo(() => {
    return activeCategoryObj?.subcategories || [];
  }, [activeCategoryObj]);

  useEffect(() => {
    setQuery(typeof params.q === 'string' ? params.q : '');
    setActiveCategory(typeof params.category === 'string' ? params.category : '');
    setActiveSubcategory(typeof params.subcategory === 'string' ? params.subcategory : '');
  }, [params.category, params.q, params.subcategory]);

  useEffect(() => {
    if (params.openFilter === 'true') {
      setIsFilterVisible(true);
      router.setParams({ openFilter: undefined });
    }
  }, [params.openFilter]);

  useEffect(() => {
    let isMounted = true;
    getCategories()
      .then((data) => {
        if (isMounted) setCategories(data);
      })
      .catch(() => {
        if (isMounted) setCategories([]);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const fetchResults = async (isInitial = true) => {
    if (!isInitial && (!nextUrl || isLoadingMore)) return;

    if (isInitial) {
      setIsLoading(true);
      setErrorMessage('');
    } else {
      setIsLoadingMore(true);
    }

    try {
      const data = await searchListings(
        isInitial ? { 
          q: query.trim(), 
          category: activeCategory || undefined,
          subcategory: activeSubcategory || undefined,
          min_price: filters.minPrice || undefined,
          max_price: filters.maxPrice || undefined,
          location: filters.location === 'Todo Nicaragua' ? undefined : filters.location,
          sort: filters.sortBy,
          radius: (nearbyActive && userCoords) ? String(filters.radius || 20) : undefined,
          user_lat: (nearbyActive && userCoords) ? String(userCoords.lat) : undefined,
          user_lng: (nearbyActive && userCoords) ? String(userCoords.lng) : undefined,
        } : undefined,
        isInitial ? undefined : nextUrl || undefined
      );
      
      if (isMountedRef.current) {
        setListings(prev => isInitial ? data.results : [...prev, ...data.results]);
        setNextUrl(data.next);
        setExactMatches(data.exact_matches !== false);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setErrorMessage('No se pudo conectar con el servidor.');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  };

  const isMountedRef = React.useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchResults(true);
    }, 400);
    return () => clearTimeout(timeout);
  }, [activeCategory, activeSubcategory, query, filters]);

  const applyCategory = (category: Category) => {
    const nextCategory = activeCategory === category.slug ? '' : category.slug;
    setActiveCategory(nextCategory);
    setActiveSubcategory('');
    router.setParams({ category: nextCategory || undefined, subcategory: undefined, q: query || undefined });
  };

  const applySubcategory = (sub: Subcategory) => {
    const nextSub = activeSubcategory === sub.slug ? '' : sub.slug;
    setActiveSubcategory(nextSub);
    router.setParams({ subcategory: nextSub || undefined, q: query || undefined, category: activeCategory || undefined });
  };

  const clearFilters = () => {
    setQuery('');
    setActiveCategory('');
    setActiveSubcategory('');
    setFilters({
      minPrice: '',
      maxPrice: '',
      location: 'Todo Nicaragua',
      sortBy: 'newest',
      radius: 20
    });
    router.setParams({ q: undefined, category: undefined, subcategory: undefined });
  };

  const useMyLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Habilita la ubicación para buscar cerca de ti.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setNearbyActive(true);
      setFilters((prev) => ({ ...prev, radius: 20 }));
      Alert.alert('Cerca de ti', 'Buscando en un radio de 20 km a la redonda.');
    } catch {
      Alert.alert('Error', 'No se pudo obtener tu ubicación.');
    }
  };

  const clearNearby = () => {
    setNearbyActive(false);
    setUserCoords(null);
  };

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

  const renderHeader = () => (
    <View>


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
                active={activeCategory === item.slug}
                onPress={() => applyCategory(item)}
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
        {(query || activeCategory) ? (
          <TouchableOpacity style={styles.clearFiltersBtn} onPress={clearFilters}>
            <XCircle size={16} color={colors.primary} strokeWidth={2.2} />
            <Text style={styles.clearFiltersText}>Limpiar filtros</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {activeCategoryObj && activeCategorySubs.length > 0 ? (
        <View style={styles.subcategoriesSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.subcategoriesContent}
          >
            <TouchableOpacity
              style={[styles.subcategoryChip, !activeSubcategory && styles.subcategoryChipActive, isMePro && !activeSubcategory && styles.subcategoryChipActivePro]}
              onPress={() => {
                setActiveSubcategory('');
                router.setParams({ subcategory: undefined, q: query || undefined, category: activeCategory || undefined });
              }}
            >
              <Text style={[styles.subcategoryChipText, !activeSubcategory && styles.subcategoryChipTextActive, isMePro && !activeSubcategory && styles.subcategoryChipTextActivePro]}>Ver Todo</Text>
            </TouchableOpacity>
            {activeCategorySubs.map((sub) => (
              <TouchableOpacity
                key={sub.id}
                style={[styles.subcategoryChip, activeSubcategory === sub.slug && styles.subcategoryChipActive, isMePro && activeSubcategory === sub.slug && styles.subcategoryChipActivePro]}
                onPress={() => applySubcategory(sub)}
              >
                {sub.icon ? <Text style={styles.subcategoryChipEmoji}>{sub.icon}</Text> : null}
                <Text style={[styles.subcategoryChipText, activeSubcategory === sub.slug && styles.subcategoryChipTextActive, isMePro && activeSubcategory === sub.slug && styles.subcategoryChipTextActivePro]}>{sub.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.resultsHeader}>
        <Text style={styles.resultsCount}>{listings.length} resultados encontrados</Text>
        <TouchableOpacity style={styles.sortBtn} onPress={() => setIsFilterVisible(true)}>
          <ArrowUpDown size={16} color={colors.primary} strokeWidth={2.2} />
          <Text style={styles.sortText}>Relevancia</Text>
        </TouchableOpacity>
      </View>

      {!exactMatches && listings.length > 0 ? (
        <Text style={styles.relatedText}>No encontramos coincidencias exactas, pero quizá te interese esto</Text>
      ) : null}
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      
      <View style={[styles.rootContainer, { maxWidth: MAX_WIDTH, alignSelf: 'center', width: '100%' }]}>
        <View style={styles.header}>
          <SearchBar
            value={query}
            onChangeText={(value) => {
              setQuery(value);
              router.setParams({ q: value || undefined, category: activeCategory || undefined });
            }}
            onClear={clearFilters}
            onFilterPress={() => setIsFilterVisible(true)}
            isPro={isMePro}
          />
          <View style={styles.nearbyRow}>
            <TouchableOpacity
              style={[styles.nearbyBtn, nearbyActive && styles.nearbyBtnActive]}
              onPress={nearbyActive ? clearNearby : useMyLocation}
            >
              <MapPin size={14} color={nearbyActive ? colors.white : colors.primary} strokeWidth={2.2} />
              <Text style={[styles.nearbyText, nearbyActive && styles.nearbyTextActive]}>
                {nearbyActive ? 'Cerca de ti (20 km) · Quitar' : 'Cerca de mí'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={() => fetchResults(true)} colors={[colors.primary]} />
          }
          onScroll={(e) => {
            const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
            const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 500;
            if (isCloseToBottom && !isLoadingMore && nextUrl) {
              fetchResults(false);
            }
          }}
          scrollEventThrottle={400}
        >
          {renderHeader()}

          {listings.length > 0 ? (
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
                          <ProductCard key={`search-${item.id}`} product={item} numColumns={numColumns} width={cardWidth} />
                        ))}
                      </GestureScrollView>
                      <GestureScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.bandContent}
                        style={styles.bandRow}
                      >
                        {bottomRow.map((item) => (
                          <ProductCard key={`search-${item.id}`} product={item} numColumns={numColumns} width={cardWidth} />
                        ))}
                      </GestureScrollView>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={[styles.productsGrid, { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }]}>
                {listings.map((item) => (
                  <ProductCard key={`search-${item.id}`} product={item} numColumns={numColumns} />
                ))}
              </View>
            )
          ) : !isLoading ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>{errorMessage || 'No encontramos anuncios con esos filtros.'}</Text>
            </View>
          ) : null}

          <View style={{ paddingVertical: 20 }}>
            {isLoadingMore && <ActivityIndicator size="small" color={colors.primary} />}
            <View style={{ height: 100 }} />
          </View>
        </ScrollView>

        <FilterModal
          visible={isFilterVisible}
          onClose={() => setIsFilterVisible(false)}
          initialFilters={filters}
          onApply={(newFilters) => {
            // Al cambiar los filtros, el useEffect se encarga de recargar los resultados
            setFilters(newFilters);
          }}
          isPro={isMePro}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white, // Uniform light background
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  rootContainer: {
    flex: 1,
  },
  productsGrid: {
    paddingHorizontal: spacing.sm,
  },
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
  header: {
    paddingBottom: spacing.xs,
    backgroundColor: colors.white,
  },
  section: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: borderRadius.full,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  chipText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  categoriesSection: {
    marginTop: spacing.md,
  },
  categoriesContent: {
    paddingLeft: spacing.md,
    paddingBottom: spacing.sm,
  },
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
  clearFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginLeft: spacing.md,
    marginTop: spacing.xs,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  clearFiltersText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  filtersContainer: {
    marginTop: spacing.md,
    paddingLeft: spacing.md,
  },
  filterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterText: {
    fontSize: 13,
    color: colors.text,
    marginRight: 4,
    fontWeight: '500',
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  resultsCount: {
    fontSize: 14,
    color: colors.textLight,
    fontWeight: '500',
  },
  relatedText: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 16,
    backgroundColor: '#F0FDF4',
    color: '#047857',
    fontWeight: '800',
  },
  errorText: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    color: colors.error,
    fontWeight: '800',
    textAlign: 'center',
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sortText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: 4,
  },
  grid: {
    fontWeight: '600',
    marginLeft: 4,
  },
  productsContainer: {
    paddingHorizontal: spacing.md,
  },
  productRow: {
    justifyContent: 'flex-start',
    gap: spacing.md,
  },
  loadingBox: {
    paddingVertical: spacing.xl,
  },
  emptyBox: {
    marginHorizontal: spacing.md,
    padding: spacing.lg,
    borderRadius: 18,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginTop: 20,
  },
  emptyText: {
    color: colors.textLight,
    textAlign: 'center',
    fontWeight: '600',
  },
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
  subcategoriesSection: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  subcategoriesContent: {
    gap: spacing.sm,
    alignItems: 'center',
  },
  subcategoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  subcategoryChipActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: colors.primary,
  },
  subcategoryChipActivePro: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: '#F59E0B',
  },
  subcategoryChipText: {
    fontSize: 13,
    color: colors.textLight,
    fontWeight: '700',
  },
  subcategoryChipTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  subcategoryChipTextActivePro: {
    color: '#92400E',
  },
  subcategoryChipEmoji: {
    marginRight: 6,
    fontSize: 14,
  },
  nearbyRow: {
    paddingHorizontal: spacing.md,
    marginTop: 8,
  },
  nearbyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  nearbyBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  nearbyText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 6,
  },
  nearbyTextActive: {
    color: colors.white,
  },
});
