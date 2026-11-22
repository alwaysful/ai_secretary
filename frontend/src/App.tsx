import { useState } from 'react';
import { Chat } from './Chat';
import { Lobby } from './Lobby';
import { MailPage } from './MailPage';
import { Schedule } from './Schedule';

export type PageId = 'lobby' | 'chat' | 'schedule' | 'mail';

export function App() {
  const [page, setPage] = useState<PageId>('lobby');
  const back = () => setPage('lobby');

  switch (page) {
    case 'chat':
      return <Chat onBack={back} />;
    case 'schedule':
      return <Schedule onBack={back} />;
    case 'mail':
      return <MailPage onBack={back} />;
    default:
      return <Lobby onNavigate={setPage} />;
  }
}
