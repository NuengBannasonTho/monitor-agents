import { AGENT_STATES } from '@agent-office/shared';
import { hueForSession } from '../../lib/hue';
import { Avatar } from '../../components/avatar/avatar';
import { PixelWorker } from '../../components/worker/pixel-worker';
import { STATE_LABEL } from '../../components/office/state-meta';
import styles from './page.module.css';

const SAMPLE_IDS = ['a1b2c3', 'session-42', 'f00dbabe', 'orca-7', 'zz-top', 'q9'];

/** Review page for every worker state and the per-agent variety. Open with `?gallery`. */
export function GalleryPage(): React.JSX.Element {
  return (
    <div className={styles.page}>
      <h2 className={styles.heading}>States</h2>
      <ul className={styles.grid}>
        {AGENT_STATES.map((state) => (
          <li key={state} className={styles.card}>
            {/* Follows the header's skin choice, so every skin mode can be reviewed here. */}
            <Avatar
              state={state}
              desk="gallery"
              hue={352}
              seed="gallery"
              variant="hero"
              title={STATE_LABEL[state]}
            />
            <span className={styles.name}>{state}</span>
          </li>
        ))}
      </ul>
      <h2 className={styles.heading}>Variety per session id</h2>
      <ul className={styles.grid}>
        {SAMPLE_IDS.map((id) => {
          const hue = hueForSession(id);
          return (
            <li key={id} className={styles.card}>
              <PixelWorker state="idle" hue={hue} size={72} seed={id} />
              <span className={styles.name}>
                {id} · {hue}°
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
