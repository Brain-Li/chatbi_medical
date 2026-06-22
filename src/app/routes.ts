import { createBrowserRouter, redirect } from 'react-router';
import Root from './pages/Root';
import ChatPage from './pages/ChatPage';
import ReportPage from './pages/ReportPage';
import ReportPreviewPage from './pages/ReportPreviewPage';
import SystemSettings from './pages/SystemSettings';
import AssistantEditor from './pages/AssistantEditor';

function redirectSemanticToSettings(request: Request) {
  const url = new URL(request.url);
  const tab = url.searchParams.get('tab');
  const datasetId = url.searchParams.get('datasetId');
  const section =
    tab === 'dimensions'
      ? 'dimensions'
      : tab === 'synonyms'
        ? 'synonyms'
        : 'datasets';
  const target = new URLSearchParams({ section });

  if (datasetId && section === 'datasets') {
    target.set('datasetId', datasetId);
  }

  return redirect(`/settings?${target.toString()}`);
}

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Root,
    children: [
      { index: true, Component: ChatPage },
      { path: 'report', Component: ReportPage },
      { path: 'report/preview/:id', Component: ReportPreviewPage },
      { path: 'root-cause', loader: () => redirect('/') },
      { path: 'indicator', loader: () => redirect('/settings?section=indicators') },
      {
        path: 'indicator/:id',
        loader: ({ params }) => redirect(`/settings?section=indicators&indicatorId=${params.id ?? ''}`),
      },
      { path: 'semantic', loader: ({ request }) => redirectSemanticToSettings(request) },
      { path: 'datasets', loader: () => redirect('/settings?section=datasets') },
      {
        path: 'datasets/:id',
        loader: ({ params }) => redirect(`/settings?section=datasets&datasetId=${params.id ?? ''}`),
      },
      { path: 'settings', Component: SystemSettings },
      { path: 'assistant-editor', Component: AssistantEditor },
      { path: 'assistant-editor/:id', Component: AssistantEditor },
    ],
  },
]);
