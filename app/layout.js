import './globals.css';

export const metadata = {
  title: 'HITS Quiz Portal',
  description: 'Live quiz portal for students'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
