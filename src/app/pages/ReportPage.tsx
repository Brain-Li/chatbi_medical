import { useOutletContext } from 'react-router';
import AgentWorkspace from '../components/AgentWorkspace';

type AppShellOutletContext = {
  sidebarOpen?: boolean;
  openSidebar?: () => void;
};

export default function ReportPage() {
  const {
    sidebarOpen = false,
    openSidebar,
  } = useOutletContext<AppShellOutletContext>();

  return (
    <AgentWorkspace
      mode="report"
      sidebarOpen={sidebarOpen}
      onSidebarOpen={openSidebar}
    />
  );
}
