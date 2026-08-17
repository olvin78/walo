import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { apiRequest } from '../services/api';

const isExpoGoAndroid = Constants.appOwnership === 'expo' && Platform.OS === 'android';

// Expo Go ya no soporta el módulo nativo de notificaciones remotas en Android (SDK 53+),
// y setNotificationHandler dispara ese error nada más importarse. Se omite en ese entorno.
if (!isExpoGoAndroid) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => {
      if (token) {
        setExpoPushToken(token);
        // Enviar al backend
        apiRequest<{ expo_push_token: string }>('/me/', {
          method: 'PATCH',
          body: JSON.stringify({ expo_push_token: token })
        }).catch(err => console.log('Error al guardar el token push:', err));
      }
    });

    if (!isExpoGoAndroid) {
      notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
        console.log('Notificación push recibida (app abierta):', notification);
      });

      responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('Usuario tocó la notificación:', response);
      });
    }

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return { expoPushToken };
}

async function registerForPushNotificationsAsync() {
  let token;

  if (isExpoGoAndroid) {
    // Expo Go ya no soporta notificaciones push remotas en Android desde el SDK 53.
    // Solo funcionan en una build real (EAS/producción), así que evitamos el intento aquí.
    console.log('Notificaciones push remotas no disponibles en Expo Go (Android). Usa una build real para probarlas.');
    return;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }
    try {
      token = (await Notifications.getExpoPushTokenAsync({
        projectId: '0b3d4242-15a5-49f8-a9df-a8059527e048' // Assuming standard UUID format if needed, but in Expo Go it might not need it if not using EAS Build
      })).data;
      console.log("EXPO PUSH TOKEN OBTENIDO:", token);
    } catch (e) {
      console.log("Error obteniendo token:", e);
      try {
          token = (await Notifications.getExpoPushTokenAsync()).data;
      } catch (e2) {
          console.log(e2);
      }
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}
