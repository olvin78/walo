import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme/colors';

interface SearchBarProps {
  placeholder?: string;
  onPress?: () => void;
  editable?: boolean;
  value?: string;
  onChangeText?: (value: string) => void;
  onSubmitEditing?: () => void;
  onClear?: () => void;
  onFilterPress?: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ 
  placeholder = "Buscar iPhone, motos, hogar...", 
  onPress,
  editable = true,
  value,
  onChangeText,
  onSubmitEditing,
  onClear,
  onFilterPress,
}) => {
  return (
    <TouchableOpacity 
      activeOpacity={onPress ? 0.7 : 1} 
      onPress={onPress}
      style={styles.container}
    >
      <Ionicons name="search-outline" size={20} color={colors.textLight} style={styles.icon} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.textLight}
        editable={editable && !onPress}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        returnKeyType="search"
      />
      {value ? (
        <TouchableOpacity style={styles.clearBtn} onPress={onClear}>
          <Ionicons name="close-circle" size={18} color={colors.textLight} />
        </TouchableOpacity>
      ) : null}
      <View style={styles.divider} />
      <TouchableOpacity 
        style={styles.filterBtn} 
        onPress={(e) => {
          e.stopPropagation();
          onFilterPress?.();
        }}
      >
        <Ionicons name="options-outline" size={20} color={colors.primary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    marginHorizontal: spacing.md,
    marginVertical: spacing.md,
    paddingHorizontal: spacing.md,
    height: 55, // Slightly taller
    borderRadius: 28, // Fully rounded
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  filterBtn: {
    padding: spacing.xs,
  },
  clearBtn: {
    padding: spacing.xs,
  },
});
