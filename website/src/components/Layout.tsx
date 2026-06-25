import Navbar from './Navbar';
import Footer from './Footer';

interface Props {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  children: React.ReactNode;
}

export default function Layout({ theme, onToggleTheme, children }: Props) {
  return (
    <>
      {/* theme passed down from App so toggle affects entire page */}
      <Navbar theme={theme} onToggleTheme={onToggleTheme} />
      {/* main wraps page-specific content between nav and footer */}
      <main>{children}</main>
      <Footer />
    </>
  );
}
