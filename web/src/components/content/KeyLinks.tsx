import type { LinkGroup } from '../../types';

/** Key Links tab: groups of Jira / Confluence references, rendered as pills. */
export function KeyLinks({ groups }: { groups: LinkGroup[] }) {
  return (
    <div>
      {groups.map((g) => (
        <section key={g.title}>
          <h2 className="fp-h2">
            {g.title} <span className="kl-count">{g.links.length}</span>
          </h2>
          {g.links.length > 0 && (
            <div className="kl-pills">
              {g.links.map((l, i) => (
                <a key={`${l.href}-${i}`} className="kl-pill" href={l.href} target="_blank" rel="noopener noreferrer">
                  <span className={`kl-kind ${l.kind.toLowerCase()}`}>{l.kind}</span>
                  <span className="kl-label">{l.label}</span>
                  <span className="kl-arrow" aria-hidden="true">&#8599;</span>
                </a>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
