import { ArrowRight, Menu, Sparkles, X } from 'lucide-react';
import { useState } from 'react';

const LINKS = [
  ['about', 'About'],
  ['features', 'Features'],
  ['technology', 'Technology'],
] as const;

export function NavBar(props: { scrolled: boolean; onJump: (id: string) => void; onEnter: () => void }) {
  const [open, setOpen] = useState(false);
  const jump = (id: string) => {
    setOpen(false);
    props.onJump(id);
  };
  return (
    <header className={`lp-nav${props.scrolled ? ' scrolled' : ''}${open ? ' open' : ''}`}>
      <div className="lp-nav-in">
        <button className="lp-brand" onClick={() => jump('top')} aria-label="맨 위로">
          <span className="lp-mark">
            <Sparkles size={16} />
          </span>
          AI Secretary
        </button>
        <nav className="lp-links" aria-label="섹션">
          {LINKS.map(([id, label]) => (
            <button key={id} onClick={() => jump(id)}>
              {label}
            </button>
          ))}
          <button onClick={props.onEnter} title="계정 기능 없음. 로컬 단일 사용자 — 바로 입장">
            Login
          </button>
          <button className="lp-btn primary sm" onClick={props.onEnter}>
            Get Started <ArrowRight size={14} />
          </button>
        </nav>
        <button className="lp-burger" onClick={() => setOpen((v) => !v)} aria-label="메뉴" aria-expanded={open}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
    </header>
  );
}
