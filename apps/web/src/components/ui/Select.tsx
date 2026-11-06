import { Select as Primitive } from '@animate-ui/react/primitives/radix-ui/select';
import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { CopiedIcon, ExpandIcon } from '../icons';
import styles from './Select.module.css';

export interface SelectOption<T extends string> {
  readonly value: T;
  readonly label: string;
  /** A second, quieter line in the list (a path, a branch). */
  readonly detail?: string;
  readonly icon?: ReactNode;
}

interface SelectProps<T extends string> {
  readonly options: readonly SelectOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  /** Lets a <label htmlFor> or a Field name it. */
  readonly id?: string;
  /** Accessible name when there is no visible label. */
  readonly label?: string;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly className?: string;
}

/*
 * Radix refuses an empty-string item value, and "" is the natural "none" (the default model):
 * it travels under this stand-in instead.
 */
const EMPTY = '\u0000empty';
const toItem = (value: string): string => (value === '' ? EMPTY : value);
const fromItem = (value: string): string => (value === EMPTY ? '' : value);

/**
 * The app's one dropdown (animate-ui's Select): a field like the inputs that opens a list
 * whose highlight slides to the item under the pointer, the picked one ticked.
 */
export function Select<T extends string>({
  options,
  value,
  onChange,
  id,
  label,
  placeholder,
  disabled,
  className,
}: SelectProps<T>) {
  return (
    <Primitive.Root
      value={toItem(value)}
      onValueChange={(next) => {
        const picked = options.find((o) => o.value === fromItem(next));
        if (picked !== undefined) onChange(picked.value);
      }}
      disabled={disabled === true || options.length === 0}
    >
      <Primitive.Trigger id={id} className={cx(styles.trigger, className)} aria-label={label}>
        <span className={styles.value}>
          <Primitive.Value placeholder={placeholder} />
        </span>
        <Primitive.Icon className={styles.chevron}>
          <ExpandIcon size={14} />
        </Primitive.Icon>
      </Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content className={styles.content} position="popper" sideOffset={6}>
          <Primitive.Viewport className={styles.viewport}>
            {options.map((o) => (
              <Primitive.Item key={o.value} value={toItem(o.value)} className={styles.item}>
                {o.icon}
                <span className={styles.itemText}>
                  <Primitive.ItemText>{o.label}</Primitive.ItemText>
                  {o.detail !== undefined && <span className={styles.detail}>{o.detail}</span>}
                </span>
                <Primitive.ItemIndicator className={styles.tick}>
                  <CopiedIcon size={14} />
                </Primitive.ItemIndicator>
              </Primitive.Item>
            ))}
          </Primitive.Viewport>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
