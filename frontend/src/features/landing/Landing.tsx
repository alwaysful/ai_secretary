import { useCallback, useEffect, useState } from 'react';
import './landing.css';
import { Bento } from './sections/Bento';
import { FinalCta } from './sections/FinalCta';
import { Footer } from './sections/Footer';
import { Hero } from './sections/Hero';
import { HowItWorks } from './sections/HowItWorks';
import { NavBar } from './sections/NavBar';
import { Technology } from './sections/Technology';
import { markSeen } from './seen';
import { useReveal } from './useReveal';

export function Landing(props: { onEnter: () => void; onInfo: () => void }) {
  const ref = useReveal<HTMLDivElement>();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = () => setScrolled(el.scrollTop > 12);
    el.addEventListener('scroll', on, { passive: true });
    return () => el.removeEventListener('scroll', on);
  }, [ref]);

  const jump = useCallback(
    (id: string) => {
      if (id === 'top') ref.current?.scrollTo({ top: 0, behavior: 'smooth' });
      else document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [ref],
  );

  const enter = () => {
    markSeen();
    props.onEnter();
  };
  const explore = () => {
    markSeen();
    props.onInfo();
  };

  return (
    <div className="lp" ref={ref} id="top">
      <div className="lp-bg" aria-hidden="true">
        <span className="g1" />
        <span className="g2" />
        <span className="grid" />
      </div>
      <NavBar scrolled={scrolled} onJump={jump} onEnter={enter} />
      <main className="lp-main">
        <Hero onEnter={enter} onLearn={() => jump('features')} />
        <Bento />
        <HowItWorks />
        <Technology />
        <FinalCta onEnter={enter} onExplore={explore} />
      </main>
      <Footer />
    </div>
  );
}
