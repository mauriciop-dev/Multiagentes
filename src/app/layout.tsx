import React from 'react';
import './globals.css';

export const metadata = {
  title: 'Consultores Empresariales IA',
  description: 'Sistema Multi-Agente con Gemini y Supabase',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
        <script>
          {`tailwind.config = {
            theme: {
              extend: {
                colors: {
                  cyan: {
                    600: '#0891b2',
                  }
                }
              }
            }
          }`}
        </script>
      </head>
      <body className="bg-gray-50 min-h-screen text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
