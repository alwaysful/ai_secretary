import { useState } from 'react';
import { Briefing } from './Briefing';
import { Chat } from './Chat';
import { Lobby } from './Lobby';
import { MemoryPage } from './MemoryPage';
import { MailPage } from './MailPage';
import { Schedule } from './Schedule';
import { SettingsPage } from './SettingsPage';

export type PageId = 'lobby' | 'chat' | 'schedule' | 'mail' | 'settings' | 'briefing' | 'memory';

export function App() {
  const [page, setPage] = useState<PageId>('lobby');
  const back = () => setPage('lobby');

  switch (page) {
    case 'chat':
      return <Chat onBack={back} onSettings={() => setPage('settings')} onMemory={() => setPage('memory')} />;
    case 'memory':
      return <MemoryPage onBack={back} />;
    case 'settings':
      return <SettingsPage onBack={back} />;
    case 'briefing':
      return <Briefing onBack={back} />;
    case 'schedule':
      return <Schedule onBack={back} />;
    case 'mail':
      return <MailPage onBack={back} />;
    default:
      return <Lobby onNavigate={setPage} />;
  }
}
