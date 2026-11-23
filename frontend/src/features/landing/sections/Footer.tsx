import { Github, Mail, Sparkles } from 'lucide-react';
import { CONTACT_URL, REPO_URL } from '../content';

export function Footer() {
  return (
    <footer className="lp-foot">
      <div className="lp-foot-in">
        <div>
          <div className="lp-brand static">
            <span className="lp-mark">
              <Sparkles size={16} />
            </span>
            AI Secretary
          </div>
          <p>이해하고, 기억하고, 행동하는 개인형 AI 비서.</p>
        </div>
        <nav className="lp-foot-links">
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            <Github size={15} /> GitHub
          </a>
          <a href={CONTACT_URL} target="_blank" rel="noreferrer">
            <Mail size={15} /> Contact
          </a>
        </nav>
      </div>
      <p className="lp-copy">© {new Date().getFullYear()} AI Secretary (AURA 810). All rights reserved.</p>
    </footer>
  );
}
