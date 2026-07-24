import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { AppHeader } from '../components/AppHeader';
import { AppShellBackground } from '../components/AppShellBackground';
import { ConversationHistorySidebar } from '../components/ConversationHistorySidebar';
import { PrimaryIconNav } from '../components/PrimaryIconNav';
import { useWorkspace } from '../context/WorkspaceContext';

export default function Root() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    activeConversationIds,
    deleteConversation,
    getConversationsForWorkspace,
    renameConversation,
    setActiveConversationForWorkspace,
  } = useWorkspace();
  const navigationState = location.state as {
    historyOpen?: boolean;
    sidebarOpen?: boolean;
    sidebarUserAdjusted?: boolean;
  } | null;
  const requestedSidebarOpen = typeof navigationState?.sidebarOpen === 'boolean'
    ? navigationState.sidebarOpen
    : navigationState?.historyOpen;
  const requestedSidebarUserAdjusted = typeof navigationState?.sidebarUserAdjusted === 'boolean'
    ? navigationState.sidebarUserAdjusted
    : typeof requestedSidebarOpen === 'boolean'
      ? true
      : undefined;
  const isHome = location.pathname === '/home';
  const isLogin = location.pathname === '/';
  const isReportWorkspace = location.pathname === '/report';
  const isWorkspacePage = location.pathname === '/ask' || location.pathname === '/report';
  const isConversationPage = isHome || isWorkspacePage;
  const defaultSidebarOpen = !isHome && !isReportWorkspace;
  const [sidebarState, setSidebarState] = useState(() => ({
    open: typeof requestedSidebarOpen === 'boolean'
      ? requestedSidebarOpen
      : defaultSidebarOpen,
    userAdjusted: requestedSidebarUserAdjusted ?? false,
    locationKey: location.key,
  }));
  const sidebarUserAdjusted = sidebarState.locationKey === location.key
    ? sidebarState.userAdjusted
    : requestedSidebarUserAdjusted ?? sidebarState.userAdjusted;
  const sidebarOpen = sidebarState.locationKey === location.key
    ? sidebarState.open
    : typeof requestedSidebarOpen === 'boolean'
      ? requestedSidebarOpen
      : sidebarUserAdjusted
        ? sidebarState.open
        : defaultSidebarOpen;
  const historyConversations = [
    ...getConversationsForWorkspace('ask'),
    ...getConversationsForWorkspace('report'),
  ];
  const selectedConversationId = isReportWorkspace
    ? activeConversationIds.report
    : activeConversationIds.ask;
  const sidebarRuntimeRef = useRef({
    activeConversationIds,
    deleteConversation,
    historyConversations,
    locationKey: location.key,
    locationPathname: location.pathname,
    renameConversation,
    setActiveConversationForWorkspace,
    sidebarOpen,
  });
  sidebarRuntimeRef.current = {
    activeConversationIds,
    deleteConversation,
    historyConversations,
    locationKey: location.key,
    locationPathname: location.pathname,
    renameConversation,
    setActiveConversationForWorkspace,
    sidebarOpen,
  };

  const handleNewConversation = useCallback(() => {
    const currentPathname = sidebarRuntimeRef.current.locationPathname;
    const workspaceType = currentPathname === '/report' ? 'report' : 'ask';

    navigate('/home', {
      state: {
        historyOpen: true,
        sidebarOpen: true,
        sidebarUserAdjusted: true,
        resetConversationWorkspace: workspaceType,
      },
    });
  }, [navigate]);

  const handleSelectConversation = useCallback((conversationId: string) => {
    const runtime = sidebarRuntimeRef.current;
    const conversation = runtime.historyConversations.find((item) => item.id === conversationId);
    const targetMode = conversation?.workspaceType === 'report' ? 'report' : 'ask';

    runtime.setActiveConversationForWorkspace(targetMode, conversationId);
    navigate(targetMode === 'report' ? '/report' : '/ask', {
      state: { sidebarOpen: true, sidebarUserAdjusted: true },
    });
  }, [navigate]);

  const handleRenameConversation = useCallback((conversationId: string, title: string) => {
    sidebarRuntimeRef.current.renameConversation(conversationId, title);
  }, []);

  const handleDeleteConversation = useCallback((conversationId: string) => {
    const runtime = sidebarRuntimeRef.current;
    const deletingAskConversation = runtime.activeConversationIds.ask === conversationId;
    const deletingReportConversation = runtime.activeConversationIds.report === conversationId;

    if (deletingAskConversation) {
      runtime.setActiveConversationForWorkspace('ask', null);
    }
    if (deletingReportConversation) {
      runtime.setActiveConversationForWorkspace('report', null);
    }

    runtime.deleteConversation(conversationId);

    if (
      (runtime.locationPathname === '/ask' && deletingAskConversation)
      || (runtime.locationPathname === '/report' && deletingReportConversation)
    ) {
      navigate('/home', {
        state: {
          historyOpen: true,
          sidebarOpen: true,
          sidebarUserAdjusted: true,
        },
      });
    }

    return false;
  }, [navigate]);

  const handleCollapseSidebar = useCallback(() => {
    setSidebarState({
      open: false,
      userAdjusted: true,
      locationKey: sidebarRuntimeRef.current.locationKey,
    });
  }, []);

  const handleDefaultSidebarOpenChange = useCallback((open: boolean) => {
    if (sidebarUserAdjusted) return;

    setSidebarState({
      open,
      userAdjusted: false,
      locationKey: location.key,
    });
  }, [location.key, sidebarUserAdjusted]);

  useEffect(() => {
    if (sidebarState.locationKey === location.key) return;

    setSidebarState({
      open: sidebarOpen,
      userAdjusted: sidebarUserAdjusted,
      locationKey: location.key,
    });
  }, [location.key, sidebarOpen, sidebarState.locationKey, sidebarUserAdjusted]);

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
            newConversationLabel="新对话"
            historyLabel="历史对话"
            onNewConversation={handleNewConversation}
            onSelectConversation={handleSelectConversation}
            onRenameConversation={handleRenameConversation}
            onDeleteConversation={handleDeleteConversation}
            onCollapse={handleCollapseSidebar}
          />
        ) : null}
        <main className={`min-h-0 min-w-0 flex-1 overflow-hidden rounded-tl-[20px] rounded-tr-[20px] ${isWorkspacePage ? 'bg-transparent pb-0' : 'bg-white pb-[34px]'}`}>
          <Outlet
            context={{
              sidebarOpen,
              sidebarUserAdjusted,
              openSidebar: () => setSidebarState({
                open: true,
                userAdjusted: true,
                locationKey: location.key,
              }),
              closeSidebar: () => setSidebarState({
                open: false,
                userAdjusted: true,
                locationKey: location.key,
              }),
              setDefaultSidebarOpen: handleDefaultSidebarOpenChange,
            }}
          />
        </main>
      </div>
    </>
  );
}
