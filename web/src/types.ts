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

/** what a hub entry opens: a feature page, a nested hub (e.g. Features → Registration),
 *  or nothing yet — a "coming soon" placeholder for documentation still to be supplied */
export type HubTarget = { feature: string } | { hub: string } | { soon: true };

export interface HubItem {
  label: string;
  target: HubTarget;
}

/** a group of features shown as a dropdown in the sidebar and as a list page */
export interface Hub {
  id: string;
  name: string;
  /** hub this one sits inside, e.g. Registration inside Features */
  parent: string | null;
  items: HubItem[];
}

export interface DocsMeta {
  dates: Record<string, string>;
  diagrams: number;
}
