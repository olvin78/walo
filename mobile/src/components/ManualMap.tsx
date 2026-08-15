import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import MapView, { Marker, Circle, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

type ManualMapProps = {
  latitude: number;
  longitude: number;
  setLatitude: (lat: number) => void;
  setLongitude: (lng: number) => void;
  setLocation?: (location: string) => void;
  focusToken?: number;
  style: any;
};

const ManualMap = ({ latitude, longitude, setLatitude, setLongitude, setLocation, focusToken = 0, style }: ManualMapProps) => {
  const mapRef = useRef<MapView>(null);
  const lastAnimate = useRef<string>('');
  const [isGeocoding, setIsGeocoding] = useState(false);

  const currentLat = latitude || 12.1364;
  const currentLng = longitude || -86.2514;

  const reverseGeocode = async (lat: number, lng: number) => {
    if (!setLocation) return;
    
    setIsGeocoding(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      const data = await response.json();
      
      if (data && data.address) {
        const addr = data.address;
        const locality = addr.city || addr.town || addr.village || addr.municipality || addr.county || addr.state || addr.country || '';

        if (locality) {
          setLocation(locality);
        }
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
    } finally {
      setIsGeocoding(false);
    }
  };

  useEffect(() => {
    const coordKey = `${latitude}-${longitude}-${focusToken}`;
    if (mapRef.current && latitude && longitude && lastAnimate.current !== coordKey) {
      lastAnimate.current = coordKey;
      mapRef.current.animateToRegion({
        latitude,
        longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }, 800);
    }
  }, [focusToken, latitude, longitude]);

  const handleCenter = () => {
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: currentLat,
        longitude: currentLng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
    }
  };

  const handleMapPress = (e: any) => {
    const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate;
    setLatitude(lat);
    setLongitude(lng);
    reverseGeocode(lat, lng);
  };

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: currentLat,
          longitude: currentLng,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onPress={handleMapPress}
      >
        <Circle
          center={{ latitude: currentLat, longitude: currentLng }}
          radius={400}
          strokeColor="rgba(0, 168, 120, 0.4)"
          fillColor="rgba(0, 168, 120, 0.15)"
        />
        <Marker 
          coordinate={{ 
            latitude: currentLat, 
            longitude: currentLng 
          }}
          draggable
          onDragEnd={(e) => {
            const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate;
            setLatitude(lat);
            setLongitude(lng);
            reverseGeocode(lat, lng);
          }}
        >
          <View style={styles.markerContainer}>
            <View style={styles.markerIconBg}>
              {isGeocoding ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Ionicons name="location" size={18} color={colors.white} />
              )}
            </View>
            <View style={styles.markerArrow} />
          </View>
        </Marker>
      </MapView>

      <TouchableOpacity style={styles.centerBtn} onPress={handleCenter}>
        <Ionicons name="locate" size={24} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerIconBg: {
    backgroundColor: colors.primary,
    padding: 8,
    borderRadius: 99,
    minWidth: 34,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  markerArrow: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.primary,
    marginTop: -2,
  },
  centerBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: colors.white,
    padding: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  }
});

export default ManualMap;
