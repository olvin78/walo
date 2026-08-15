import { useLocalSearchParams } from 'expo-router';
import { EditListingScreen } from '../../../src/screens/EditListingScreen';

export default function EditListing() {
  const { id } = useLocalSearchParams();
  
  return <EditListingScreen listingId={id as string} />;
}
