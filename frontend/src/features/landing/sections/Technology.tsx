import { Boxes, Brain, Cpu, Layers, Server, Wrench } from 'lucide-react';
import { STATUS_LABEL, TECH } from '../content';

const ICONS = [Cpu, Brain, Wrench, Layers, Server, Boxes];

export function Technology() {
  return (
    <section className="lp-section" id="technology">
      <header className="lp-head" data-reveal>
        <span className="lp-eyebrow">Technology</span>
        <h2>지금 되는 것, 만들고 있는 것.</h2>
        <p>현재 상태를 그대로 표기합니다.</p>
      </header>
      <div className="lp-tech">
        {TECH.map((t, i) => {
          const Icon = ICONS[i];
          return (
            <article key={t.title} className="lp-tech-card" data-reveal>
              <div className="lp-tech-top">
                <span className="lp-ico">
                  <Icon size={16} />
                </span>
                <span className={`lp-badge ${t.status}`}>{STATUS_LABEL[t.status]}</span>
              </div>
              <h3>{t.title}</h3>
              <p>{t.desc}</p>
            </article>
          );
        })}
      </div>
      <p className="lp-stack" data-reveal>
        NestJS · Prisma · PostgreSQL · React · Vite · Capacitor · Ollama
      </p>
    </section>
  );
}
