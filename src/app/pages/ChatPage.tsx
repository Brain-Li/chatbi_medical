import { useOutletContext } from 'react-router';
import AgentWorkspace from '../components/AgentWorkspace';

type AppShellOutletContext = {
  sidebarOpen?: boolean;
  openSidebar?: () => void;
  closeSidebar?: () => void;
};

export default function ChatPage() {
  const { sidebarOpen = true, openSidebar, closeSidebar } = useOutletContext<AppShellOutletContext>();

  return (
    <AgentWorkspace
      mode="ask"
      sidebarOpen={sidebarOpen}
      onExecutionStart={openSidebar}
      onDeepAnalysisStart={closeSidebar}
    />
  );
}
