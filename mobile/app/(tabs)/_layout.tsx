import { Tabs } from 'expo-router';
import React from 'react';
import { View, Platform, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Search, Plus, Heart, User, Store } from 'lucide-react-native';
import { colors } from '../../src/theme/colors';
import { useAuth } from '../../src/services/auth';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isMePro = Boolean(user?.profile?.is_pro);
  
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: isMePro ? '#F59E0B' : colors.primary,
        tabBarInactiveTintColor: colors.textLight,
        headerShown: false,
        tabBarShowLabel: false, // We'll handle labels manually for better centering control
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: 'rgba(212, 175, 55, 0.35)', // Subtle premium golden line
          height: 65 + (insets.bottom > 0 ? insets.bottom : (Platform.OS === 'ios' ? 30 : 15)),
          paddingTop: 10,
          paddingBottom: insets.bottom > 0 ? insets.bottom : (Platform.OS === 'ios' ? 30 : 15),
          borderTopWidth: 1.5, // Slightly thicker for the gold to show
          elevation: 12,
          shadowColor: 'rgba(212, 175, 55, 0.2)', // Subtle golden shadow glow
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.tabItem}>
              <View style={[styles.iconWrap, focused && styles.iconWrapActive, focused && isMePro && styles.iconWrapActivePro]}>
                <Home size={focused ? 23 : 21} color={color} strokeWidth={focused ? 2.4 : 2} />
              </View>
              <Text style={[styles.tabLabel, { color }]}>Inicio</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.tabItem}>
              <View style={[styles.iconWrap, focused && styles.iconWrapActive, focused && isMePro && styles.iconWrapActivePro]}>
                <Search size={focused ? 23 : 21} color={color} strokeWidth={focused ? 2.4 : 2} />
              </View>
              <Text style={[styles.tabLabel, { color }]}>Buscar</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="publish"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.publishContainer}>
              {/* Golden arch that perfectly meets the tab bar border */}
              <View style={styles.archWrapper}>
                <View style={styles.archCircle} />
              </View>

              {/* White cutout covering the straight line below */}
              <View style={styles.publishButtonWrap}>
                <View style={styles.publishButton}>
                  <Plus size={28} color={colors.white} strokeWidth={2.6} />
                </View>
              </View>

              <Text style={[styles.tabLabel, { color: focused ? colors.primary : colors.textLight, marginTop: 4 }]}>
                Publicar
              </Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.tabItem}>
              <View style={[styles.iconWrap, focused && styles.iconWrapActive, focused && isMePro && styles.iconWrapActivePro]}>
                <Heart size={focused ? 23 : 21} color={focused ? colors.favorite : color} strokeWidth={focused ? 2.4 : 2} fill={focused ? colors.favorite : 'none'} />
              </View>
              <Text style={[styles.tabLabel, { color: focused ? colors.favorite : color }]}>Favoritos</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.tabItem}>
              <View style={[styles.iconWrap, focused && styles.iconWrapActive, focused && isMePro && styles.iconWrapActivePro]}>
                <User size={focused ? 23 : 21} color={color} strokeWidth={focused ? 2.4 : 2} />
              </View>
              <Text style={[styles.tabLabel, { color }]}>Perfil</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.tabItem}>
              <View style={[styles.iconWrap, focused && styles.iconWrapActive, focused && isMePro && styles.iconWrapActivePro]}>
                <Store size={focused ? 23 : 21} color={color} strokeWidth={focused ? 2.4 : 2} />
              </View>
              <Text style={[styles.tabLabel, { color }]}>Explorar</Text>
            </View>
          ),
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: 60,
  },
  iconWrap: {
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.10)',
  },
  iconWrapActivePro: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    paddingHorizontal: 4.5,
    paddingVertical: 1.5,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
  publishContainer: {
    alignItems: 'center',
    width: 70,
    marginTop: -28, // Pull up by 28px
  },
  archWrapper: {
    position: 'absolute',
    top: 0,
    width: 62,
    height: 31, // Exactly half of 62
    overflow: 'hidden',
    zIndex: 2,
  },
  archCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.4)', // Golden border
    backgroundColor: 'transparent', // Must be transparent to not cover the Plus icon!
  },
  publishButtonWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#FFFFFF', // This white circle covers the tab bar's straight line inside the menu!
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  publishButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
});