import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 mb-4 sm:mb-6">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl xl:text-3xl font-display font-bold text-foreground truncate">
          {title}
        </h1>
        {description && (
          <p className="text-sm sm:text-base text-muted-foreground mt-0.5 sm:mt-1 line-clamp-2">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 sm:gap-3 shrink-0">{actions}</div>}
    </div>
  );
}
