import { ArrowRight } from 'lucide-react';

export function FinalCta(props: { onEnter: () => void; onExplore: () => void }) {
  return (
    <section className="lp-final" data-reveal>
      <h2>
        Intelligence that <span className="lp-grad">works with you.</span>
      </h2>
      <div className="lp-cta-row center">
        <button className="lp-btn primary" onClick={props.onEnter}>
          Get Started <ArrowRight size={16} />
        </button>
        <button className="lp-btn ghost" onClick={props.onExplore}>
          Explore AI Secretary
        </button>
      </div>
    </section>
  );
}
