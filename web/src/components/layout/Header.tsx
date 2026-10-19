import { Link } from 'react-router-dom';
import logo from '../../assets/brand/karmayogi-logo.svg';
import { Icon } from '../ui/Icon';
import { SearchBox } from './SearchBox';
import styles from './Header.module.css';

export const IGOT_URL = 'https://igotkarmayogi.gov.in/';

interface Props {
  menuOpen: boolean;
  onToggleMenu: () => void;
}

/** Top bar: brand (home), global search, link out to the platform; menu button on small screens. */
export function Header({ menuOpen, onToggleMenu }: Props) {
  return (
    <header className={styles.header}>
      <button type="button" className={styles.menu} onClick={onToggleMenu} aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen}>
        <Icon name={menuOpen ? 'close' : 'menu'} size={20} />
      </button>
      <Link to="/" className={styles.brand} aria-label="Karmayogi Bharat platform documentation home">
        <img src={logo} alt="Karmayogi Bharat" />
        <span>Platform<br />documentation</span>
      </Link>
      <SearchBox />
      <a className={styles.go} href={IGOT_URL} target="_blank" rel="noopener noreferrer">
        Go to iGOT <Icon name="external" size={15} strokeWidth={2.1} />
      </a>
    </header>
  );
}
