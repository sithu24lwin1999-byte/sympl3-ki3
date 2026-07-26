import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './lib/auth.tsx';
import { FeedbackProvider } from './lib/feedback.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FeedbackProvider><AuthProvider><App /></AuthProvider></FeedbackProvider>
  </StrictMode>,
);
