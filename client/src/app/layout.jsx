import './globals.css';
import ThemeProvider from '../components/layout/ThemeProvider';
import PendingPublishWorker from '../components/publish/PendingPublishWorker';

export const metadata = {
  title: 'CreatorOps OS',
  description: 'Creator workflow infrastructure — campaign planning, AI repurposing, creator review, publishing, and analytics.',
  icons: {
    icon: [
      { url: '/favicon.jpeg', type: 'image/jpeg' },
      { url: '/logo.jpeg', type: 'image/jpeg' }
    ],
    shortcut: '/favicon.jpeg',
    apple: '/logo.jpeg'
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/*
          Applies the theme class before first paint. ThemeProvider only sets it
          in a mount effect, so without this every Tailwind `dark:` variant
          resolved light on the server render and snapped on hydration. Runs
          synchronously and is inert if localStorage is unavailable.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('creatorops.theme');if(t!=='dark'&&t!=='light'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}var r=document.documentElement;r.classList.add(t);r.classList.remove(t==='dark'?'light':'dark');r.dataset.theme=t;r.style.colorScheme=t;}catch(e){document.documentElement.classList.add('dark');}})();`
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <PendingPublishWorker />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
