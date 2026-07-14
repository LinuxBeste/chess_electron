import { shortcuts, type Shortcut } from '../shortcuts';
import { t } from '../translate';

const categories: { key: Shortcut['category']; labelKey: string }[] = [
  { key: 'general', labelKey: 'shortcuts.categoryGeneral' },
  { key: 'game', labelKey: 'shortcuts.categoryGame' },
  { key: 'navigation', labelKey: 'shortcuts.categoryNavigation' },
];

function ShortcutRow({ shortcut }: { shortcut: Shortcut }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 0',
        opacity: shortcut.implemented ? 1 : 0.45,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: '#e0e0e0' }}>{t(shortcut.label)}</div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{t(shortcut.description)}</div>
      </div>
      <kbd
        style={{
          fontFamily: 'monospace',
          fontSize: 11,
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 4,
          padding: '2px 7px',
          color: '#ccc',
          whiteSpace: 'nowrap',
          marginLeft: 12,
        }}
      >
        {shortcut.keys}
      </kbd>
    </div>
  );
}

function Section({ title }: { title: string }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '1px',
        color: '#666',
        marginTop: 16,
        marginBottom: 4,
        paddingBottom: 4,
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      {title}
    </div>
  );
}

export default function ShortcutsTab() {
  return (
    <div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 12, lineHeight: 1.5 }}>{t('shortcuts.intro')}</div>
      {categories.map(({ key, labelKey }) => {
        const items = shortcuts.filter((s) => s.category === key);
        if (items.length === 0) return null;
        return (
          <div key={key}>
            <Section title={t(labelKey)} />
            {items.map((shortcut) => (
              <ShortcutRow key={shortcut.id} shortcut={shortcut} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
