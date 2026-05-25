import { Toaster } from 'react-hot-toast';

export default function Toast() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: '#121212',
          color: '#FAFAFA',
          borderRadius: '8px',
          fontSize: '14px',
        },
        success: { iconTheme: { primary: '#22C55E', secondary: '#FAFAFA' } },
        error: { iconTheme: { primary: '#EF4444', secondary: '#FAFAFA' } },
      }}
    />
  );
}
