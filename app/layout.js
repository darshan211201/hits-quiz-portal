import "./globals.css";

export const metadata = {
  title: "HITS Quiz Portal",
  description: "Live quiz platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
