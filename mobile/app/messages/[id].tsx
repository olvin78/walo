import { useLocalSearchParams } from 'expo-router';
import { ChatScreen } from '../../src/screens/ChatScreen';

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ChatScreen conversationId={id || ''} />;
}
