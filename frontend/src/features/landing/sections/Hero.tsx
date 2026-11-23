import { ArrowRight, Brain, CalendarDays, Mail, MessageSquare, Newspaper } from 'lucide-react';

const ORBIT = [
  { Icon: MessageSquare, label: 'Chat' },
  { Icon: Brain, label: 'Memory' },
  { Icon: CalendarDays, label: 'Calendar' },
  { Icon: Mail, label: 'Mail' },
  { Icon: Newspaper, label: 'News' },
];

export function Hero(props: { onEnter: () => void; onLearn: () => void }) {
  return (
    <section className="lp-hero" id="about">
      <div className="lp-hero-copy" data-reveal>
        <span className="lp-pill">
          <span className="lp-pulse" /> Personal AI Secretary
        </span>
        <h1>
          Your world,
          <br />
          <span className="lp-grad">intelligently connected.</span>
        </h1>
        <p className="lp-sub">An AI that understands, remembers, and acts.</p>
        <p className="lp-ko">당신을 이해하고, 기억하며, 직접 행동하는 개인형 AI 비서.</p>
        <div className="lp-cta-row">
          <button className="lp-btn primary" onClick={props.onEnter}>
            Get Started <ArrowRight size={16} />
          </button>
          <button className="lp-btn ghost" onClick={props.onLearn}>
            Learn More
          </button>
        </div>
      </div>
      <div className="lp-hero-art" data-reveal aria-hidden="true">
        <div className="lp-core">
          <div className="lp-ring r1" />
          <div className="lp-ring r2" />
          <div className="lp-ring r3" />
          <div className="lp-core-dot">
            <span>AI</span>
          </div>
          {ORBIT.map(({ Icon, label }, i) => (
            <div key={label} className="lp-sat" style={{ ['--i' as string]: i, ['--n' as string]: ORBIT.length }}>
              <span className="lp-sat-in">
                <Icon size={16} />
                <small>{label}</small>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
