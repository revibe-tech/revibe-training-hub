import { Poppins, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { BadgeCelebrationProvider } from '@/components/BadgeCelebration';
import UpdateNotificationBanner from '@/components/UpdateNotificationBanner';

const poppins = Poppins({
  weight: ['400', '500', '600', '700', '800', '900'],
  subsets: ['latin'],
  variable: '--font-poppins',
  display: 'swap',
});

const inter = Inter({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata = {
  title: 'REVIBE — Training Hub',
  description: 'REVIBE Training Hub — Access your training materials, courses, and resources.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${poppins.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'><stop offset='0%25' stop-color='%23FF2E63'/><stop offset='100%25' stop-color='%237C3AED'/></linearGradient></defs><circle cx='50' cy='50' r='50' fill='url(%23g)'/><text x='50' y='68' text-anchor='middle' fill='white' font-size='48' font-weight='900' font-family='sans-serif'>R</text></svg>" />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          <BadgeCelebrationProvider>
            <UpdateNotificationBanner />
            {children}
          </BadgeCelebrationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
