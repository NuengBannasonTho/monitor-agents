import { useSkins } from '../../skins/SkinContext';
import { Avatar } from '../avatar/Avatar';
import styles from './CostumePicker.module.css';

/**
 * In "By desk" mode, pick which costume this desk (worktree) wears. The choice
 * is remembered per desk name, so it survives new sessions in the same worktree.
 */
export function CostumePicker({ desk }: { desk: string }) {
  const skins = useSkins();
  if (skins.pack === null || skins.mode !== 'by-agent') return null;
  const current = skins.costumeFor(desk);

  return (
    <section aria-labelledby="costume-title">
      <h3 id="costume-title" className={styles.title}>
        Costume for {desk}
      </h3>
      <div className={styles.grid} role="radiogroup" aria-labelledby="costume-title">
        {skins.pack.manifest.costumes.map((key) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={key === current}
            className={styles.option}
            onClick={() => {
              skins.setCostume(desk, key);
            }}
            title={key}
          >
            <Avatar state="idle" desk={desk} hue={0} seed={key} variant="thumb" imageKey={key} />
            <span className={styles.label}>{key}</span>
          </button>
        ))}
      </div>
      <p className={styles.hint}>Needs-you and stale still switch to their own costume.</p>
    </section>
  );
}
