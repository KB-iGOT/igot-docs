import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { MarkdownContent } from '../components/content/MarkdownContent';

/** A platform-level document (System Architecture, Monitoring): one Markdown file from docs/,
 *  shown with the same content styles as a feature tab. The document carries its own title. */
export function DocPage({ title, path }: { title: string; path: string }) {
  return (
    <div className="doc-page">
      <div className="doc-page-crumbs"><Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: title }]} /></div>
      <div className="fp-body one-col">
        <MarkdownContent key={path} path={path} />
      </div>
    </div>
  );
}
