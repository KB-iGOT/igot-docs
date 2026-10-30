import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../ui/Icon';
import { search, type SearchItem } from '../../lib/search';
import styles from './SearchBox.module.css';

/** Header search over hubs, features and documents. Ctrl+K or "/" focuses it;
 *  arrow keys move through results, Enter opens, Esc closes. */
export function SearchBox() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const hits = useMemo(() => search(query), [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing)) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const go = (item: SearchItem | undefined) => {
    if (!item) return;
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
    navigate(item.to);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(hits.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(hits[active]); }
    else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
  };

  const showList = open && query.trim().length > 0;
  return (
    <div className={styles.box} role="search">
      <Icon name="search" size={16} strokeWidth={2} className={styles.icon} />
      <input
        ref={inputRef}
        type="search"
        className={styles.input}
        placeholder="Search features, hubs, APIs, diagrams, guides…"
        aria-label="Search the documentation"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
      />
      <kbd className={styles.kbd}>Ctrl K</kbd>
      {showList && (
        <ul id={listId} className={styles.results} role="listbox">
          {hits.length === 0 && <li className={styles.none}>No results for “{query}”</li>}
          {hits.map((h, i) => (
            <li
              key={`${h.kind}:${h.to}`}
              role="option"
              aria-selected={i === active}
              className={`${styles.hit} ${i === active ? styles.active : ''}`}
              onMouseDown={(e) => { e.preventDefault(); go(h); }}
              onMouseEnter={() => setActive(i)}
            >
              <b>{h.label}</b>
              <span className={`${styles.kind} ${h.kind === 'hub' ? styles.kindHub : ''}`}>{h.kind}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
