import './globals.css';
import ThemeProvider from '../components/layout/ThemeProvider';

export const metadata = {
  title: 'CreatorOps OS',
  description: 'Creator workflow infrastructure — campaign planning, AI repurposing, approval, publishing, and analytics.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
