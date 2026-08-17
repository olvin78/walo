import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

export type UploadFile = {
  uri: string;
  name: string;
  type: string;
};

export async function processImageForUpload(uri: string, name?: string): Promise<UploadFile | Blob> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    return await res.blob();
  }

  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1600 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
  );

  return {
    uri: result.uri,
    name: name || 'photo.jpg',
    type: 'image/jpeg',
  };
}