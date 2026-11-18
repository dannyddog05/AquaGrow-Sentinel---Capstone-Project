import React from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from './hooks/useRouter';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider>
      <App />
    </RouterProvider>
  </React.StrictMode>
);
