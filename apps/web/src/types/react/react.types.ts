import type {} from 'react';

/*
 * Inline styles may set CSS custom properties (style={{ '--value': '40%' }}) that the
 * component's stylesheet reads; React's type does not list them, so they are added here.
 */
declare module 'react' {
  // An interface merges into React's own; a Record type alias could not.
  // eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
  interface CSSProperties {
    [property: `--${string}`]: string | number | undefined;
  }
}
