import { Tabs } from 'expo-router';
import React from 'react';
import { View, Platform, StyleSheet, Text } from 'react-native';
import { Home, Search, Plus, Heart, User, Store } from 'lucide-react-native';
import { colors } from '../../src/theme/colors';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
        headerShown: false,
        tabBarShowLabel: false, // We'll handle labels manually for better centering control
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          height: Platform.OS === 'ios' ? 90 : 75,
          paddingTop: 10,
          paddingBottom: Platform.OS === 'ios' ? 30 : 15,
          borderTopWidth: 1,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 5,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.tabItem}>
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
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
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
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
              <View style={styles.publishButton}>
                <Plus size={30} color={colors.white} strokeWidth={2.6} />
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
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
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
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
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
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
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
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
  publishContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: 70,
    marginTop: -30, // Lift the whole container
  },
  publishButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: colors.white,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
});