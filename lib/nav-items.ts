// Single source of truth for the top nav — kept as its own module (same pattern as the
// controller-crm original) so Topbar.tsx and any future per-user visibility logic read one list.
export const NAV_ITEMS = [
  { key: 'dashboard', href: '/dashboard', label: '🏠 ראשי' },
  { key: 'clients', href: '/clients', label: '👥 לקוחות' },
  { key: 'reminders', href: '/reminders', label: '🔔 תזכורות' },
] as const

export const ADMIN_NAV_ITEMS = [
  { key: 'admin-form-types', href: '/admin/form-types', label: '📋 קטלוג טפסים' },
  { key: 'admin-users', href: '/admin/users', label: '🧑‍💼 משתמשים' },
  { key: 'admin-settings', href: '/admin/settings', label: '⚙ הגדרות' },
] as const
