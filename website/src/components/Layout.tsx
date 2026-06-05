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
      <Navbar theme={theme} onToggleTheme={onToggleTheme} />
      <main>{children}</main>
      <Footer />
    </>
  );
}
