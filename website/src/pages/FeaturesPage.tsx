import { Link } from 'react-router-dom';
import { ArrowLeft, Users, Gamepad2, Palette, Cpu, Download, Shield, Globe } from 'lucide-react';
import ScrollReveal from '../components/ScrollReveal';
import Placeholder from '../components/Placeholder';

const features = [
  {
    icon: Users,
    title: 'Play with Friends',
    desc: 'Create a private room and share the code with a friend. They join instantly — no accounts, no sign-ups. You can also browse public games and spectate ongoing matches.',
    details: [
      'Room codes — no registration needed',
      'Public game browser',
      'Spectator mode with live moves',
      'In-game chat',
    ],
    visual: <Placeholder label="Room code UI" className="w-full h-28" />,
  },
  {
    icon: Gamepad2,
    title: 'Drag & Drop Moves',
    desc: 'Move pieces naturally with drag-and-drop or click-to-select. Legal move highlights show exactly where each piece can go — no more accidental blunders or illegal moves.',
    details: [
      'Drag-and-drop and click-to-move',
      'Legal move highlights on hover',
      'Move history with algebraic notation',
      'Undo/redo during local games',
    ],
    visual: <Placeholder label="Board interaction screenshot" className="w-full h-48" />,
  },
  {
    icon: Palette,
    title: 'Customize Everything',
    desc: 'Make the board your own. Switch between multiple themes, toggle coordinates, adjust animation speed, and control the sound volume. Your preferences are saved between sessions.',
    details: [
      'Multiple board themes (wood, modern, minimal)',
      'Piece set options',
      'Toggle rank/file coordinates',
      'Adjustable animation speed',
      'Sound effects with volume control',
    ],
    visual: <Placeholder label="Theme selector screenshot" className="w-full h-40" />,
  },
  {
    icon: Cpu,
    title: 'Full Chess Rules',
    desc: 'Every FIDE rule is implemented faithfully: castling, en passant, pawn promotion, checkmate, stalemate, threefold repetition, and the 50-move draw rule. The engine never cheats.',
    details: [
      'Castling (kingside and queenside)',
      'En passant captures',
      'Pawn promotion with piece selection',
      'Check, checkmate, and stalemate detection',
      'Threefold repetition & 50-move rule',
    ],
    visual: <Placeholder label="Rules & moves UI" className="w-full h-32" />,
  },
  {
    icon: Globe,
    title: 'Online & Local Play',
    desc: 'Play locally with a friend on the same machine, or connect online from anywhere. The app handles networking so you can focus on the game.',
    details: [
      'Local hotseat — pass the keyboard',
      'Online multiplayer via room codes',
      'Built-in server mode',
      'Real-time sync with low latency',
    ],
    visual: <Placeholder label="Online lobby screenshot" className="w-full h-32" />,
  },
  {
    icon: Shield,
    title: 'Free & Open Source',
    desc: 'No ads, no subscriptions, no tracking, no data collection. The full source code is on GitHub under the MIT license. Fork it, modify it, share it.',
    details: [
      'MIT licensed',
      'No telemetry or analytics',
      'Community-driven development',
      'Cross-platform (Linux, macOS, Windows)',
    ],
    visual: <Placeholder label="GitHub repo screenshot" className="w-full h-32" />,
  },
];

// Features page: detailed breakdown of app capabilities
export default function FeaturesPage() {
  return (
    <div className="pt-24 pb-20 px-6">
      <div className="max-w-5xl mx-auto">
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
          <div className="text-center mb-16">
            <h1 className="text-[clamp(32px,5vw,48px)] font-extrabold tracking-tight mb-4">All features</h1>
            <p className="text-muted text-lg max-w-2xl mx-auto">Everything in the Chess App, explained in detail.</p>
          </div>
        </ScrollReveal>

        <div className="space-y-20">
          {features.map((f, i) => (
            // alternate animation direction and layout order per row
            <ScrollReveal key={f.title} variant={i % 2 === 0 ? 'fade-left' : 'fade-right'} delay={0.05}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
                {/* flip column order on every other row for visual variety */}
                <div className={i % 2 === 0 ? 'md:order-1' : 'md:order-2'}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-accent/10 text-accent mb-4">
                    <f.icon size={22} />
                  </div>
                  <h2 className="text-2xl font-bold mb-3">{f.title}</h2>
                  <p className="text-muted leading-relaxed mb-5">{f.desc}</p>
                  <ul className="space-y-2">
                    {f.details.map((d) => (
                      <li key={d} className="flex items-start gap-2 text-sm text-text">
                        <span className="text-accent mt-0.5">●</span>
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={`${i % 2 === 0 ? 'md:order-2' : 'md:order-1'} flex justify-center`}>{f.visual}</div>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal variant="fade-up" delay={0.1}>
          <div className="mt-20 text-center">
            <Link
              to="/download"
              className="inline-flex items-center gap-2 px-8 py-3.5 text-base font-semibold rounded-xl bg-accent text-white shadow-lg shadow-accent/20 hover:bg-accent-hover transition-all hover:-translate-y-0.5"
            >
              <Download size={20} />
              Download the App
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
