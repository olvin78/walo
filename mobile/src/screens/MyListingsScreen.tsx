import React, { useCallback, useEffect, useState } from 'react';
import { 
  ActivityIndicator,
  Alert,
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  FlatList, 
  TouchableOpacity, 
  StatusBar,
  Platform
} from 'react-native';
import { Image } from 'expo-image';
import { Pencil, Eye, Trash2, Lock, ArrowLeft, Package } from 'lucide-react-native';
import { colors, spacing } from '../theme/colors';
import { useRouter } from 'expo-router';
import { deleteListing, getMeListings, type ListingSummary } from '../services/api';
import { useAuth } from '../services/auth';
import { ProFooter } from '../components/ProFooter';

export const MyListingsScreen = () => {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const isMePro = Boolean(user?.profile?.is_pro);
  const [myListings, setMyListings] = useState<ListingSummary[]>([]);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const loadListings = useCallback(async (isInitial = true) => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    if (isInitial) {
      setIsLoading(true);
    } else {
      if (!nextUrl || isLoadingMore) return;
      setIsLoadingMore(true);
    }

    try {
      const response = await getMeListings(isInitial ? undefined : nextUrl || undefined);
      if (isInitial) {
        setMyListings(response.results);
      } else {
        setMyListings(prev => [...prev, ...response.results]);
      }
      setNextUrl(response.next);
    } catch (error) {
      console.error('Error loading my listings:', error);
    } finally {
      setIsLoading(isInitial ? false : isLoading);
      setIsLoadingMore(false);
    }
  }, [isAuthenticated, nextUrl, isLoadingMore]);

  useEffect(() => {
    if (!isAuthLoading) loadListings(true);
  }, [isAuthLoading]);

  const handleDelete = (listingId: number, title: string) => {
    Alert.alert(
      'Eliminar anuncio', 
      `Vas a eliminar "${title}". Esta acción lo quitará de la plataforma y borrará sus imágenes asociadas. No se puede deshacer.`, 
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, eliminar',
          style: 'destructive',
          onPress: async () => {
            const previous = myListings;
            // Optimistic update
            setMyListings((current) => current.filter((item) => item.id !== listingId));
            
            try {
              await deleteListing(listingId);
            } catch (error) {
              setMyListings(previous);
              Alert.alert('No se pudo eliminar', 'Hubo un problema al eliminar el anuncio. Inténtalo de nuevo.');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: ListingSummary }) => (
    <View style={[styles.listingCard, isMePro && styles.listingCardPro]}>
      <Image 
        source={{ uri: item.main_image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800' }} 
        style={styles.listingImage} 
      />
      <View style={styles.listingInfo}>
        <View style={styles.listingHeader}>
          <Text style={styles.price}>{item.currency === 'USD' ? '$' : 'C$'} {item.price}</Text>
          <View style={[styles.statusBadge, { backgroundColor: item.is_active === false ? '#FEF2F2' : '#ECFDF5' }]}>
            <Text style={[styles.statusText, { color: item.is_active === false ? '#EF4444' : '#10B981' }]}>
              {item.is_active === false ? 'INACTIVO' : 'ACTIVO'}
            </Text>
          </View>
        </View>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.metadata}>{item.city || item.location || 'Nicaragua'} • {item.category?.name || 'Anuncio'}</Text>
        
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push(`/listing/${item.id}/edit`)}>
            <Pencil size={16} color={colors.text} strokeWidth={2} />
            <Text style={styles.actionBtnText}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push(`/listing/${item.id}`)}>
            <Eye size={16} color={colors.text} strokeWidth={2} />
            <Text style={styles.actionBtnText}>Ver</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionBtn, styles.deleteBtn]} 
            onPress={() => handleDelete(item.id, item.title)}
            activeOpacity={0.6}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <Trash2 size={18} color="#fff" strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (isAuthLoading || (isLoading && myListings.length === 0)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Lock size={64} color="#E5E7EB" strokeWidth={1.6} />
          <Text style={styles.emptyText}>Inicia sesión para ver tus publicaciones.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color={colors.text} strokeWidth={2.4} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis publicaciones</Text>
        <View style={{ width: 44 }} />
      </View>

      <FlatList
        data={myListings}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        onRefresh={() => loadListings(true)}
        refreshing={isLoading}
        onEndReached={() => loadListings(false)}
        onEndReachedThreshold={0.5}
        ListFooterComponent={() => (
          <View>
            {isLoadingMore && <ActivityIndicator style={{ margin: 20 }} color={colors.primary} />}
            {isMePro && myListings.length > 0 && <ProFooter />}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Package size={64} color={colors.textLight} strokeWidth={1.6} />
            </View>
            <Text style={styles.emptyText}>No tienes publicaciones aún</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f9f9f9',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 20,
  },
  listingCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  listingCardPro: {
    borderColor: '#F59E0B',
    borderWidth: 2,
  },
  listingImage: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  listingInfo: {
    flex: 1,
    marginLeft: 15,
    justifyContent: 'center',
  },
  listingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  price: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  metadata: {
    fontSize: 12,
    color: colors.textLight,
    marginBottom: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginLeft: 4,
  },
  deleteBtn: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
    width: 44,
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 0,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textLight,
    textAlign: 'center',
  }
});
