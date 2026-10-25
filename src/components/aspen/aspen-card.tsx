import QRCode from 'qrcode';
import { COPY } from '@/config/site-copy';
import { CONTACT_URL } from '@/config/valuation-config';
import styles from './aspen-card.module.css';

/** Server component: the QR SVG is generated at build time, so it ships no client JS. */
export async function AspenCard() {
  const qrSvg = await QRCode.toString(CONTACT_URL, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
    color: { dark: '#1A322F', light: '#FFFFFF' },
  });

  return (
    <section className={styles.card} aria-labelledby="aspen-heading" data-card>
      <div className={styles.copy}>
        <h2 id="aspen-heading" className={styles.heading}>
          {COPY.aspenHeading}
        </h2>
        <p className={styles.intro}>
          <strong>{COPY.aspenIntroBold}</strong>
          {COPY.aspenIntroRest}
        </p>
        <ul className={styles.bullets}>
          {COPY.aspenBullets.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
      <figure className={styles.qrFigure}>
        <div
          className={styles.qr}
          role="img"
          aria-label={COPY.qrAlt}
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <figcaption className={styles.caption}>{COPY.qrCaption}</figcaption>
      </figure>
    </section>
  );
}
