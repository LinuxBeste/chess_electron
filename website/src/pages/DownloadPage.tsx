import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Github, ExternalLink, Monitor, Globe, Terminal } from 'lucide-react';
import ScrollReveal from '../components/ScrollReveal';

const platforms = [
  {
    icon: <Terminal size={28} />,
    name: 'Linux',
    formats: [
      { label: 'AppImage', file: 'chess-electron-x86_64.AppImage' },
      { label: 'Debian package', file: 'chess-electron_1.0.0_amd64.deb' },
    ],
    note: 'Recommended for most users',
  },
  {
    icon: <Monitor size={28} />,
    name: 'macOS',
    formats: [{ label: 'DMG', file: 'chess-electron-1.0.0.dmg' }],
    note: 'Apple Silicon & Intel',
  },
  {
    icon: <Globe size={28} />,
    name: 'Windows',
    formats: [{ label: 'NSIS Installer', file: 'chess-electron-Setup-1.0.0.exe' }],
    note: 'Windows 10 / 11',
  },
];

const requirements = [
  { label: 'OS', value: 'Linux (any distro), macOS 12+, Windows 10+' },
  { label: 'RAM', value: '256 MB minimum' },
  { label: 'Storage', value: '~80 MB' },
  { label: 'Display', value: '1024×768 or larger' },
];

export default function DownloadPage() {
  return (
    <div className="pt-24 pb-20 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-12">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors"
          >
            <ArrowLeft size={14} />
            Back to home
          </Link>
        </div>

        <ScrollReveal>
          <div className="text-center mb-14">
            <h1 className="text-[clamp(32px,5vw,48px)] font-extrabold tracking-tight mb-4">Download</h1>
            <p className="text-muted text-lg max-w-lg mx-auto mb-8">
              Get the latest release for your platform. All builds are signed and verified.
            </p>
            <a
              href="https://github.com/linuxbeste/chess_electron/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 px-8 py-3.5 text-base font-semibold rounded-xl bg-accent text-white shadow-lg shadow-accent/20 hover:bg-accent-hover transition-all hover:-translate-y-0.5"
            >
              <Download size={20} />
              Latest Release
            </a>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {platforms.map((p, i) => (
            <ScrollReveal key={p.name} variant="fade-up" delay={i * 0.1}>
              <div className="bg-surface border border-border rounded-2xl p-6">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-accent/10 text-accent mb-4">
                  {p.icon}
                </div>
                <h3 className="text-lg font-semibold mb-3">{p.name}</h3>
                <ul className="space-y-2 mb-4">
                  {p.formats.map((f) => (
                    <li key={f.file}>
                      <a
                        href={`https://github.com/linuxbeste/chess_electron/releases/download/v1.0.0/${f.file}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-accent hover:text-accent-hover transition-colors"
                      >
                        <Download size={13} />
                        {f.label}
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted">{p.note}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal variant="fade-up">
          <div className="bg-surface border border-border rounded-2xl p-8 mb-14">
            <h2 className="text-xl font-bold mb-5">System Requirements</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {requirements.map((r) => (
                <div key={r.label} className="flex gap-3">
                  <span className="text-xs font-semibold text-accent min-w-16 pt-0.5">{r.label}</span>
                  <span className="text-sm text-muted">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal variant="fade-up" delay={0.1}>
          <div className="bg-surface border border-border rounded-2xl p-8 mb-14">
            <h2 className="text-xl font-bold mb-4">Installation</h2>
            <div className="space-y-6 text-sm">
              <div>
                <h3 className="font-semibold mb-1">Linux</h3>
                <p className="text-muted">
                  Download the <code className="text-accent bg-accent/10 px-1 rounded">.AppImage</code>, make it
                  executable with <code className="text-accent bg-accent/10 px-1 rounded">chmod +x</code>, and run it.
                  Or install the
                  <code className="text-accent bg-accent/10 px-1 rounded">.deb</code> package with your package manager.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-1">macOS</h3>
                <p className="text-muted">
                  Open the <code className="text-accent bg-accent/10 px-1 rounded">.dmg</code> file and drag the app to
                  your Applications folder. You may need to allow it in System Settings under Privacy &amp; Security.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Windows</h3>
                <p className="text-muted">
                  Run the <code className="text-accent bg-accent/10 px-1 rounded">.exe</code> installer. Windows may
                  show a SmartScreen prompt — click "More info" then "Run anyway".
                </p>
              </div>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal variant="fade-up" delay={0.15}>
          <div className="text-center">
            <p className="text-muted text-sm mb-4">Prefer building from source?</p>
            <a
              href="https://github.com/linuxbeste/chess_electron"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-xl border border-border text-text bg-surface hover:bg-surface-alt transition-all"
            >
              <Github size={18} />
              View on GitHub
              <ExternalLink size={14} />
            </a>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
