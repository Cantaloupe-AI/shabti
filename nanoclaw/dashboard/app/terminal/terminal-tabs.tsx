'use client';

interface Tab {
  key: string;
  label: string;
  sessionId: string | null;
}

interface TerminalTabsProps {
  tabs: Tab[];
  activeKey: string;
  onSelect: (key: string) => void;
  onClose: (key: string) => void;
  onNew: () => void;
}

export function TerminalTabs({ tabs, activeKey, onSelect, onClose, onNew }: TerminalTabsProps) {
  return (
    <div className="flex items-center gap-1 border-b border-[var(--border)] bg-[var(--surface)] px-2">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onSelect(tab.key)}
          className={`group flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
            tab.key === activeKey
              ? 'border-b-2 border-[var(--accent)] text-[var(--text)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <span>{tab.label}</span>
          <span
            onClick={(e) => {
              e.stopPropagation();
              onClose(tab.key);
            }}
            className="ml-1 rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--border)] group-hover:opacity-100"
          >
            &times;
          </span>
        </button>
      ))}
      <button
        onClick={onNew}
        className="ml-1 rounded px-2 py-1 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
        title="New terminal"
      >
        +
      </button>
    </div>
  );
}
