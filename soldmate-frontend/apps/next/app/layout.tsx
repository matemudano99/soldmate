// apps/web/app/layout.tsx
//
// Layout raíz de la aplicación Next.js.
// Se aplica a TODAS las páginas.
// Aquí configuramos los providers globales.

"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import "./globals.css";

// QueryClient: la instancia de React Query que gestiona el caché
// Lo creamos dentro del componente para que cada usuario tenga su propio caché

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // useState: el QueryClient se crea una sola vez (no en cada render)
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Si una query falla, reintenta máximo 1 vez (en lugar de 3 por defecto)
        retry: 1,
        // Datos frescos durante 5 minutos
        staleTime: 1000 * 60 * 5,
      },
    },
  }));

  return (
    <html lang="es">
      <head>
        <title>Soldmate ERP</title>
        <meta name="description" content="ERP modular para hostelería" />
        {/* Fuente del display: estética industrial para el ERP */}
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/logo.png" />
      </head>
      <body style={{ fontFamily: "'Syne', sans-serif", margin: 0 }} className="antialiased">
        {/* QueryClientProvider: hace disponible React Query en toda la app */}
        <QueryClientProvider client={queryClient}>
          {/* children: el contenido de cada página */}
          {children}
        </QueryClientProvider>
      </body>
    </html>
  );
}
