import type { FeatureTab } from '../../types';
import { MarkdownContent } from './MarkdownContent';
import { HtmlContent } from './HtmlContent';
import { KeyLinks } from './KeyLinks';

/** Renders one documentation tab according to where its content comes from. */
export function TabContent({ tab }: { tab: FeatureTab }) {
  const { source } = tab;
  const twoCol = source.type === 'html' && source.layout === 'twoCol';
  return (
    <div className={`fp-body ${twoCol ? '' : 'one-col'}`} role="tabpanel" aria-label={tab.label}>
      {source.type === 'markdown' && <MarkdownContent path={source.path} />}
      {source.type === 'html' && <HtmlContent file={source.file} />}
      {source.type === 'links' && <KeyLinks groups={source.groups} />}
    </div>
  );
}
