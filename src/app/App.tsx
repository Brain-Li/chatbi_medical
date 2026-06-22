import { RouterProvider } from 'react-router';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { Toaster } from './components/ui/sonner';
import { router } from './routes';

export default function App() {
  return (
    <WorkspaceProvider>
      <RouterProvider router={router} />
      <Toaster position="top-center" richColors closeButton />
    </WorkspaceProvider>
  );
}
