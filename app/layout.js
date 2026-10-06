import { Montserrat, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { BadgeCelebrationProvider } from '@/components/BadgeCelebration';
import UpdateNotificationBanner from '@/components/UpdateNotificationBanner';
import RolePicker from '@/components/RolePicker';
import AppToaster from '@/components/ui/AppToaster';
import { ConfirmProvider } from '@/components/ui/ConfirmDialog';

const montserrat = Montserrat({
  weight: ['400', '500', '600', '700', '800', '900'],
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  weight: ['400', '600'],
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata = {
  title: {
    default: 'Revibe Training Hub',
    template: '%s · Revibe Training',
  },
  description: 'Revibe Training Hub: learn the Revibe way, track your progress and earn badges as you go.',
  applicationName: 'Revibe Training Hub',
};

export const viewport = {
  themeColor: '#FFFFFF',
  width: 'device-width',
  initialScale: 1,
};

const FAVICON =
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='%23C82D8C'/><stop offset='.55' stop-color='%237F19A0'/><stop offset='1' stop-color='%235019A0'/></linearGradient></defs><rect width='64' height='64' rx='16' fill='url(%23g)'/><text x='32' y='45' text-anchor='middle' fill='white' font-size='36' font-weight='900' font-family='Montserrat,Arial,sans-serif'>R</text></svg>";

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${montserrat.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* display=block keeps icon ligatures invisible (not raw words) until the font arrives */}
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Round&display=block" rel="stylesheet" />
        <link rel="icon" href={FAVICON} />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          <ConfirmProvider>
            <BadgeCelebrationProvider>
              <RolePicker />
              <UpdateNotificationBanner />
              {children}
              <AppToaster />
            </BadgeCelebrationProvider>
          </ConfirmProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
