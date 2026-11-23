import { lazy, Suspense, useCallback, useState } from 'react';
import { Briefing } from '../features/briefing/Briefing';
import { Chat } from '../features/chat/Chat';
import { InfoPage } from '../features/info/InfoPage';
import { Lobby } from './Lobby';
import { MailPage } from '../features/mail/MailPage';
import { MemoryPage } from '../features/memory/MemoryPage';
import { NewsPage } from '../features/news/NewsPage';
import { useNewsNotify } from '../features/news/useNewsNotify';
import { Schedule } from '../features/schedule/Schedule';
import { SettingsPage } from '../features/settings/SettingsPage';
import { getBackendUrl, isNative } from '../shared/backend';
import { ShortcutHelp, useGlobalShortcuts } from './Shortcuts';

/** 폰 감시: QR 라이브러리 포함 */
const PhonePage = lazy(() => import('../features/phone/PhonePage').then((m) => ({ default: m.PhonePage })));

/** 공부 집중: mediapipe 포함, 필요할 때만 로드 */
const StudyPage = lazy(() => import('../features/study/pages/StudyView').then((m) => ({ default: m.StudyPage })));

export type PageId = 'lobby' | 'chat' | 'schedule' | 'mail' | 'settings' | 'briefing' | 'memory' | 'study' | 'phone' | 'info' | 'news';

function Page(props: { page: PageId; go: (p: PageId) => void }) {
  const { page, go } = props;
  const back = () => go('lobby');
  switch (page) {
    case 'chat':
      return <Chat onBack={back} onSettings={() => go('settings')} onMemory={() => go('memory')} />;
    case 'memory':
      return <MemoryPage onBack={back} />;
    case 'settings':
      return <SettingsPage onBack={back} />;
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
    default:
      return <Lobby onNavigate={go} />;
  }
}

export function App() {
  // Android 앱 첫 실행: 폰 설정부터
  const [page, setPage] = useState<PageId>(() => (isNative() && !getBackendUrl() ? 'phone' : 'lobby'));
  const { help, closeHelp } = useGlobalShortcuts(setPage);
  useNewsNotify(useCallback(() => setPage('news'), []));
  return (
    <>
      <Page page={page} go={setPage} />
      {help && <ShortcutHelp onClose={closeHelp} />}
    </>
  );
}
