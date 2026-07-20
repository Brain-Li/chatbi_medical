import { useOutletContext } from 'react-router';
import AgentWorkspace from '../components/AgentWorkspace';

type AppShellOutletContext = {
  sidebarOpen?: boolean;
  openSidebar?: () => void;
};

export default function ReportPage() {
  const { sidebarOpen = true, openSidebar } = useOutletContext<AppShellOutletContext>();

  return <AgentWorkspace mode="report" sidebarOpen={sidebarOpen} onExecutionStart={openSidebar} />;
}
