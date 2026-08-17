import React, { useState } from 'react';
import { Alert, View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Heart, MapPin } from 'lucide-react-native';
import { colors, spacing } from '../theme/colors';
import { Product } from '../data/mockData';
import { useRouter } from 'expo-router';
import { setListingFavorite, type ListingSummary } from '../../lib/igualo-api';

const MAX_WIDTH = 1200;

interface ProductCardProps {
  product: Product | ListingSummary;
  numColumns: number;
  onPress?: () => void;
  width?: number;
}

function isListingSummary(product: Product | ListingSummary): product is ListingSummary {
  return typeof product.id === 'number';
}

function formatPrice(value: Product['price'] | ListingSummary['price'], currency?: string) {
  const numeric = typeof value === 'string' ? Number(value) : value;
  const prefix = currency === 'USD' ? '$' : 'C$';
  if (Number.isNaN(numeric)) return `${prefix} ${value}`;
  return `${prefix} ${new Intl.NumberFormat('es-NI', { maximumFractionDigits: 0 }).format(numeric)}`;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, numColumns, onPress, width }) => {
  const [isLiked, setIsLiked] = useState(isListingSummary(product) ? Boolean(product.is_favorite) : false);
  const { width: windowWidth } = useWindowDimensions();
  const router = useRouter();
  const listing = isListingSummary(product) ? product : null;
  const mockProduct = !isListingSummary(product) ? product : null;
  const image = listing?.main_image || mockProduct?.image || null;
  const title = product.title;
  const location = listing?.city || listing?.location || mockProduct?.location || 'Nicaragua';
  const category = listing?.category?.name || mockProduct?.category || 'Anuncio';
  const isNew = Boolean(mockProduct?.isNew);
  const isPromoted = Boolean(listing?.is_promoted || mockProduct?.isFeatured);
  
  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/listing/${product.id}`);
    }
  };

  const handleFavoritePress = async () => {
    if (!listing) {
      setIsLiked(!isLiked);
      return;
    }

    const nextValue = !isLiked;
    setIsLiked(nextValue);
    try {
      const response = await setListingFavorite(listing.id, nextValue);
      setIsLiked(response.is_favorite);
    } catch {
      setIsLiked(!nextValue);
      Alert.alert('No se pudo actualizar', 'Inicia sesión o inténtalo de nuevo.');
    }
  };

  // Calculate dynamic width
  // Calculate dynamic width with smaller gaps (spacing.sm) for wider cards
  const contentWidth = Math.min(windowWidth, MAX_WIDTH);
  const cardWidth = width || (contentWidth - spacing.sm * (numColumns + 1)) / numColumns;
  
  // Responsive image height
  const isDesktop = windowWidth >= 1024;
  const imageHeight = isDesktop ? 200 : 180;

  return (
    <TouchableOpacity 
      style={[
        styles.container, 
        { width: cardWidth },
        isPromoted && styles.promotedContainer
      ]} 
      activeOpacity={0.9} 
      onPress={handlePress}
    >
      <View style={[styles.imageContainer, { height: imageHeight }]}>
        <Image
          source={{ uri: image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=60' }}
          style={styles.image}
          contentFit="cover"
          transition={400}
        />
        {isNew && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>Nuevo</Text>
          </View>
        )}
        {isPromoted && (
          <View style={styles.promotedBadge}>
            <Text style={styles.promotedBadgeText}>★ PRO</Text>
          </View>
        )}
        <TouchableOpacity 
          style={styles.favoriteBtn} 
          onPress={handleFavoritePress}
        >
          <Heart 
            size={20} 
            color={isLiked ? "#FF2D55" : colors.text} 
            strokeWidth={2.2} 
            fill={isLiked ? "#FF2D55" : "none"} 
          />
        </TouchableOpacity>
      </View>
      
      <View style={styles.content}>
        {isListingSummary(product) && product.is_negotiable ? (
          <Text style={styles.negotiableText}>🤝 Precio Negociable</Text>
        ) : (
          <Text style={styles.price}>{formatPrice(product.price, listing?.currency)}</Text>
        )}
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        
        <View style={styles.divider} />
        
        <View style={styles.footer}>
          <View style={styles.locationWrapper}>
            <MapPin size={12} color={colors.primary} strokeWidth={2.4} />
            <Text style={styles.location} numberOfLines={1}>{location}</Text>
          </View>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{category}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  promotedContainer: {
    borderColor: '#F59E0B',
    borderWidth: 2,
  },
  imageContainer: {
    position: 'relative',
    backgroundColor: '#F9FAFB',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  newBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 8,
    zIndex: 1,
  },
  newBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
  },
  promotedBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: '#1F2937',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    zIndex: 1,
  },
  promotedBadgeText: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  negotiableText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  favoriteBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 15,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 1,
  },
  content: {
    padding: 14,
  },
  price: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    minHeight: 40,
    marginBottom: 8,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  location: {
    fontSize: 11,
    color: colors.textLight,
    marginLeft: 4,
    fontWeight: '700',
  },
  categoryBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
