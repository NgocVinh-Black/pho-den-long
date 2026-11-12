import type { ReactNode } from 'react';

export function Overlay({
  children,
  wide = false,
  modal = false,
}: {
  children: ReactNode;
  wide?: boolean;
  modal?: boolean;
}) {
  return (
    <div className={`overlay ${modal ? 'modal' : ''}`}>
      <div className={`card ${wide ? 'wide' : ''} ${modal ? 'mg' : ''}`}>{children}</div>
    </div>
  );
}
