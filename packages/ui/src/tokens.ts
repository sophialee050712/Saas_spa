// Design tokens khoi diem (master-plan muc 8). Chi sua token o day,
// khong viet mau/co chu/khoang cach tay trong component khac.
export const tokens = {
  colors: {
    primary: '#1f6f4a',
    primaryText: '#ffffff',
    status: {
      arrived: '#b58900',
      booked: '#2563eb',
      cancelled: '#dc2626',
      completed: '#15803d',
      inProgress: '#7c3aed',
      noShow: '#f87171',
      paid: '#6b7280',
    },
    surface: '#ffffff',
    text: '#111827',
  },
  fontFamily: "'Be Vietnam Pro', system-ui, sans-serif",
  fontSizes: [12, 14, 16, 20, 24, 32],
  radii: { card: 12, dialog: 16, input: 8 },
  spacing: [4, 8, 12, 16, 24, 32, 48],
} as const;

export type AppointmentStatus = keyof typeof tokens.colors.status;
