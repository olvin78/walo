import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { spacing } from '../theme/colors';

const SPARKLE_DATA = [
  { left: '8%',  char: '✦', size: 10, delay: 0,    dur: 2200 },
  { left: '20%', char: '★', size: 8,  delay: 300,  dur: 2600 },
  { left: '33%', char: '✦', size: 12, delay: 600,  dur: 2000 },
  { left: '47%', char: '✧', size: 9,  delay: 150,  dur: 2400 },
  { left: '60%', char: '★', size: 11, delay: 450,  dur: 2100 },
  { left: '74%', char: '✦', size: 8,  delay: 750,  dur: 2500 },
  { left: '88%', char: '✧', size: 10, delay: 200,  dur: 2300 },
];

export function ProFooter({ isPro = true }: { isPro?: boolean }) {
  const anims = useRef(SPARKLE_DATA.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(SPARKLE_DATA[i].delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: SPARKLE_DATA[i].dur,
            useNativeDriver: true,
            easing: Easing.linear,
          }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, [anims]);

  return (
    <View style={styles.proFooterContainer}>
      <View style={styles.proFooter}>
        <View style={[styles.proFooterLine, !isPro && styles.freeFooterLine]} />
                <Text style={[styles.proFooterText, !isPro && styles.freeFooterText]}>
          {isPro ? '✦ Cuenta PRO activa ✦' : 'Plan Gratuito Activo'}
        </Text>
        <View style={[styles.proFooterLine, !isPro && styles.freeFooterLine]} />
      </View>
            {isPro && (
        <View style={styles.sparkleContainer} pointerEvents="none">
          {SPARKLE_DATA.map((s, i) => {
            const translateY = anims[i].interpolate({ inputRange: [0, 1], outputRange: [0, 55] });
            const opacity    = anims[i].interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 0.6, 0] });
            return (
              <Animated.Text
                key={i}
                style={[styles.star, { left: s.left as any, fontSize: s.size, color: i % 2 === 0 ? '#F59E0B' : '#FEF08A', transform: [{ translateY }], opacity }]}
              >
                {s.char}
              </Animated.Text>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  proFooterContainer: { 
    marginTop: 24, 
    paddingBottom: 10,
    width: '100%',
  },
  proFooter: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10, 
    paddingHorizontal: spacing.lg, 
    paddingVertical: spacing.sm 
  },
  proFooterLine: { 
    flex: 1, 
    height: 1, 
    backgroundColor: '#FDE68A' 
  },
  freeFooterLine: {
    backgroundColor: '#E5E7EB'
  },
  proFooterText: { 
    color: '#D97706', 
    fontSize: 10, 
    fontWeight: '900', 
    letterSpacing: 1.5 
  },
  freeFooterText: {
    color: '#9CA3AF',
    letterSpacing: 1,
  },
  sparkleContainer: { 
    position: 'relative', 
    height: 60, 
    width: '100%', 
    overflow: 'hidden' 
  },
  star: { 
    position: 'absolute', 
    top: 0, 
    fontWeight: '400' 
  },
});
