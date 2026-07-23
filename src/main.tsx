import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './lib/auth.tsx';
import { ThemeProvider } from './lib/theme.tsx';
import { FeedbackProvider } from './lib/feedback.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider><FeedbackProvider><AuthProvider><App /></AuthProvider></FeedbackProvider></ThemeProvider>
  </StrictMode>,
);
