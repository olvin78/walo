import { useLocalSearchParams } from 'expo-router';
import { ListingDetailScreen } from '../../src/screens/ListingDetailScreen';

export default function ListingDetail() {
  const { id } = useLocalSearchParams();
  
  return <ListingDetailScreen listingId={id as string} />;
}
