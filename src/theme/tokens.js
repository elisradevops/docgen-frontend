export const colors = {
  primary: '#1B458F',
  primaryLight: '#3B60C0',
  primaryDark: '#102951',
  secondary: '#FDE134',
  secondaryMuted: '#F5D145',
  background: '#f8fafc',
  surface: '#ffffff',
  textPrimary: '#0f172a',
  textSecondary: '#334155',
  danger: '#D1434B',
  success: '#15803d',
  info: '#2563eb',
};

// Log level colors, shared by every Monitoring screen (Logs explorer, run timeline, filter
// settings) instead of each keeping its own copy. error/info reuse the brand semantic tokens;
// warn is MUI's default warning.main.
export const levelColors = {
  error: colors.danger,
  warn: '#ED6C02',
  info: colors.info,
  debug: '#94a3b8',
};

// Run-compare diff palette: strong text colors for headers/counts, soft backgrounds for rows.
export const diffColors = {
  removed: colors.danger,
  added: '#22863a',
  removedText: '#9B0000',
  addedText: '#006620',
  neutral: '#64748b',
  muted: '#94a3b8',
  removedBg: 'rgba(209,67,75,0.08)',
  addedBg: 'rgba(34,134,58,0.08)',
  removedFaint: 'rgba(209,67,75,0.04)',
  addedFaint: 'rgba(34,134,58,0.04)',
  removedChipBg: 'rgba(209,67,75,0.09)',
  addedChipBg: 'rgba(34,134,58,0.09)',
  removedChipBorder: 'rgba(209,67,75,0.28)',
  addedChipBorder: 'rgba(34,134,58,0.28)',
};

export const spacing = {
  base: 8,
};

export const shape = {
  borderRadius: 10,
  borderRadiusSm: 6,
};

export const shadows = {
  medium: '0px 6px 20px rgba(15, 23, 42, 0.12)',
};

export const typography = {
  fontFamily: "'Inter', 'Roboto', 'Helvetica', 'Arial', sans-serif",
  headingWeight: 700,
  bodyWeight: 400,
};
