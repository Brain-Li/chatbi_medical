import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { AppHeader } from '../components/AppHeader';
import { AppShellBackground } from '../components/AppShellBackground';
import { ConversationHistorySidebar } from '../components/ConversationHistorySidebar';
import { PrimaryIconNav } from '../components/PrimaryIconNav';
import { useWorkspace } from '../context/WorkspaceContext';
import LicenseBoundary from '../components/LicenseBoundary';
import { guardLicense } from '../license/service';
import { toast } from 'sonner';
import { ConversationArchiveToast } from '../components/ConversationArchiveToast';
import { getConversationWorkspaceName, type HistoryFilter } from '../utils/conversationHistoryStorage';

export default function Root() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    activeConversationIds,
    activeWorkspaceName,
    setActiveWorkspaceName,
    createConversation,
    getConversationsForWorkspace,
    renameConversation,
    setConversationArchived,
    setActiveConversationForWorkspace,
  } = useWorkspace();
  const isHome = location.pathname === '/home';
  const isLogin = location.pathname === '/';
  const isReportWorkspace = location.pathname === '/report';
  const isAutomationsPage = location.pathname === '/automations';
  const isWorkspacePage = location.pathname === '/ask' || location.pathname === '/report';
  const isConversationPage = isHome || isWorkspacePage || isAutomationsPage;
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    location.pathname === '/ask' || location.pathname === '/automations' || (location.pathname === '/home' && Boolean(location.state?.conversationId)),
  );
  const [historyFilterRequest, setHistoryFilterRequest] = useState<{ sequence: number; filter: HistoryFilter } | null>(null);
  const historyConversations = [
    ...getConversationsForWorkspace('ask'),
    ...getConversationsForWorkspace('report'),
  ];
  const homeConversation = isHome ? historyConversations.find((conversation) =>
    conversation.id === location.state?.conversationId
    && getConversationWorkspaceName(conversation) === activeWorkspaceName
    && !conversation.isArchived
    && !conversation.messages.some((message) => message.role === 'user'),
  ) : undefined;
  const selectedConversationId = isHome ? homeConversation?.id ?? null : isReportWorkspace
    ? activeConversationIds.report
    : activeConversationIds.ask;
  const sidebarRuntimeRef = useRef({
    activeConversationIds,
    createConversation,
    historyConversations,
    homeConversationId: homeConversation?.id,
    locationPathname: location.pathname,
    renameConversation,
    setConversationArchived,
    setActiveConversationForWorkspace,
    setActiveWorkspaceName,
  });
  sidebarRuntimeRef.current = {
    activeConversationIds,
    createConversation,
    historyConversations,
    homeConversationId: homeConversation?.id,
    locationPathname: location.pathname,
    renameConversation,
    setConversationArchived,
    setActiveConversationForWorkspace,
    setActiveWorkspaceName,
  };

  const handleNewConversation = useCallback((workspaceName?: string) => {
    if (workspaceName) {
      const runtime = sidebarRuntimeRef.current;
      const emptyConversations = runtime.historyConversations.filter((conversation) =>
        getConversationWorkspaceName(conversation) === workspaceName
        && conversation.title === '新会话'
        && !conversation.isArchived
        && !conversation.agentId
        && conversation.messages.length === 0,
      );
      const existing = emptyConversations.find(({ id }) => id === runtime.homeConversationId) ?? emptyConversations[0];
      runtime.setActiveWorkspaceName(workspaceName);
      setHistoryFilterRequest((current) => ({ sequence: (current?.sequence ?? 0) + 1, filter: 'all' }));
      setSidebarOpen(true);
      if (existing) {
        if (existing.id === runtime.homeConversationId) return;
        runtime.setActiveConversationForWorkspace(existing.workspaceType, existing.id);
      }
      const conversation = existing ?? runtime.createConversation('ask', '新会话', undefined, workspaceName);
      navigate('/home', { state: { conversationId: conversation.id, resetHomeComposer: true } });
      return;
    }
    const currentPathname = sidebarRuntimeRef.current.locationPathname;
    const workspaceType = currentPathname === '/report' ? 'report' : 'ask';

    navigate('/home', {
      state: {
        resetConversationWorkspace: workspaceType,
      },
    });
  }, [navigate]);

  const handleSelectConversation = useCallback((conversationId: string) => {
    const runtime = sidebarRuntimeRef.current;
    const conversation = runtime.historyConversations.find((item) => item.id === conversationId);
    if (!conversation) return;
    const targetMode = conversation.workspaceType === 'report' ? 'report' : 'ask';

    runtime.setActiveWorkspaceName(getConversationWorkspaceName(conversation));
    runtime.setActiveConversationForWorkspace(targetMode, conversationId);
    if (!conversation.isArchived && !conversation.agentId && !conversation.messages.some((message) => message.role === 'user')) {
      navigate('/home', { state: { conversationId, resetHomeComposer: true } });
      return;
    }
    navigate(targetMode === 'report' ? '/report' : '/ask');
  }, [navigate]);

  const handleRenameConversation = useCallback((conversationId: string, title: string) => {
    if (!guardLicense('configure')) return;
    sidebarRuntimeRef.current.renameConversation(conversationId, title);
  }, []);

  const handleArchiveConversation = useCallback((conversationId: string, isArchived: boolean) => {
    if (!guardLicense('configure')) return;
    const runtime = sidebarRuntimeRef.current;
    const conversation = runtime.historyConversations.find((item) => item.id === conversationId);
    if (!conversation || Boolean(conversation.isArchived) === isArchived) return;
    const archivingCurrentConversation = isArchived && (
      (runtime.locationPathname === '/ask' && runtime.activeConversationIds.ask === conversationId)
      || (runtime.locationPathname === '/report' && runtime.activeConversationIds.report === conversationId)
    );
    runtime.setConversationArchived(conversationId, isArchived);
    if (archivingCurrentConversation) navigate('/home');
    if (!isArchived) return;

    toast.custom((toastId) => (
      <ConversationArchiveToast
        onUndo={() => {
          if (!guardLicense('configure')) return;
          const currentRuntime = sidebarRuntimeRef.current;
          if (!currentRuntime.historyConversations.some((item) => item.id === conversationId)) {
            toast.dismiss(toastId);
            return;
          }
          currentRuntime.setConversationArchived(conversationId, false);
          setHistoryFilterRequest((current) => ({ sequence: (current?.sequence ?? 0) + 1, filter: 'all' }));
          if (archivingCurrentConversation && currentRuntime.locationPathname === '/home') {
            const mode = conversation.workspaceType === 'report' ? 'report' : 'ask';
            currentRuntime.setActiveConversationForWorkspace(mode, conversationId);
            navigate(mode === 'report' ? '/report' : '/ask');
          }
          toast.dismiss(toastId);
        }}
        onShowArchived={() => {
          setSidebarOpen(true);
          setHistoryFilterRequest((current) => ({ sequence: (current?.sequence ?? 0) + 1, filter: 'all-with-archived' }));
          const pathname = sidebarRuntimeRef.current.locationPathname;
          if (!['/home', '/ask', '/report'].includes(pathname)) navigate('/home');
          toast.dismiss(toastId);
        }}
      />
    ), { id: 'conversation-archive', duration: 8000, position: 'top-center' });
  }, [navigate]);

  const handleCollapseSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  useEffect(() => {
    if (!isHome) {
      window.scrollTo(0, 0);
    }
  }, [isHome, location.pathname]);

  if (isLogin) {
    return <Outlet />;
  }

  return (
    <>
      <div className="fixed inset-0 z-0 overflow-hidden bg-white">
        <AppShellBackground />
      </div>
      <div className="fixed inset-x-0 top-0 z-50">
        <AppHeader />
      </div>
      <div className="fixed inset-0 z-10 flex min-h-0 pt-[54px]">
        <PrimaryIconNav />
        {isConversationPage && sidebarOpen ? (
          <ConversationHistorySidebar
            conversations={historyConversations}
            selectedConversationId={selectedConversationId}
            newConversationLabel="新会话"
            onNewConversation={handleNewConversation}
            onSelectConversation={handleSelectConversation}
            onRenameConversation={handleRenameConversation}
            onArchiveConversation={handleArchiveConversation}
            filterRequest={historyFilterRequest}
            onCollapse={handleCollapseSidebar}
          />
        ) : null}
        <main className={`min-h-0 min-w-0 flex-1 overflow-hidden rounded-tl-[20px] rounded-tr-[20px] ${isWorkspacePage ? 'bg-transparent pb-0' : 'bg-white pb-[34px]'}`}>
          <LicenseBoundary><Outlet
            context={{
              sidebarOpen,
              openSidebar: () => setSidebarOpen(true),
              onNewConversation: handleNewConversation,
            }}
          /></LicenseBoundary>
        </main>
      </div>
    </>
  );
}
