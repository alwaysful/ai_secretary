import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CertPage } from './certs/CertPage';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CertPage />
  </StrictMode>,
);
