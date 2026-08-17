import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

type ManualMapProps = {
  latitude: number;
  longitude: number;
  setLatitude: (lat: number) => void;
  setLongitude: (lng: number) => void;
  style: any;
};

const ManualMap = ({ latitude, longitude, setLatitude, setLongitude, style }: ManualMapProps) => {
  // We use an iframe for Google Maps on Web for free interactivity
  // This avoids WebGL requirement issues that some users experience with OSM or other providers.
  const mapUrl = `https://maps.google.com/maps?q=${latitude},${longitude}&hl=es&z=15&output=embed`;

  return (
    <View style={[style, styles.container]}>
      {/* Search on Web uses an iframe to show the location */}
      <iframe
        width="100%"
        height="100%"
        frameBorder="0"
        scrolling="no"
        marginHeight={0}
        marginWidth={0}
        src={mapUrl}
        style={{ border: 'none', borderRadius: 16 }}
      />
      <View style={styles.overlay}>
        <Text style={styles.hint}>Usa el botón "Buscar en mapa" arriba para moverte en Web</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    overflow: 'hidden',
  },
  overlay: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.8)',
    padding: 5,
    borderRadius: 8,
    alignItems: 'center',
  },
  hint: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
  }
});

export default ManualMap;
