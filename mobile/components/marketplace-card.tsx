import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ListingSummary } from '@/lib/igualo-api';

type Props = {
  listing: ListingSummary;
  compact?: boolean;
};

function formatPrice(value: ListingSummary['price']) {
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(numeric)) {
    return `C$ ${value}`;
  }

  return `C$ ${new Intl.NumberFormat('es-NI', { maximumFractionDigits: 0 }).format(numeric)}`;
}

export function MarketplaceCard({ listing, compact = false }: Props) {
  return (
    <Pressable style={({ pressed }) => [styles.card, compact && styles.cardCompact, pressed && styles.cardPressed]}>
      <View style={styles.imageWrap}>
        <Image
          source={listing.main_image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=60'}
          style={styles.image}
          contentFit="cover"
          transition={180}
        />
        {listing.is_promoted ? (
          <View style={styles.promotedPill}>
            <Text style={styles.promotedText}>Destacado</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text numberOfLines={2} style={styles.title}>
          {listing.title}
        </Text>
        <Text style={styles.price}>{formatPrice(listing.price)}</Text>
        <Text numberOfLines={1} style={styles.location}>
          📍 {listing.city || listing.location || 'Nicaragua'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 14,
  },
  cardCompact: {
    borderRadius: 18,
  },
  cardPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.95,
  },
  imageWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#0b1220',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  promotedPill: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(34,197,94,0.92)',
  },
  promotedText: {
    color: '#07130d',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  body: {
    padding: 12,
    gap: 5,
  },
  title: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    minHeight: 34,
  },
  price: {
    color: '#22c55e',
    fontSize: 15,
    fontWeight: '900',
  },
  location: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 11,
    lineHeight: 14,
  },
});
