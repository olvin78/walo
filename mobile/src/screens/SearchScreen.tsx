import React, { useEffect, useMemo, useRef, useState } from 'react';
import { 
  ActivityIndicator,
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
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, spacing, borderRadius } from '../theme/colors';
import { POPULAR_SEARCHES } from '../data/mockData';
import { SearchBar } from '../components/SearchBar';
import { CategoryPill } from '../components/CategoryPill';
import { ProductCard } from '../components/ProductCard';
import { getCategories, searchListings, type Category, type ListingSummary } from '../../lib/igualo-api';
import { FilterModal, type FilterValues } from '../components/FilterModal';

const MAX_WIDTH = 1200;

export const SearchScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; category?: string; openFilter?: string }>();
  const [query, setQuery] = useState(typeof params.q === 'string' ? params.q : '');
  const [activeCategory, setActiveCategory] = useState(typeof params.category === 'string' ? params.category : '');
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
  const { width } = useWindowDimensions();

  // Responsive logic
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
    setQuery(typeof params.q === 'string' ? params.q : '');
    setActiveCategory(typeof params.category === 'string' ? params.category : '');
  }, [params.category, params.q]);

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
          min_price: filters.minPrice || undefined,
          max_price: filters.maxPrice || undefined,
          location: filters.location === 'Todo Nicaragua' ? undefined : filters.location,
          sort: filters.sortBy
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
  }, [activeCategory, query, filters]);

  const applyCategory = (category: Category) => {
    const nextCategory = activeCategory === category.slug ? '' : category.slug;
    setActiveCategory(nextCategory);
    router.setParams({ category: nextCategory || undefined, q: query || undefined });
  };

  const clearFilters = () => {
    setQuery('');
    setActiveCategory('');
    setFilters({
      minPrice: '',
      maxPrice: '',
      location: 'Todo Nicaragua',
      sortBy: 'newest',
      radius: 20
    });
    router.setParams({ q: undefined, category: undefined });
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
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Búsquedas populares</Text>
        <View style={styles.chipsContainer}>
          {POPULAR_SEARCHES.map((item) => (
            <TouchableOpacity 
              key={item} 
              style={styles.chip} 
              onPress={() => {
                setQuery(item);
                router.setParams({ q: item });
              }}
            >
              <Text style={styles.chipText}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>
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
                active={activeCategory === item.slug}
                onPress={() => applyCategory(item)}
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
            <Ionicons name="close-circle-outline" size={16} color={colors.primary} />
            <Text style={styles.clearFiltersText}>Limpiar filtros</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.resultsHeader}>
        <Text style={styles.resultsCount}>{listings.length} resultados encontrados</Text>
        <TouchableOpacity style={styles.sortBtn}>
          <Ionicons name="swap-vertical-outline" size={16} color={colors.primary} />
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
          />
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={() => fetchResults(true)} colors={[colors.primary]} />
          }
        >
          {renderHeader()}

          {listings.length > 0 ? (
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
                    onEndReached={() => fetchResults(false)}
                    onEndReachedThreshold={0.5}
                  />
                </View>
              ))}
            </View>
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
            setFilters(newFilters);
            // fetchResults(true) will be triggered by useEffect
          }}
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
});
