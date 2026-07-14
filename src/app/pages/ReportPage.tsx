import { useOutletContext } from 'react-router';
import AgentWorkspace from '../components/AgentWorkspace';

type AppShellOutletContext = {
  sidebarOpen?: boolean;
};

export default function ReportPage() {
  const { sidebarOpen = true } = useOutletContext<AppShellOutletContext>();

  return <AgentWorkspace mode="report" sidebarOpen={sidebarOpen} />;
}
