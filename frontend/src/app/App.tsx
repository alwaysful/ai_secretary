import { lazy, Suspense, useState } from 'react';
import { Briefing } from '../features/briefing/Briefing';
import { Chat } from '../features/chat/Chat';
import { Lobby } from './Lobby';
import { MailPage } from '../features/mail/MailPage';
import { PhonePage } from '../features/phone/PhonePage';
import { MemoryPage } from '../features/memory/MemoryPage';
import { Schedule } from '../features/schedule/Schedule';
import { SettingsPage } from '../features/settings/SettingsPage';
import { ShortcutHelp, useGlobalShortcuts } from './Shortcuts';

/** 공부 집중: mediapipe 포함, 필요할 때만 로드 */
const StudyPage = lazy(() => import('../features/study/pages/StudyView').then((m) => ({ default: m.StudyPage })));

export type PageId = 'lobby' | 'chat' | 'schedule' | 'mail' | 'settings' | 'briefing' | 'memory' | 'study' | 'phone';

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
      return <PhonePage onBack={back} />;
    case 'mail':
      return <MailPage onBack={back} />;
    default:
      return <Lobby onNavigate={go} />;
  }
}

export function App() {
  const [page, setPage] = useState<PageId>('lobby');
  const { help, closeHelp } = useGlobalShortcuts(setPage);
  return (
    <>
      <Page page={page} go={setPage} />
      {help && <ShortcutHelp onClose={closeHelp} />}
    </>
  );
}
