/**
 * BACK LINK
 *
 * A Link that behaves like a browser Back button: if there is in-app
 * history it goes back to the page this page was opened from, otherwise
 * it falls back to the provided `to` path.
 */
import { forwardRef, type MouseEvent } from 'react';
import { Link, useNavigate, type LinkProps } from 'react-router-dom';

export function hasInAppHistory(): boolean {
  const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
  return idx > 0;
}

export const BackLink = forwardRef<HTMLAnchorElement, LinkProps>(
  ({ to, onClick, ...props }, ref) => {
    const navigate = useNavigate();

    const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(e);
      if (e.defaultPrevented) return;
      if (hasInAppHistory()) {
        e.preventDefault();
        navigate(-1);
      }
    };

    return <Link ref={ref} to={to} onClick={handleClick} {...props} />;
  }
);

BackLink.displayName = 'BackLink';
