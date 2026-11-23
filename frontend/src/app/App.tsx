import { lazy, Suspense, useCallback, useState } from 'react';
import { Briefing } from '../features/briefing/Briefing';
import { Chat } from '../features/chat/Chat';
import { InfoPage } from '../features/info/InfoPage';
import { landingSeen } from '../features/landing/seen';
import { Lobby } from './Lobby';
import { MailPage } from '../features/mail/MailPage';
import { ModelsPage } from '../features/models/ModelsPage';
import { MemoryPage } from '../features/memory/MemoryPage';
import { NewsPage } from '../features/news/NewsPage';
import { useNewsNotify } from '../features/news/useNewsNotify';
import { Schedule } from '../features/schedule/Schedule';
import { SettingsPage } from '../features/settings/SettingsPage';
import { PcControlPage } from '../features/pc/PcControlPage';
import { PcRunBar } from '../features/pc/PcRunBar';
import { ToolsPage } from '../features/tools/ToolsPage';
import { getBackendUrl, isNative } from '../shared/backend';
import { ShortcutHelp, useGlobalShortcuts } from './Shortcuts';

/** 랜딩: 아이콘·그래픽 포함, 필요할 때만 로드 */
const Landing = lazy(() => import('../features/landing/Landing').then((m) => ({ default: m.Landing })));

/** 폰 감시: QR 라이브러리 포함 */
const PhonePage = lazy(() => import('../features/phone/PhonePage').then((m) => ({ default: m.PhonePage })));

/** 공부 집중: mediapipe 포함, 필요할 때만 로드 */
const StudyPage = lazy(() => import('../features/study/pages/StudyView').then((m) => ({ default: m.StudyPage })));

export type PageId = 'lobby' | 'chat' | 'schedule' | 'mail' | 'settings' | 'briefing' | 'memory' | 'study' | 'phone' | 'info' | 'news' | 'landing' | 'models' | 'pc' | 'tools';

function Page(props: { page: PageId; go: (p: PageId) => void }) {
  const { page, go } = props;
  const back = () => go('lobby');
  switch (page) {
    case 'chat':
      return <Chat onBack={back} onSettings={() => go('settings')} onMemory={() => go('memory')} />;
    case 'memory':
      return <MemoryPage onBack={back} />;
    case 'settings':
      return <SettingsPage onBack={back} onModels={() => go('models')} />;
    case 'models':
      return <ModelsPage onBack={back} onSettings={() => go('settings')} />;
    case 'briefing':
      return <Briefing onBack={back} />;
    case 'schedule':
      return <Schedule onBack={back} />;
    case 'study':
      return (
        <Suspense fallback={null}>
          <StudyPage onBack={back} />
        </Suspense>
      );
    case 'phone':
      return (
        <Suspense fallback={null}>
          <PhonePage onBack={back} />
        </Suspense>
      );
    case 'info':
      return <InfoPage onBack={back} onNavigate={go} />;
    case 'news':
      return <NewsPage onBack={back} />;
    case 'mail':
      return <MailPage onBack={back} />;
    case 'pc':
      return <PcControlPage onBack={back} />;
    case 'tools':
      return <ToolsPage onBack={back} />;
    case 'landing':
      return (
        <Suspense fallback={null}>
          <Landing onEnter={back} onInfo={() => go('info')} />
        </Suspense>
      );
    default:
      return <Lobby onNavigate={go} />;
  }
}

export function App() {
  // Android 앱 첫 실행: 폰 설정부터
  // 웹 첫 방문 또는 #landing: 랜딩 페이지부터
  const [page, setPage] = useState<PageId>(() => {
    if (isNative()) return getBackendUrl() ? 'lobby' : 'phone';
    return location.hash === '#landing' || !landingSeen() ? 'landing' : 'lobby';
  });
  const { help, closeHelp } = useGlobalShortcuts(setPage);
  useNewsNotify(useCallback(() => setPage('news'), []));
  return (
    <>
      <PcRunBar onOpen={() => setPage('pc')} hidden={page === 'pc'} />
      <Page page={page} go={setPage} />
      {help && <ShortcutHelp onClose={closeHelp} />}
    </>
  );
}
