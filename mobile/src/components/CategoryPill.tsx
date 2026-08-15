import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme/colors';

interface CategoryPillProps {
  name: string;
  icon: string;
  onPress: () => void;
  active?: boolean;
}

export const CategoryPill: React.FC<CategoryPillProps> = ({ name, icon, onPress, active = false }) => {
  const isEmojiIcon = icon && !icon.includes('-') && icon.length <= 4;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={[styles.iconContainer, active && styles.activeIconContainer]}>
        {isEmojiIcon ? (
          <Text style={styles.emojiIcon}>{icon}</Text>
        ) : (
          <Ionicons name={(icon || 'grid-outline') as any} size={28} color={colors.primary} />
        )}
      </View>
      <Text style={[styles.name, active && styles.activeName]} numberOfLines={1}>{name}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginRight: spacing.md,
    width: 75,
  },
  iconContainer: {
    width: 65,
    height: 65,
    borderRadius: 33, // Circular
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeIconContainer: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: colors.primary,
  },
  name: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  activeName: {
    color: colors.primary,
    fontWeight: '900',
  },
  emojiIcon: {
    fontSize: 28,
  },
});
