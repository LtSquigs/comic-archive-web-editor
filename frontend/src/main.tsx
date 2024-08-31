import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';

// npx vite build -w

import App from './app/app';
import { Toaster } from './components/ui/toaster';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <StrictMode>
    <App />
    <Toaster />
  </StrictMode>
);
