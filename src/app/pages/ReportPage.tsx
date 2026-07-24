import { useOutletContext } from 'react-router';
import AgentWorkspace from '../components/AgentWorkspace';

type AppShellOutletContext = {
  sidebarOpen?: boolean;
  sidebarUserAdjusted?: boolean;
  openSidebar?: () => void;
  closeSidebar?: () => void;
  setDefaultSidebarOpen?: (open: boolean) => void;
};

export default function ReportPage() {
  const {
    sidebarOpen = false,
    sidebarUserAdjusted = false,
    openSidebar,
    setDefaultSidebarOpen,
  } = useOutletContext<AppShellOutletContext>();

  return (
    <AgentWorkspace
      mode="report"
      sidebarOpen={sidebarOpen}
      sidebarUserAdjusted={sidebarUserAdjusted}
      onSidebarOpen={openSidebar}
      onDefaultSidebarOpenChange={setDefaultSidebarOpen}
    />
  );
}
