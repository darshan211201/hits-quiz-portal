import './style.css';

export const metadata = {
  title: 'HITS Quiz Portal',
  description: 'Department-based live quiz platform for HITS'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
