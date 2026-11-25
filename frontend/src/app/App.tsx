import { lazy, Suspense, useCallback, useState } from 'react';
import { landingSeen } from '../features/landing/seen';
import { guideDone } from '../features/guide/seen';
import { Lobby } from './Lobby';
import { useNewsNotify } from '../features/news/useNewsNotify';
import { PcRunBar } from '../features/pc/PcRunBar';
import { getBackendUrl, isNative } from '../shared/backend';
import { ShortcutHelp, useGlobalShortcuts } from './Shortcuts';

/** 탭 화면: 로비 빼고 전부 필요할 때만 로드 */
const Briefing = lazy(() => import('../features/briefing/Briefing').then((m) => ({ default: m.Briefing })));
const Chat = lazy(() => import('../features/chat/Chat').then((m) => ({ default: m.Chat })));
const InfoPage = lazy(() => import('../features/info/InfoPage').then((m) => ({ default: m.InfoPage })));
const GuidePage = lazy(() => import('../features/guide/GuidePage').then((m) => ({ default: m.GuidePage })));
const MailPage = lazy(() => import('../features/mail/MailPage').then((m) => ({ default: m.MailPage })));
const ModelsPage = lazy(() => import('../features/models/ModelsPage').then((m) => ({ default: m.ModelsPage })));
const MemoryPage = lazy(() => import('../features/memory/MemoryPage').then((m) => ({ default: m.MemoryPage })));
const NewsPage = lazy(() => import('../features/news/NewsPage').then((m) => ({ default: m.NewsPage })));
const Schedule = lazy(() => import('../features/schedule/Schedule').then((m) => ({ default: m.Schedule })));
const SettingsPage = lazy(() => import('../features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const PcControlPage = lazy(() => import('../features/pc/PcControlPage').then((m) => ({ default: m.PcControlPage })));
const ToolsPage = lazy(() => import('../features/tools/ToolsPage').then((m) => ({ default: m.ToolsPage })));
const StatsPage = lazy(() => import('../features/stats/StatsPage').then((m) => ({ default: m.StatsPage })));
const CertPage = lazy(() => import('../features/certs/CertPage').then((m) => ({ default: m.CertPage })));
const TtsPage = lazy(() => import('../features/tts/TtsPage').then((m) => ({ default: m.TtsPage })));
const Landing = lazy(() => import('../features/landing/Landing').then((m) => ({ default: m.Landing })));
const PhonePage = lazy(() => import('../features/phone/PhonePage').then((m) => ({ default: m.PhonePage })));
const AdminPage = lazy(() => import('../features/admin/AdminPage').then((m) => ({ default: m.AdminPage })));
const CompanionPage = lazy(() => import('../features/companion/CompanionPage').then((m) => ({ default: m.CompanionPage })));
const VocabPage = lazy(() => import('../features/vocab/VocabPage').then((m) => ({ default: m.VocabPage })));
const StudyPage = lazy(() => import('../features/study/pages/StudyView').then((m) => ({ default: m.StudyPage })));

export type PageId = 'lobby' | 'chat' | 'schedule' | 'mail' | 'settings' | 'briefing' | 'memory' | 'study' | 'phone' | 'info' | 'news' | 'landing' | 'models' | 'pc' | 'tools' | 'stats' | 'guide' | 'admin' | 'tts' | 'companion' | 'certs' | 'vocab';

function Page(props: { page: PageId; go: (p: PageId) => void }) {
  const { page, go } = props;
  const back = () => go('lobby');
  switch (page) {
    case 'chat':
      return <Chat onBack={back} onSettings={() => go('settings')} onMemory={() => go('memory')} />;
    case 'memory':
      return <MemoryPage onBack={back} />;
    case 'settings':
      return <SettingsPage onBack={back} onModels={() => go('models')} onAdmin={() => go('admin')} onVocab={() => go('vocab')} />;
    case 'models':
      return <ModelsPage onBack={back} onSettings={() => go('settings')} />;
    case 'briefing':
      return <Briefing onBack={back} />;
    case 'schedule':
      return <Schedule onBack={back} />;
    case 'study':
      return <StudyPage onBack={back} />;
    case 'vocab':
      return <VocabPage onBack={back} />;
    case 'phone':
      return <PhonePage onBack={back} />;
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
    case 'stats':
      return <StatsPage onBack={back} />;
    case 'certs':
      return <CertPage onBack={back} />;
    case 'admin':
      return <AdminPage onBack={back} onNavigate={go} />;
    case 'tts':
      return <TtsPage onBack={back} onSettings={() => go('settings')} />;
    case 'companion':
      return <CompanionPage onBack={back} onSettings={() => go('settings')} onMemory={() => go('memory')} />;
    case 'guide':
      return <GuidePage onBack={back} onNavigate={go} />;
    case 'landing':
      return <Landing onEnter={() => go(guideDone() ? 'lobby' : 'guide')} onInfo={() => go('info')} />;
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
      <Suspense fallback={null}>
        <Page page={page} go={setPage} />
      </Suspense>
      {help && <ShortcutHelp onClose={closeHelp} />}
    </>
  );
}
