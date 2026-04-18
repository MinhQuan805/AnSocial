'use client';

import { ToastContainer } from 'react-toastify';

export function AppToastContainer() {
  return (
    <ToastContainer
      position="top-right"
      autoClose={3500}
      closeOnClick
      pauseOnFocusLoss={false}
      newestOnTop
      draggable={false}
      theme="light"
    />
  );
}
