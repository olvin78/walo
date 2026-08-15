import { UserProfileScreen } from '../../src/screens/UserProfileScreen';
import { useAuth } from '../../src/services/auth';

export default function MyProfile() {
  const { user } = useAuth();
  return <UserProfileScreen username={user?.username || ''} />;
}
