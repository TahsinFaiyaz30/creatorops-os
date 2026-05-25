import './globals.css';

export const metadata = {
  title: 'CreatorOps OS',
  description: 'Creator workflow infrastructure demo'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
