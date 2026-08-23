import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { X } from 'lucide-react-native';
import { getSystemAlerts, SystemAlert } from '../services/api';

export function SystemAlertBar() {
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [dismissed, setDismissed] = useState<number[]>([]);

  useEffect(() => {
    getSystemAlerts().then(setAlerts);
  }, []);

  const visible = alerts.filter((a) => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  return (
    <View>
      {visible.map((alert) => (
        <View key={alert.id} style={styles.bar}>
          <Text numberOfLines={2} style={styles.text}>
            <Text style={styles.title}>{alert.title}</Text>
            {' — '}
            <Text style={styles.message}>{alert.message}</Text>
          </Text>
          <TouchableOpacity
            onPress={() => setDismissed((prev) => [...prev, alert.id])}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={14} color="rgba(255,255,255,0.6)" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(18, 18, 20, 0.92)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16,
    paddingVertical: 9,
    gap: 10,
  },
  text: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.65)',
  },
  title: {
    fontWeight: '700',
    fontSize: 12,
    color: '#ffffff',
  },
  message: {
    fontWeight: '400',
  },
});
