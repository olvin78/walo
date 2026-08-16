import { Platform } from 'react-native';

export type Subcategory = {
  id: number;
  name: string;
  slug: string;
  icon?: string;
  description?: string | null;
  total_active_listings?: number;
};

export type Category = {
  id: number;
  name: string;
  slug: string;
  icon?: string;
  image?: string | null;
  total_active_listings?: number;
  subcategories?: Subcategory[];
};

export type ListingSummary = {
  id: number;
  title: string;
  slug?: string;
  price: number | string;
  currency?: string;
  category?: Category | null;
  subcategory?: Subcategory | null;
  location?: string | null;
  is_promoted?: boolean;
  is_negotiable?: boolean;
  city?: string | null;
  department?: string | null;
  main_image?: string | null;
  created_at?: string;
  is_favorite?: boolean;
  is_active?: boolean;
  seller?: {
    id?: number;
    username?: string;
    display_name?: string;
    avatar?: string | null;
    is_verified?: boolean;
    is_pro?: boolean;
    whatsapp?: string | null;
  };
};

export type ListingImage = {
  id: number;
  url?: string | null;
  thumbnail?: string | null;
  medium?: string | null;
  order?: number | null;
};

export type ListingDetail = ListingSummary & {
  description?: string | null;
  images?: ListingImage[];
  is_active?: boolean;
  is_negotiable?: boolean;
  payment_methods?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  whatsapp?: string | null;
  contact_available?: boolean;
};

export type ListingsResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: ListingSummary[];
  exact_matches?: boolean;
};

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type HomeResponse = {
  brand: string;
  base_url: string;
  categories: Category[];
  latest: ListingSummary[];
  featured: ListingSummary[];
  recommended: ListingSummary[];
  popular_searches: string[];
};

export type Me = {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  date_joined: string;
  profile: {
    avatar?: string | null;
    cover_image?: string | null;
    location?: string | null;
    phone?: string | null;
    bio?: string | null;
    rating?: number | string | null;
    reviews_count?: number;
    is_verified?: boolean;
    latitude?: number | string | null;
    longitude?: number | string | null;
    followers_count?: number;
    listings_count?: number;
    is_pro?: boolean;
    allows_notifications?: boolean;
  } | null;
};

export type AuthResponse = {
  access: string;
  refresh: string;
  user: Me;
};

export type RegisterPayload = {
  username: string;
  email: string;
  password: string;
  password2: string;
  first_name?: string;
  last_name?: string;
};

export type ListingPayload = {
  title: string;
  description: string;
  price: string | number;
  category: number;
  subcategory?: number | null;
  location: string;
  is_active?: boolean;
  is_negotiable?: boolean;
  payment_methods?: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  main_image?: { uri: string; name?: string; type?: string } | null;
  images?: { uri: string; name?: string; type?: string }[];
};

export type ProfileReview = {
  id: number;
  reviewer: string;
  rating: number;
  comment: string;
  created_at: string;
};

export type UserProfileResponse = {
  id: number;
  username: string;
  display_name: string;
  date_joined: string;
  profile: {
    avatar?: string | null;
    cover_image?: string | null;
    location?: string | null;
    bio?: string | null;
    is_verified?: boolean;
    is_pro?: boolean;
  };
  stats: {
    followers_count: number;
    listings_count: number;
    average_rating: number;
    reviews_count: number;
    user_rating: number;
    user_comment: string;
    can_review: boolean;
  };
  reviews: ProfileReview[];
  listings: ListingSummary[];
};

export type ProfileReviewResponse = {
  status: string;
  average_rating: number;
  reviews_count: number;
  review: ProfileReview;
};

export type ChatUser = {
  id: number;
  username: string;
  display_name: string;
  avatar?: string | null;
  is_verified?: boolean;
};

export type ChatMessage = {
  id: number;
  conversation: number;
  sender: ChatUser;
  text: string;
  created_at: string;
  is_read: boolean;
  is_mine: boolean;
};

export type Conversation = {
  id: number;
  listing: ListingSummary | null;
  participants: ChatUser[];
  other_user: ChatUser | null;
  last_message: ChatMessage | null;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
};

export type NotificationType = 'message' | 'offer' | 'favorite' | 'system';

export type Notification = {
  id: number;
  notification_type: NotificationType;
  title: string;
  body: string;
  related_listing?: number | null;
  listing_title?: string | null;
  related_conversation?: number | null;
  is_read: boolean;
  created_at: string;
};

export type ReportReason = 'fraud' | 'spam' | 'inappropriate' | 'wrong_category' | 'sold' | 'other';

export type Story = {
  id: number;
  user: number;
  user_display_name: string;
  user_avatar?: string | null;
  image: string;
  text?: string;
  audio_url?: string;
  audio_start?: number;
  audio_name?: string;
  metadata?: string | null;
  created_at: string;
  expires_at: string;
  is_own: boolean;
};

const fallbackBaseUrl = Platform.select({
  android: 'https://www.igualo.com/api/v1',
  ios: 'https://www.igualo.com/api/v1',
  web: 'https://www.igualo.com/api/v1',
  default: 'https://www.igualo.com/api/v1',
});

export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || fallbackBaseUrl || '').replace(/\/$/, '');

let memoryAccessToken: string | null = null;
let memoryRefreshToken: string | null = null;

const storage = {
  get(key: string) {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  },
  set(key: string, value: string) {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  },
  remove(key: string) {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  },
};

export function setTokens(access: string | null, refresh: string | null) {
  memoryAccessToken = access;
  memoryRefreshToken = refresh;
  if (access) storage.set('igualo_access', access);
  else storage.remove('igualo_access');
  if (refresh) storage.set('igualo_refresh', refresh);
  else storage.remove('igualo_refresh');
}

export function getAccessToken() {
  memoryAccessToken = memoryAccessToken || storage.get('igualo_access');
  return memoryAccessToken;
}

export function getRefreshToken() {
  memoryRefreshToken = memoryRefreshToken || storage.get('igualo_refresh');
  return memoryRefreshToken;
}

export function clearTokens() {
  setTokens(null, null);
}

function normalizePath(path: string) {
  if (path.startsWith('http')) return path;
  const normalized = path.replace(/^\/api\/v1/, '');
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function buildHeaders(init?: RequestInit) {
  const headers = new Headers(init?.headers);
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, data: unknown) {
    super(`API request failed: ${status}`);
    this.status = status;
    this.data = data;
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit, retry = true): Promise<T> {
  const normalizedPath = normalizePath(path);
  const url = normalizedPath.startsWith('http') ? normalizedPath : `${API_BASE_URL}${normalizedPath}`;
  const headers = buildHeaders(init);
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  if (init?.body && !isFormData && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await fetch(url, { ...init, headers });

  if (response.status === 401 && retry && getRefreshToken()) {
    const refreshed = await refreshToken().catch(() => null);
    if (refreshed) return apiRequest<T>(path, init, false);
  }

  const data = await parseResponse(response);
  if (!response.ok) {
    console.error('[Igualo API] Error response', {
      url,
      method: init?.method || 'GET',
      status: response.status,
      body: data,
    });
    throw new ApiError(response.status, data);
  }
  return data as T;
}

function appendListingPayload(formData: FormData, payload: Partial<ListingPayload>) {
  if (payload.title !== undefined) formData.append('title', payload.title);
  if (payload.description !== undefined) formData.append('description', payload.description);
  if (payload.price !== undefined) formData.append('price', String(payload.price));
  if (payload.category !== undefined) formData.append('category', String(payload.category));
  if (payload.location !== undefined) formData.append('location', payload.location);
  if (payload.subcategory) formData.append('subcategory', String(payload.subcategory));
  if (typeof payload.is_active === 'boolean') formData.append('is_active', String(payload.is_active));
  if (payload.payment_methods) formData.append('payment_methods', payload.payment_methods);
  if (payload.latitude !== null && payload.latitude !== undefined) formData.append('latitude', String(payload.latitude));
  if (payload.longitude !== null && payload.longitude !== undefined) formData.append('longitude', String(payload.longitude));
  if (payload.main_image) formData.append('main_image', payload.main_image as unknown as Blob);
  payload.images?.forEach((image) => formData.append('images', image as unknown as Blob));
}

export async function login(loginValue: string, password: string) {
  console.info('[Igualo API] Login request', {
    url: `${API_BASE_URL}/auth/login/`,
    bodyKeys: ['login', 'password'],
    login: loginValue,
  });
  const response = await apiRequest<AuthResponse>('/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ login: loginValue, password }),
  }, false);
  setTokens(response.access, response.refresh);
  return response;
}

export async function loginWithGoogle(idToken: string) {
  console.info('[Igualo API] Google Login request');
  const response = await apiRequest<AuthResponse>('/auth/google/', {
    method: 'POST',
    body: JSON.stringify({ id_token: idToken }),
  }, false);
  setTokens(response.access, response.refresh);
  return response;
}

export async function register(payload: RegisterPayload) {
  const response = await apiRequest<AuthResponse>('/auth/register/', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, false);
  setTokens(response.access, response.refresh);
  return response;
}

export async function refreshToken() {
  const refresh = getRefreshToken();
  if (!refresh) throw new ApiError(401, { detail: 'No refresh token' });
  const response = await apiRequest<{ access: string }>('/auth/refresh/', {
    method: 'POST',
    body: JSON.stringify({ refresh }),
  }, false);
  setTokens(response.access, refresh);
  return response.access;
}

export async function logout() {
  const refresh = getRefreshToken();
  if (refresh) {
    await apiRequest('/auth/logout/', {
      method: 'POST',
      body: JSON.stringify({ refresh }),
    }).catch(() => null);
  }
  clearTokens();
}

export function getMe() {
  return apiRequest<Me>('/me/');
}

export async function getCategories() {
  const response = await apiRequest<Category[] | PaginatedResponse<Category>>('/categories/');
  return Array.isArray(response) ? response : response.results;
}

export function getHome() {
  return apiRequest<HomeResponse>('/home/');
}

export function getListings(nextUrl?: string) {
  return apiRequest<ListingsResponse>(nextUrl || '/listings/');
}

export function searchListings(params?: Record<string, string | number | undefined>, nextUrl?: string) {
  if (nextUrl) return apiRequest<ListingsResponse>(nextUrl);
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<ListingsResponse>(`/search/${suffix}`);
}

export function getListingDetail(listingId: number | string) {
  return apiRequest<ListingDetail>(`/listings/${listingId}/`);
}

export function getMeListings(nextUrl?: string) {
  return apiRequest<ListingsResponse>(nextUrl || '/me/listings/');
}

export function getFavoriteListings(nextUrl?: string) {
  return apiRequest<ListingsResponse>(nextUrl || '/me/favorites/');
}

export function setListingFavorite(listingId: number, isFavorite: boolean) {
  return apiRequest<{ is_favorite: boolean }>(`/listings/${listingId}/favorite/`, {
    method: isFavorite ? 'POST' : 'DELETE',
  });
}

export async function createListing(payload: ListingPayload) {
  const formData = new FormData();
  appendListingPayload(formData, payload);
  return apiRequest<ListingDetail>('/listings/', {
    method: 'POST',
    body: formData,
  });
}

export async function updateListing(listingId: number | string, payload: Partial<ListingPayload>) {
  const formData = new FormData();
  appendListingPayload(formData, payload);
  return apiRequest<ListingDetail>(`/listings/${listingId}/`, {
    method: 'PATCH',
    body: formData,
  });
}

export function deleteListing(listingId: number | string) {
  return apiRequest<void>(`/listings/${listingId}/`, { method: 'DELETE' });
}

export function getUserProfile(username: string) {
  return apiRequest<UserProfileResponse>(`/profiles/${encodeURIComponent(username)}/`);
}

export function submitProfileReview(username: string, rating: number, comment: string) {
  return apiRequest<ProfileReviewResponse>(`/profiles/${encodeURIComponent(username)}/reviews/`, {
    method: 'POST',
    body: JSON.stringify({ rating, comment }),
  });
}

export function getConversations() {
  return apiRequest<Conversation[]>('/conversations/');
}

export function getConversation(conversationId: number | string) {
  return apiRequest<Conversation>(`/conversations/${conversationId}/`);
}

export function deleteConversation(conversationId: number | string) {
  return apiRequest<void>(`/conversations/${conversationId}/`, { method: 'DELETE' });
}

export function createConversation(listingId: number | string, text?: string) {
  return apiRequest<Conversation>('/conversations/', {
    method: 'POST',
    body: JSON.stringify({ listing: listingId, text }),
  });
}

export function sendMessage(conversationId: number | string, text: string) {
  return apiRequest<ChatMessage>('/messages/', {
    method: 'POST',
    body: JSON.stringify({ conversation: conversationId, text }),
  });
}

export function markMessageRead(messageId: number | string) {
  return apiRequest<ChatMessage>(`/messages/${messageId}/read/`, { method: 'PATCH' });
}

export function getStories() {
  return apiRequest<Story[]>('/stories/');
}

export function createStory(payload: {
  image: { uri: string; name?: string; type?: string };
  text?: string;
  audio_url?: string;
  audio_start?: number;
  audio_name?: string;
  metadata?: string;
}) {
  const formData = new FormData();
  formData.append('image', payload.image as unknown as Blob);
  if (payload.text) formData.append('text', payload.text);
  if (payload.audio_url) formData.append('audio_url', payload.audio_url);
  if (payload.audio_start !== undefined) formData.append('audio_start', String(payload.audio_start));
  if (payload.audio_name) formData.append('audio_name', payload.audio_name);
  if (payload.metadata) formData.append('metadata', payload.metadata);
  return apiRequest<Story>('/stories/', { method: 'POST', body: formData });
}

export function deleteStory(storyId: number | string) {
  return apiRequest<void>(`/stories/${storyId}/`, { method: 'DELETE' });
}

export function makeOffer(listingId: number | string, amount: string | number, message?: string) {
  return apiRequest<{ status: string; conversation_id: number; message: ChatMessage }>(`/listings/${listingId}/offer/`, {
    method: 'POST',
    body: JSON.stringify({ amount, message }),
  });
}

export function updateProfile(payload: {
  avatar?: { uri: string; name?: string; type?: string } | Blob | null;
  cover_image?: { uri: string; name?: string; type?: string } | Blob | null;
  bio?: string;
  phone?: string;
  location?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  latitude?: number;
  longitude?: number;
  allows_notifications?: boolean;
} | FormData) {
  if (payload instanceof FormData) {
    return apiRequest<Me>('/me/', {
      method: 'PATCH',
      body: payload,
    });
  }
  const formData = new FormData();
  if (payload.avatar) formData.append('avatar', payload.avatar as any);
  if (payload.cover_image) formData.append('cover_image', payload.cover_image as any);
  if (payload.first_name !== undefined) formData.append('first_name', payload.first_name);
  if (payload.last_name !== undefined) formData.append('last_name', payload.last_name);
  if (payload.bio !== undefined) formData.append('bio', payload.bio);
  if (payload.phone !== undefined) formData.append('phone', payload.phone);
  if (payload.location !== undefined) formData.append('location', payload.location);
  if (payload.email !== undefined) formData.append('email', payload.email);
  if (payload.latitude !== undefined) formData.append('latitude', String(payload.latitude));
  if (payload.longitude !== undefined) formData.append('longitude', String(payload.longitude));
  if (payload.allows_notifications !== undefined) formData.append('allows_notifications', String(payload.allows_notifications));

  return apiRequest<Me>('/me/', {
    method: 'PATCH',
    body: formData,
  });
}

export function changePassword(payload: {
  old_password: string;
  new_password: string;
  confirm_password: string;
}) {
  return apiRequest<{ detail: string }>('/auth/password/change/', {
    method: 'POST',
    body: JSON.stringify({ old_password: payload.old_password, new_password: payload.new_password, confirm_password: payload.confirm_password }),
  });
}

export function getNotifications() {
  // Try to parse as array or paginated response
  return apiRequest<Notification[] | PaginatedResponse<Notification>>('/notifications/').then(res => 
    Array.isArray(res) ? res : res.results
  );
}

export function getUnreadNotificationsCount() {
  return apiRequest<{ unread_count: number }>('/notifications/unread-count/');
}

export function markNotificationRead(id: number | string) {
  return apiRequest<Notification>(`/notifications/${id}/read/`, { method: 'PATCH' });
}

export function markAllNotificationsRead() {
  return apiRequest<{ status: string }>('/notifications/read-all/', { method: 'POST' });
}

export function reportListing(listingId: number | string, reason: ReportReason, description?: string) {
  return apiRequest<{ id: number }>(`/listings/${listingId}/report/`, {
    method: 'POST',
    body: JSON.stringify({ listing: listingId, reason, description }),
  });
}

export function reportBug(description: string, screenshot?: { uri: string; name?: string; type?: string }) {
  const formData = new FormData();
  formData.append('description', description);
  if (screenshot) {
    formData.append('screenshot', screenshot as unknown as Blob);
  }
  return apiRequest<{ id: number }>('/report-bug/', {
    method: 'POST',
    body: formData,
  });
}
