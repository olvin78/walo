import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Search, XCircle, SlidersHorizontal } from 'lucide-react-native';
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
  isPro?: boolean;
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
  isPro = false,
}) => {
  return (
    <TouchableOpacity 
      activeOpacity={onPress ? 0.7 : 1} 
      onPress={onPress}
      style={[styles.container, isPro && styles.containerPro]}
    >
      <Search size={20} color={isPro ? '#F59E0B' : colors.textLight} strokeWidth={2} style={styles.icon} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={isPro ? '#D97706' : colors.textLight}
        editable={editable && !onPress}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        returnKeyType="search"
      />
      {value ? (
        <TouchableOpacity style={styles.clearBtn} onPress={onClear}>
          <XCircle size={18} color={isPro ? '#F59E0B' : colors.textLight} />
        </TouchableOpacity>
      ) : null}
      <View style={[styles.divider, isPro && styles.dividerPro]} />
      <TouchableOpacity 
        style={styles.filterBtn} 
        onPress={(e) => {
          e.stopPropagation();
          onFilterPress?.();
        }}
      >
        <SlidersHorizontal size={20} color={isPro ? '#F59E0B' : colors.primary} strokeWidth={2.2} />
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
  containerPro: {
    borderColor: '#F59E0B',
    borderWidth: 1.5,
    shadowColor: '#F59E0B',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
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
  dividerPro: {
    backgroundColor: '#FDE68A',
  },
  filterBtn: {
    padding: spacing.xs,
  },
  clearBtn: {
    padding: spacing.xs,
  },
});
