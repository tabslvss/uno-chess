import type React from 'react';
import { Icon } from './Icon';

interface BreadcrumbItem {
  label: string;
  current?: boolean;
}

interface TopNavProps {
  breadcrumbs?: BreadcrumbItem[];
  onMenu?: () => void;
  showMenu?: boolean;
  right?: React.ReactNode;
}

export function TopNav({ breadcrumbs, onMenu, showMenu, right }: TopNavProps) {
  return (
    <nav className="top-nav glass-nav">
      <div className="top-nav-brand">
        <span className="brand-mark" aria-hidden>
          <Icon name="pawn" size={16} />
        </span>
        <span className="brand-title">UNO Chess</span>

        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="breadcrumb" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="breadcrumb-group">
                {i > 0 && <span className="breadcrumb-sep" aria-hidden>/</span>}
                <span className={`breadcrumb-item${crumb.current ? ' current' : ''}`}>
                  {crumb.label}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {right}
        {showMenu && onMenu && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onMenu}>
            <Icon name="arrow-left" size={14} />
            <span>Menu</span>
          </button>
        )}
      </div>
    </nav>
  );
}
