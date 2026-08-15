import { Tabs } from 'expo-router';
import React from 'react';
import { View, Platform, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
              <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
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
              <Ionicons name={focused ? "search" : "search-outline"} size={22} color={color} />
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
                <Ionicons name="add" size={30} color={colors.white} />
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
              <Ionicons name={focused ? "heart" : "heart-outline"} size={22} color={color} />
              <Text style={[styles.tabLabel, { color }]}>Favoritos</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.tabItem}>
              <Ionicons name={focused ? "person" : "person-outline"} size={22} color={color} />
              <Text style={[styles.tabLabel, { color }]}>Perfil</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
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
