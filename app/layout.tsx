import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ORNE™ Tracking Dashboard',
  description: 'Dashboard de monitoramento de pedidos em trânsito',
  robots: 'noindex, nofollow',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-[#F5F5F5]">{children}</body>
    </html>
  );
}
