import { useOutletContext } from 'react-router';
import AgentWorkspace from '../components/AgentWorkspace';

type AppShellOutletContext = {
  sidebarOpen?: boolean;
};

export default function ChatPage() {
  const { sidebarOpen = true } = useOutletContext<AppShellOutletContext>();

  return <AgentWorkspace mode="ask" sidebarOpen={sidebarOpen} />;
}
