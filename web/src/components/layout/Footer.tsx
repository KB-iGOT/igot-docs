import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <span>&copy; {new Date().getFullYear()} Karmayogi Bharat. All rights reserved.</span>
      <span className={styles.sep} aria-hidden="true">&middot;</span>
      <span className={styles.extra}>iGOT Karmayogi platform documentation</span>
    </footer>
  );
}
