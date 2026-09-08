import 'katex/dist/katex.min.css';
import './styles.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { GameProvider } from './state/game.tsx';

const container = document.getElementById('root');
if (container === null) throw new Error('Fant ikke #root i index.html');

createRoot(container).render(
  <StrictMode>
    <GameProvider>
      <App />
    </GameProvider>
  </StrictMode>,
);
