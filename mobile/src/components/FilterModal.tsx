import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  TextInput, 
  ScrollView,
  Platform,
  TouchableWithoutFeedback
} from 'react-native';
import { X } from 'lucide-react-native';
import Slider from '@react-native-community/slider';
import { colors, spacing, borderRadius } from '../theme/colors';

type FilterModalProps = {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterValues) => void;
  initialFilters: FilterValues;
};

export type FilterValues = {
  minPrice: string;
  maxPrice: string;
  location: string;
  sortBy: string;
  radius: number;
};

const SORT_OPTIONS = [
  { label: 'Más recientes', value: 'newest' },
  { label: 'Precio: Menor a Mayor', value: 'price_asc' },
  { label: 'Precio: Mayor a Menor', value: 'price_desc' },
];

const LOCATION_OPTIONS = [
  'Todo Nicaragua',
  'Boaco',
  'Carazo',
  'Chinandega',
  'Chontales',
  'Estelí',
  'Granada',
  'Jinotega',
  'León',
  'Madriz',
  'Managua',
  'Masaya',
  'Matagalpa',
  'Nueva Segovia',
  'Rivas',
  'Río San Juan',
  'RACCN',
  'RACCS',
];

export const FilterModal = ({ visible, onClose, onApply, initialFilters }: FilterModalProps) => {
  const [minPrice, setMinPrice] = useState(initialFilters.minPrice);
  const [maxPrice, setMaxPrice] = useState(initialFilters.maxPrice);
  const [location, setLocation] = useState(initialFilters.location);
  const [sortBy, setSortBy] = useState(initialFilters.sortBy);
  const [radius, setRadius] = useState(initialFilters.radius);

  const handleReset = () => {
    setMinPrice('');
    setMaxPrice('');
    setLocation('Todo Nicaragua');
    setSortBy('newest');
    setRadius(20);
  };

  const handleApply = () => {
    onApply({ minPrice, maxPrice, location, sortBy, radius });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.modalBlur} />
        </TouchableWithoutFeedback>
        
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Filtros</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={24} color={colors.text} strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Price Range */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>RANGO DE PRECIO (C$)</Text>
              <View style={styles.row}>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="Mínimo"
                    placeholderTextColor={colors.textLight}
                    keyboardType="numeric"
                    value={minPrice}
                    onChangeText={setMinPrice}
                  />
                </View>
                <View style={[styles.inputWrapper, { marginLeft: 12 }]}>
                  <TextInput
                    style={styles.input}
                    placeholder="Máximo"
                    placeholderTextColor={colors.textLight}
                    keyboardType="numeric"
                    value={maxPrice}
                    onChangeText={setMaxPrice}
                  />
                </View>
              </View>
            </View>

            {/* Location */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>UBICACIÓN GENERAL</Text>
              <View style={styles.chipsContainer}>
                {LOCATION_OPTIONS.map((opt) => (
                  <TouchableOpacity 
                    key={opt}
                    style={[styles.chip, location === opt && styles.chipActive]}
                    onPress={() => setLocation(opt)}
                  >
                    <Text style={[styles.chipText, location === opt && styles.chipTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Radius Slider */}
            <View style={styles.section}>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionLabel}>RADIO DE BÚSQUEDA</Text>
                <Text style={styles.radiusValue}>{radius} km</Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={100}
                step={1}
                value={radius}
                onValueChange={setRadius}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor="#E5E7EB"
                thumbTintColor={colors.primary}
              />
              <Text style={styles.sliderHint}>Ajusta para ver cosas más cerca</Text>
            </View>

            {/* Sort Order */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ORDENAR POR</Text>
              {SORT_OPTIONS.map((opt) => (
                <TouchableOpacity 
                  key={opt.value}
                  style={styles.radioItem}
                  onPress={() => setSortBy(opt.value)}
                >
                  <View style={[styles.radioCircle, sortBy === opt.value && styles.radioActive]}>
                    {sortBy === opt.value && <View style={styles.radioInner} />}
                  </View>
                  <Text style={styles.radioLabel}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
              <Text style={styles.resetText}>Restablecer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
              <Text style={styles.applyText}>APLICAR FILTROS</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: '85%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  closeBtn: {
    padding: 4,
  },
  scrollBody: {
    padding: spacing.lg,
  },
  section: {
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textLight,
    marginBottom: 12,
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 50,
    justifyContent: 'center',
  },
  input: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 99,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.white,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  radiusValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  sliderHint: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: -4,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioActive: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  radioLabel: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  resetBtn: {
    marginRight: 20,
  },
  resetText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textLight,
  },
  applyBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  applyText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
