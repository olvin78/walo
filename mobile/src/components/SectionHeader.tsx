import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing } from '../theme/colors';

interface SectionHeaderProps {
  title: string;
  onPressAction?: () => void;
  actionLabel?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ 
  title, 
  onPressAction, 
  actionLabel = 'Ver todo' 
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {onPressAction && (
        <TouchableOpacity onPress={onPressAction}>
          <Text style={styles.action}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  action: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
});
