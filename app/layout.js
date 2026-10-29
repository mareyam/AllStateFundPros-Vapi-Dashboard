import './globals.css';

export const metadata = {
  title: 'AllStateFundPros Vapi Dashboard',
  description: 'Call outcomes, AI vs human pickup, and verbatim customer quotes.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
