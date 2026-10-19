/** A documentation tab's content: rendered Markdown from ../docs, a hand-authored
 *  HTML fragment from src/content, or structured Key Links data. */
export type TabSource =
  | { type: 'markdown'; path: string }
  | { type: 'html'; file: string; layout: 'oneCol' | 'twoCol' }
  | { type: 'links'; groups: LinkGroup[] };

export interface LinkGroup {
  title: string;
  links: { kind: string; label: string; href: string }[];
}

export interface FeatureTab {
  key: string;
  label: string;
  hidden?: boolean;
  source: TabSource;
}

export interface Feature {
  id: string;
  title: string;
  summary: string;
  /** inner markup of the feature's 24x24 line icon */
  icon: string;
  tabs: FeatureTab[];
}

export type BubbleTarget = { feature: string } | { hub: string };

export interface Bubble {
  label: string;
  sub?: string;
  x: number;
  y: number;
  size: number;
  fontSize?: number;
  variant: 'hub' | 'item' | 'assess';
  target: BubbleTarget;
}

export interface Hub {
  id: string;
  name: string;
  hint: string;
  parent: string | null;
  orbit: { cx: number; cy: number; r: number } | null;
  center: { label: string; sub: string; x: number; y: number; size: number; icon: string; href?: string };
  bubbles: Bubble[];
}

export interface DocsMeta {
  dates: Record<string, string>;
  diagrams: number;
}
