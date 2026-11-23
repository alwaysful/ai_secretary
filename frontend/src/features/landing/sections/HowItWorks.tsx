import { Brain, Ear, Route, Zap } from 'lucide-react';
import { STEPS } from '../content';

const ICONS = [Ear, Brain, Route, Zap];

export function HowItWorks() {
  return (
    <section className="lp-section" id="how">
      <header className="lp-head" data-reveal>
        <span className="lp-eyebrow">How It Works</span>
        <h2>이해에서 실행까지, 네 단계.</h2>
      </header>
      <ol className="lp-steps">
        {STEPS.map((s, i) => {
          const Icon = ICONS[i];
          return (
            <li key={s.key} data-reveal style={{ transitionDelay: `${i * 90}ms` }}>
              <span className="lp-step-n">0{i + 1}</span>
              <span className="lp-step-ico">
                <Icon size={20} />
              </span>
              <h3>
                {s.key} <small>{s.ko}</small>
              </h3>
              <p>{s.desc}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
