import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { ArrowIcon, BackIcon, CopiedIcon } from '../icons';
import { Button } from './Button';
import styles from './Wizard.module.css';

export interface WizardStep {
  readonly id: string;
  readonly title: string;
  /** A line under the title, in the step's own header. */
  readonly hint?: string;
  readonly content: ReactNode;
  /** What still has to be done before moving on; null or absent when the step is ready. */
  readonly blocker?: string | null;
  readonly optional?: boolean;
}

interface WizardProps {
  readonly steps: readonly WizardStep[];
  /** The last step's button: "Start", "Create agent". Absent: read-only, no finish. */
  readonly finishLabel?: string;
  readonly finishIcon?: ReactNode;
  readonly onFinish?: () => void;
  /** Editing something that exists: every step can be opened and saved from. */
  readonly free?: boolean;
  /** Nothing changed yet, so finishing would do nothing (editing). */
  readonly finishDisabled?: boolean;
  readonly busy?: boolean;
  /** Told when moving on is refused, so fields can show what is wrong. */
  readonly onBlocked?: (stepId: string) => void;
  /** On the left of the buttons (Delete). */
  readonly secondary?: ReactNode;
  /** A line before the buttons (saving…, an error). */
  readonly status?: ReactNode;
  /** Shown at the top of the card, over the steps (what is being edited). */
  readonly header?: ReactNode;
}

/**
 * A form in steps: numbered steps across the top (done ones ticked, the line between them
 * filling as you go), one step at a time sliding in, and Back / Next / finish at the bottom.
 */
export function Wizard({
  steps,
  finishLabel,
  finishIcon,
  onFinish,
  free = false,
  finishDisabled = false,
  busy = false,
  onBlocked,
  secondary,
  status,
  header,
}: WizardProps) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [refused, setRefused] = useState<string | null>(null);
  const current = steps[Math.min(index, steps.length - 1)];
  if (current === undefined) return null;
  const last = index >= steps.length - 1;

  // Blocked from moving past `to`: the first earlier step that is not ready.
  const firstBlocked = (upTo: number): number =>
    steps.findIndex((s, i) => i < upTo && s.blocker != null);

  const go = (to: number) => {
    if (to === index || to < 0 || to >= steps.length) return;
    if (to > index && !free) {
      const blocked = firstBlocked(to);
      if (blocked !== -1) {
        const step = steps[blocked];
        setRefused(step?.blocker ?? null);
        if (step !== undefined) onBlocked?.(step.id);
        if (blocked !== index) {
          setDirection(blocked > index ? 1 : -1);
          setIndex(blocked);
        }
        return;
      }
    }
    setRefused(null);
    setDirection(to > index ? 1 : -1);
    setIndex(to);
  };

  const finish = () => {
    const blocked = firstBlocked(steps.length);
    if (blocked !== -1) {
      const step = steps[blocked];
      setRefused(step?.blocker ?? null);
      if (step !== undefined) onBlocked?.(step.id);
      setDirection(blocked > index ? 1 : -1);
      setIndex(blocked);
      return;
    }
    setRefused(null);
    onFinish?.();
  };

  const reachable = (i: number): boolean => free || i <= index || firstBlocked(i) === -1;
  const canFinish = onFinish !== undefined && (last || free);

  return (
    <div className={styles.wizard}>
      {header !== undefined && <div className={styles.header}>{header}</div>}
      <ol className={styles.steps} aria-label="Steps">
        {steps.map((step, i) => {
          const state = i === index ? 'current' : i < index ? 'done' : 'todo';
          return (
            <li key={step.id} className={styles.stepItem} data-state={state}>
              <button
                type="button"
                className={styles.stepButton}
                aria-current={i === index ? 'step' : undefined}
                disabled={!reachable(i)}
                onClick={() => {
                  go(i);
                }}
              >
                <span className={styles.number} aria-hidden>
                  {state === 'done' ? <CopiedIcon size={14} /> : i + 1}
                </span>
                <span className={styles.stepText}>
                  <span className={styles.stepTitle}>{step.title}</span>
                  {step.optional === true && <span className={styles.optional}>Optional</span>}
                </span>
              </button>
              {i < steps.length - 1 && (
                <span className={styles.connector} aria-hidden>
                  <span className={styles.connectorFill} data-on={i < index || undefined} />
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <div className={styles.body}>
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.section
            key={current.id}
            className={styles.panel}
            custom={direction}
            initial={{ opacity: 0, x: direction * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -24 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            aria-labelledby={`wizard-${current.id}`}
          >
            <header className={styles.panelHeader}>
              <span className={styles.counter}>
                Step {index + 1} of {steps.length}
              </span>
              <h2 id={`wizard-${current.id}`} className={styles.panelTitle}>
                {current.title}
              </h2>
              {current.hint !== undefined && <p className={styles.panelHint}>{current.hint}</p>}
            </header>
            {current.content}
          </motion.section>
        </AnimatePresence>
      </div>

      <footer className={styles.footer}>
        {secondary}
        <span className={styles.status} role="status" data-refused={refused !== null || undefined}>
          {refused ?? status}
        </span>
        <Button
          icon={<BackIcon size={15} />}
          disabled={index === 0 || busy}
          onClick={() => {
            go(index - 1);
          }}
        >
          Back
        </Button>
        {!last && (
          <Button
            variant={canFinish ? 'secondary' : 'primary'}
            disabled={busy}
            onClick={() => {
              go(index + 1);
            }}
          >
            Next
            <ArrowIcon size={15} />
          </Button>
        )}
        {canFinish && (
          <Button
            variant="primary"
            icon={finishIcon}
            disabled={busy || finishDisabled}
            onClick={finish}
          >
            {finishLabel}
          </Button>
        )}
      </footer>
    </div>
  );
}
