/**
 * RoleAbbrevBadge - Displays a color-coded 2-letter role abbreviation badge.
 * Used across workflow admin, assign dialog, and job workflow rail.
 */

const ROLE_ABBREV: Record<string, { abbr: string; className: string }> = {
  admin: { abbr: 'Ad', className: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  photographer: { abbr: 'Ph', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  assistant: { abbr: 'As', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  editor: { abbr: 'Ed', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  videographer: { abbr: 'Vi', className: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
};

export function RoleAbbrevBadge({ roleName }: { roleName?: string | null }) {
  if (!roleName) return null;
  const key = roleName.toLowerCase();
  const config = ROLE_ABBREV[key] || { abbr: roleName.slice(0, 2), className: 'bg-muted text-muted-foreground border-border' };
  return (
    <span className={`inline-flex items-center justify-center text-[10px] font-bold rounded border px-1.5 py-0.5 leading-none shrink-0 ${config.className}`}>
      {config.abbr}
    </span>
  );
}
