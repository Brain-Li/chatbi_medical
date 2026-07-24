import { createBrowserRouter, redirect } from 'react-router';
import LoginPage from './pages/LoginPage';
import { hasDemoAuthSession } from './utils/demoAuth';
import Root from './pages/Root';
import HomePage from './pages/HomePage';
import ChatPage from './pages/ChatPage';
import ReportPage from './pages/ReportPage';
import ReportPreviewPage from './pages/ReportPreviewPage';
import ReportSubscriptionsPage from './pages/ReportSubscriptionsPage';
import SystemSettings from './pages/SystemSettings';
import AssistantEditor from './pages/AssistantEditor';
import TemplatesPage from './pages/TemplatesPage';

function requireLogin() {
  if (hasDemoAuthSession()) {
    return null;
  }

  return redirect('/');
}

function redirectSemanticToSettings(request: Request) {
  const authRedirect = requireLogin();
  if (authRedirect) return authRedirect;

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
      { index: true, Component: LoginPage },
      { path: 'home', Component: HomePage, loader: requireLogin },
      { path: 'ask', Component: ChatPage, loader: requireLogin },
      { path: 'report', Component: ReportPage, loader: requireLogin },
      { path: 'report/case/:id', Component: ReportPreviewPage },
      { path: 'report/preview/:id', Component: ReportPreviewPage, loader: requireLogin },
      { path: 'report-subscriptions', Component: ReportSubscriptionsPage, loader: requireLogin },
      { path: 'templates', Component: TemplatesPage, loader: requireLogin },
      { path: 'root-cause', loader: () => requireLogin() ?? redirect('/home') },
      { path: 'indicator', loader: () => requireLogin() ?? redirect('/settings?section=indicators') },
      {
        path: 'indicator/:id',
        loader: ({ params }) => requireLogin() ?? redirect(`/settings?section=indicators&indicatorId=${params.id ?? ''}`),
      },
      { path: 'semantic', loader: ({ request }) => redirectSemanticToSettings(request) },
      { path: 'datasets', loader: () => requireLogin() ?? redirect('/settings?section=datasets') },
      {
        path: 'datasets/:id',
        loader: ({ params }) => requireLogin() ?? redirect(`/settings?section=datasets&datasetId=${params.id ?? ''}`),
      },
      { path: 'settings', Component: SystemSettings, loader: requireLogin },
      { path: 'assistant-editor', Component: AssistantEditor, loader: requireLogin },
      { path: 'assistant-editor/:id', Component: AssistantEditor, loader: requireLogin },
    ],
  },
]);
