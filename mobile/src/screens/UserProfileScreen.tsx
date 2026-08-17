import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Platform,
  RefreshControl,
  Share as RNShare,
} from 'react-native';
import { Image } from 'expo-image';
import { ArrowLeft, Share2, BadgeCheck, Star, MessageSquare, UserPlus, Check } from 'lucide-react-native';
import { colors, spacing } from '../theme/colors';
import { useRouter } from 'expo-router';
import { ProductCard } from '../components/ProductCard';
import { getUserProfile, submitProfileReview, type ProfileReview, type UserProfileResponse } from '../../lib/igualo-api';
import { WEB_BASE_URL } from '../services/api';

type UserProfileScreenProps = {
  username?: string;
};

const fallbackUser = {
  id: 0,
  username: '',
  display_name: 'Perfil no disponible',
  date_joined: new Date().toISOString(),
  profile: {
    avatar: null,
    cover_image: null,
    is_verified: false,
    location: 'Nicaragua',
  },
  stats: {
    followers_count: 0,
    listings_count: 0,
    average_rating: 5,
    reviews_count: 0,
    user_rating: 0,
    user_comment: '',
    can_review: true,
  },
  reviews: [],
  listings: [],
} satisfies UserProfileResponse;

export const UserProfileScreen = ({ username = 'juan' }: UserProfileScreenProps) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('anuncios');
  const [profile, setProfile] = useState<UserProfileResponse>(fallbackUser);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedRating, setSelectedRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  const isTargetPro = Boolean(profile.profile.is_pro);
  const joinedYear = new Date(profile.date_joined).getFullYear();

  const handleShareProfile = async () => {
    const url = `${WEB_BASE_URL}/perfil/${profile.username}/`;
    const lines = [
      `👤 ${profile.display_name} en Igualo`,
      `📦 ${profile.stats.listings_count} anuncios · ⭐ ${profile.stats.average_rating} (${profile.stats.reviews_count} opiniones)`,
      profile.profile.location ? `📍 ${profile.profile.location}` : '',
      '',
      `👉 Entra para ver su perfil y sus anuncios:`,
      url,
    ].filter((line) => line !== '');
    const options: any = {
      title: `${profile.display_name} en Igualo`,
      message: lines.join('\n'),
    };
    // En iOS se adjunta la foto del perfil como tarjeta en el compartir
    if (Platform.OS === 'ios' && profile.profile.avatar) {
      options.url = profile.profile.avatar;
    }
    try {
      await RNShare.share(options);
    } catch {}
  };

  const loadProfile = useCallback(async () => {
    const data = await getUserProfile(username);
    setProfile(data);
    setSelectedRating(data.stats.user_rating || 5);
    setReviewText(data.stats.user_comment || '');
  }, [username]);

  useEffect(() => {
    let isMounted = true;
    if (!username) {
      setProfile(fallbackUser);
      setIsLoading(false);
      return () => {
        isMounted = false;
      };
    }
    setIsLoading(true);
    loadProfile()
      .catch(() => {
        if (isMounted) setProfile(fallbackUser);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [username, loadProfile]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadProfile();
    } catch {
      // no-op, keep previous data on failure
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSubmitReview = async () => {
    const comment = reviewText.trim();
    if (!comment) {
      Alert.alert('Escribe una reseña', 'Añade una opinión para acompañar tu valoración.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitProfileReview(profile.username, selectedRating, comment);
      setProfile((current) => {
        const reviews = current.reviews.filter((review) => review.id !== result.review.id);
        return {
          ...current,
          stats: {
            ...current.stats,
            average_rating: result.average_rating,
            reviews_count: result.reviews_count,
            user_rating: result.review.rating,
            user_comment: result.review.comment,
          },
          reviews: [result.review, ...reviews],
        };
      });
      setActiveTab('opiniones');
      Alert.alert('Opinión guardada', 'Tu valoración se ha publicado en este perfil.');
    } catch {
      Alert.alert('No se pudo guardar', 'Inicia sesión para valorar este perfil o inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStars = (rating: number, interactive = false) => (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          disabled={!interactive}
          onPress={() => setSelectedRating(star)}
          activeOpacity={0.8}
        >
          <Star
            size={interactive ? 30 : 15}
            color="#F59E0B"
            strokeWidth={2}
            fill={star <= rating ? "#F59E0B" : "none"}
          />
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[colors.primary]} tintColor={colors.primary} />
        }
      >
        {/* Cover & Avatar Header */}
        <View style={styles.headerContainer}>
          <Image 
            key={`cover-${profile.profile.cover_image}`}
            source={{ uri: profile.profile.cover_image 
              ? `${profile.profile.cover_image}?t=${new Date().getMinutes()}${new Date().getSeconds()}` 
              : 'https://images.unsplash.com/photo-1557683316-973673baf926?w=800' }} 
            style={styles.coverImage} 
          />
          <View style={styles.overlay} />
          
          <SafeAreaView style={styles.topActions}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <ArrowLeft size={24} color={colors.white} strokeWidth={2.4} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShareProfile}>
              <Share2 size={24} color={colors.white} strokeWidth={2.2} />
            </TouchableOpacity>
          </SafeAreaView>

          <View style={styles.profileBadge}>
            <Image 
              key={`avatar-${profile.profile.avatar}`}
              source={{ uri: profile.profile.avatar 
                ? `${profile.profile.avatar}?t=${new Date().getMinutes()}${new Date().getSeconds()}` 
                : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400' }} 
              style={styles.avatar} 
            />
            {profile.profile.is_verified && (
              <View style={styles.verifiedBadge}>
                <BadgeCheck size={18} color={colors.primary} strokeWidth={2.2} />
              </View>
            )}
          </View>
        </View>

        {/* User Identity Section */}
        <View style={styles.userSection}>
          <Text style={styles.userName}>{profile.display_name}</Text>
          <Text style={styles.userDate}>Miembro desde {joinedYear}</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.stats.followers_count}</Text>
              <Text style={styles.statLabel}>Seguidores</Text>
            </View>
            <View style={styles.vSeparator} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.stats.listings_count}</Text>
              <Text style={styles.statLabel}>Anuncios</Text>
            </View>
            <View style={styles.vSeparator} />
            <View style={styles.statItem}>
              <View style={styles.ratingRow}>
                <Star size={16} color="#F59E0B" strokeWidth={2.2} fill="#F59E0B" />
                <Text style={styles.statValue}> {profile.stats.average_rating}</Text>
              </View>
              <Text style={styles.statLabel}>{profile.stats.reviews_count} opiniones</Text>
            </View>
          </View>

          <TouchableOpacity 
            style={[
              styles.followBtnBase, 
              isTargetPro ? styles.followBtnPro : styles.followBtnStandard,
              isFollowing && (isTargetPro ? styles.followingBtnPro : styles.followingBtnStandard)
            ]}
            onPress={() => setIsFollowing(!isFollowing)}
            activeOpacity={0.8}
          >
            {isFollowing ? (
              <>
                <Check size={18} color={isTargetPro ? '#B8860B' : colors.primary} strokeWidth={2.5} />
                <Text style={[styles.followingBtnTextBase, isTargetPro ? styles.followingTextPro : styles.followingTextStandard]}>Siguiendo</Text>
              </>
            ) : (
              <>
                <UserPlus size={18} color={isTargetPro ? '#000000' : colors.white} strokeWidth={2.5} />
                <Text style={[styles.followBtnTextBase, isTargetPro ? styles.followTextPro : styles.followTextStandard]}>Seguir perfil</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Tabs Section */}
        <View style={styles.tabsContainer}>
          <View style={styles.pillContainer}>
            <TouchableOpacity 
              style={[styles.pillTab, activeTab === 'anuncios' && styles.pillActive]}
              onPress={() => setActiveTab('anuncios')}
              activeOpacity={1}
            >
              <Text style={[styles.pillText, activeTab === 'anuncios' && styles.pillTextActive]}>
                Anuncios ({profile.stats.listings_count})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.pillTab, activeTab === 'opiniones' && styles.pillActive]}
              onPress={() => setActiveTab('opiniones')}
              activeOpacity={1}
            >
              <Text style={[styles.pillText, activeTab === 'opiniones' && styles.pillTextActive]}>
                Opiniones ({profile.stats.reviews_count})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Content Area */}
        <View style={styles.contentArea}>
          {activeTab === 'anuncios' ? (
            <View style={styles.productsGrid}>
              {profile.listings.map((product) => (
                <ProductCard 
                  key={product.id} 
                  product={product} 
                  numColumns={2} 
                />
              ))}
            </View>
          ) : (
            <View>
              <View style={styles.reviewComposer}>
                <View style={styles.reviewComposerHeader}>
                  <View>
                    <Text style={styles.reviewTitle}>Valora este perfil</Text>
                    <Text style={styles.reviewSubtitle}>Deja estrellas y una reseña pública.</Text>
                  </View>
                  {isLoading && <ActivityIndicator size="small" color={colors.primary} />}
                </View>
                {renderStars(selectedRating, true)}
                <TextInput
                  style={styles.reviewInput}
                  placeholder="Cuenta cómo fue tu experiencia con este usuario..."
                  placeholderTextColor={colors.textLight}
                  value={reviewText}
                  onChangeText={setReviewText}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.submitReviewBtn, isSubmitting && styles.disabledBtn]}
                  onPress={handleSubmitReview}
                  disabled={isSubmitting}
                >
                  <Text style={styles.submitReviewText}>{isSubmitting ? 'Guardando...' : 'Publicar opinión'}</Text>
                </TouchableOpacity>
              </View>

              {profile.reviews.length > 0 ? (
                profile.reviews.map((review: ProfileReview) => (
                  <View key={review.id} style={styles.reviewCard}>
                    <View style={styles.reviewCardHeader}>
                      <Text style={styles.reviewerName}>{review.reviewer}</Text>
                      {renderStars(review.rating)}
                    </View>
                    <Text style={styles.reviewComment}>{review.comment || 'Sin comentario escrito.'}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.emptyOpiniones}>
                  <MessageSquare size={60} color="#E5E7EB" strokeWidth={1.6} />
                  <Text style={styles.emptyText}>Aún no hay opiniones de otros usuarios.</Text>
                </View>
              )}
            </View>
          )}
        </View>
        
        <View style={{ height: 50 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  headerContainer: {
    height: 220,
    backgroundColor: '#333',
    position: 'relative',
    alignItems: 'center',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    opacity: 0.8,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  topActions: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 24) + 12,
    left: 15,
    right: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileBadge: {
    position: 'absolute',
    bottom: -45,
    backgroundColor: colors.white,
    borderRadius: 50,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: colors.white,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 5,
    right: 0,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 2,
  },
  userSection: {
    marginTop: 55,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  userName: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
  },
  userDate: {
    fontSize: 13,
    color: colors.textLight,
    marginTop: 4,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
    backgroundColor: colors.white,
    paddingVertical: 18,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: colors.textLight,
    marginTop: 4,
    fontWeight: '600',
  },
  vSeparator: {
    width: 1,
    height: '60%',
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
  },
  reviewComposer: {
    width: '100%',
    marginTop: 18,
    padding: 16,
    borderRadius: 22,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  reviewComposerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
  },
  reviewSubtitle: {
    fontSize: 12,
    color: '#92400E',
    marginTop: 2,
    fontWeight: '600',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reviewInput: {
    minHeight: 86,
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#FDE68A',
    color: colors.text,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  submitReviewBtn: {
    marginTop: 12,
    height: 44,
    borderRadius: 13,
    backgroundColor: '#D4AF37',
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  submitReviewText: {
    color: '#000000',
    fontWeight: '900',
    fontSize: 14,
  },
  followBtnBase: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
    width: '100%',
    height: 50,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  followBtnStandard: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  followBtnPro: {
    backgroundColor: '#D4AF37',
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  followBtnTextBase: {
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  followTextStandard: {
    color: colors.white,
  },
  followTextPro: {
    color: '#000000',
  },
  followingBtnStandard: {
    backgroundColor: '#ECFDF5',
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  followingBtnPro: {
    backgroundColor: '#FFF8E1',
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 2,
    borderColor: '#D4AF37',
  },
  followingBtnTextBase: {
    fontWeight: '900',
    fontSize: 16,
  },
  followingTextStandard: {
    color: colors.primary,
  },
  followingTextPro: {
    color: '#B8860B',
  },
  tabsContainer: {
    paddingHorizontal: spacing.lg,
    marginTop: 30,
    marginBottom: 10,
  },
  pillContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    padding: 5,
  },
  pillTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 16,
  },
  pillActive: {
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textLight,
  },
  pillTextActive: {
    color: colors.text,
    fontWeight: '900',
  },
  contentArea: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.md,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  reviewCard: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  reviewCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewerName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  reviewComment: {
    color: colors.textLight,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  emptyOpiniones: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 15,
    color: colors.textLight,
    textAlign: 'center',
    fontSize: 14,
    paddingHorizontal: 40,
  }
});
