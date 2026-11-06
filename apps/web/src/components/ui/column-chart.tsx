import type { CSSProperties } from 'react';
import { Hint } from './hint';
import styles from './column-chart.module.css';

export interface ChartSeries {
  readonly key: string;
  readonly name: string;
  /** A CSS color, e.g. var(--series-1). Series keep their color whatever is shown. */
  readonly color: string;
}

export interface ChartColumn {
  readonly key: string;
  /** Under the column; null leaves it out (to keep a long axis readable). */
  readonly axisLabel: string | null;
  /** Heads the hover label ("Fri, Nov 6"). */
  readonly title: string;
  /** By series key. */
  readonly values: Readonly<Record<string, number>>;
}

interface ColumnChartProps {
  readonly series: readonly ChartSeries[];
  readonly columns: readonly ChartColumn[];
  readonly format: (value: number) => string;
  /** Accessible name of the chart. */
  readonly label: string;
}

/** 0, then even steps of 1, 2 or 5 × 10ⁿ up past the largest column. */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / count;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = ([1, 2, 5, 10].find((m) => m * power >= rough) ?? 10) * power;
  const ticks = [0];
  while ((ticks.at(-1) ?? 0) < max) ticks.push(ticks.length * step);
  return ticks;
}

/**
 * Stacked columns over time (one per hour or day), the first series at the base. Hover or
 * focus a column for its numbers; a hidden table carries them for screen readers.
 */
export function ColumnChart({ series, columns, format, label }: ColumnChartProps) {
  const total = (c: ChartColumn) => series.reduce((sum, s) => sum + (c.values[s.key] ?? 0), 0);
  const ticks = niceTicks(Math.max(0, ...columns.map(total)));
  const top = ticks.at(-1) ?? 1;

  return (
    <figure className={styles.chart} aria-label={label}>
      {series.length > 1 && (
        <figcaption className={styles.legend}>
          {series.map((s) => (
            <span key={s.key} className={styles.key}>
              <span className={styles.swatch} style={{ background: s.color }} aria-hidden />
              {s.name}
            </span>
          ))}
        </figcaption>
      )}

      <div className={styles.frame} aria-hidden>
        <div className={styles.axis}>
          {ticks
            .slice()
            .reverse()
            .map((t) => (
              <span key={t}>{format(t)}</span>
            ))}
        </div>
        <div className={styles.plot}>
          <div className={styles.grid}>
            {ticks.map((t) => (
              <span key={t} />
            ))}
          </div>
          <div
            className={styles.columns}
            style={{ '--count': String(columns.length) } as CSSProperties}
          >
            {columns.map((c) => {
              const sum = total(c);
              return (
                <Hint
                  key={c.key}
                  content={
                    <span className={styles.tip}>
                      <strong>{c.title}</strong>
                      {series.map((s) => (
                        <span key={s.key} className={styles.tipRow}>
                          <span className={styles.swatch} style={{ background: s.color }} />
                          {s.name}
                          <span className={styles.tipValue}>{format(c.values[s.key] ?? 0)}</span>
                        </span>
                      ))}
                      {series.length > 1 && (
                        <span className={styles.tipRow}>
                          Total
                          <span className={styles.tipValue}>{format(sum)}</span>
                        </span>
                      )}
                    </span>
                  }
                >
                  <span className={styles.column} tabIndex={0}>
                    <span className={styles.stack}>
                      {series.map((s) => {
                        const value = c.values[s.key] ?? 0;
                        if (value <= 0) return null;
                        return (
                          <span
                            key={s.key}
                            className={styles.segment}
                            style={{
                              height: `${String((value / top) * 100)}%`,
                              background: s.color,
                            }}
                          />
                        );
                      })}
                    </span>
                  </span>
                </Hint>
              );
            })}
          </div>
        </div>
        <span />
        <div
          className={styles.labels}
          style={{ '--count': String(columns.length) } as CSSProperties}
        >
          {columns.map((c) => (
            <span key={c.key}>{c.axisLabel}</span>
          ))}
        </div>
      </div>

      <table className={styles.hidden}>
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">When</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {columns.map((c) => (
            <tr key={c.key}>
              <th scope="row">{c.title}</th>
              {series.map((s) => (
                <td key={s.key}>{format(c.values[s.key] ?? 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
