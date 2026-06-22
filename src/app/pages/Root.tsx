import { Outlet } from 'react-router';
import TopNavigation from '../components/TopNavigation';

export default function Root() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-gray-50">
      <div className="shrink-0">
        <TopNavigation />
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
