import type { ReactNode } from 'react';
import styles from './DataTable.module.css';

export interface Column<T> {
  readonly key: string;
  readonly header: ReactNode;
  readonly cell: (row: T) => ReactNode;
  /** A CSS width for the column, e.g. "28%" or "120px". */
  readonly width?: string;
  /** Hidden on a narrow screen. */
  readonly wide?: boolean;
}

interface DataTableProps<T> {
  readonly columns: readonly Column<T>[];
  readonly rows: readonly T[];
  readonly rowKey: (row: T) => string;
  /** Accessible name of the table. */
  readonly label: string;
  readonly onRowClick?: (row: T) => void;
  readonly selectedKey?: string | null;
  /** Shown in place of the rows when there are none. */
  readonly empty?: ReactNode;
}

/** Rows over a gray header, split by hairlines; a row can open what it lists. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  label,
  onRowClick,
  selectedKey,
  empty,
}: DataTableProps<T>) {
  return (
    <div className={styles.scroll}>
      <table className={styles.table} aria-label={label}>
        <colgroup>
          {columns.map((c) => (
            <col
              key={c.key}
              style={c.width === undefined ? undefined : { width: c.width }}
              data-wide={c.wide === true || undefined}
            />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" data-wide={c.wide === true || undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className={styles.empty} colSpan={columns.length}>
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const key = rowKey(row);
              return (
                <tr
                  key={key}
                  data-clickable={onRowClick === undefined ? undefined : true}
                  data-selected={key === selectedKey || undefined}
                  tabIndex={onRowClick === undefined ? undefined : 0}
                  onClick={
                    onRowClick === undefined
                      ? undefined
                      : () => {
                          onRowClick(row);
                        }
                  }
                  onKeyDown={
                    onRowClick === undefined
                      ? undefined
                      : (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onRowClick(row);
                          }
                        }
                  }
                >
                  {columns.map((c) => (
                    <td key={c.key} data-wide={c.wide === true || undefined}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
