import { useOutletContext } from 'react-router';
import AgentWorkspace from '../components/AgentWorkspace';

type AppShellOutletContext = {
  sidebarOpen?: boolean;
  openSidebar?: () => void;
  closeSidebar?: () => void;
};

export default function ReportPage() {
  const { sidebarOpen = true, openSidebar, closeSidebar } = useOutletContext<AppShellOutletContext>();

  return (
    <AgentWorkspace
      mode="report"
      sidebarOpen={sidebarOpen}
      onSidebarOpen={openSidebar}
      onSidebarClose={closeSidebar}
      onExecutionStart={openSidebar}
    />
  );
}
