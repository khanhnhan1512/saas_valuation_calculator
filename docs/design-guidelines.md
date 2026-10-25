# Design guidelines

Matches Aspen's SaaS North theme: dark teal-green with a faint grid and teal accents. Same palette in light and dark system modes.

## Tokens (`src/app/globals.css`)
| Token | Value | Use |
|---|---|---|
| `--bg`, `--bg-a`, `--bg-b` | #12302C, radial #1B4440 to #0C2220 | Page |
| `--grid` | rgba(5,180,201,0.06), 36px squares | Texture |
| `--card`, `--card-border` | rgba(255,255,255,0.045), rgba(5,180,201,0.38), radius 16 | Cards |
| `--field` | rgba(0,0,0,0.22), 1.5px border, radius 10 | Inputs |
| `--teal` | #05B4C9 | Buttons, active chips, range band, step badges |
| `--teal-text` | #3FD0E0 | Highlights, labels |
| `--text`, `--muted`, `--faint` | #FFF, #C4D6D3, #93AAA6 | Text levels |
| `--on-teal` | #062421 | Text on teal |
| `--error` | #FF9B8F | Validation line |

Font: "DIN Next LT Pro", falling back to Arial and Helvetica (licence for web use still to be supplied). Letter spacing 0.012em, word spacing 0.04em.

## Layout
- Grid of header, two columns (1.05fr / 1fr) and footer; max width 1900px.
- `--u = clamp(1px, min(100dvh/768, 100vw/1366), 1.5px)`: base sizes are exact at 1366 x 768.
- 880 to 1279px wide: tighter paddings and chips so 1024 x 768 still fits.
- Below 880px the columns stack and the page scrolls; below 520px fields go one per row.
- Locked and unlocked results share the same markup (sample numbers blurred), so unlocking causes no layout shift.

## Accessibility
- Every input has a visible label. Chips are buttons with `aria-pressed`.
- The result has a polite live region, and the error line is `role="alert"`.
- Touch targets are extended to about 44px with invisible hit areas.
- Inputs use at least 16px text so iOS does not zoom.

## Copy
Use the spec copy exactly (`src/config/site-copy.ts`). Aspen style avoids hyphens and long dashes in body text.
