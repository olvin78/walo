import { useLocalSearchParams } from 'expo-router';
import { UserProfileScreen } from '../../src/screens/UserProfileScreen';

export default function PublicProfile() {
  const { username } = useLocalSearchParams<{ username: string }>();
  return <UserProfileScreen username={username || 'juan'} />;
}
