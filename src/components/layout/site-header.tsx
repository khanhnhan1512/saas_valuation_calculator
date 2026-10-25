import Image from 'next/image';
import { COPY } from '@/config/site-copy';
import { FullscreenButton } from './fullscreen-button';
import styles from './page-layout.module.css';

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <Image
        className={styles.logo}
        src="/brand/aspen-logo.png"
        alt={COPY.brand}
        width={1408}
        height={339}
        priority
        unoptimized
      />
      <div className={styles.titles}>
        <h1 className={styles.title}>
          {COPY.titleBefore}
          <span className={styles.highlight}>{COPY.titleHighlight}</span>
          {COPY.titleAfter}
        </h1>
        <p className={styles.subtitle}>{COPY.subtitle}</p>
      </div>
      <div className={styles.headerActions}>
        <span className={styles.badge}>{COPY.badge}</span>
        <FullscreenButton />
      </div>
    </header>
  );
}
