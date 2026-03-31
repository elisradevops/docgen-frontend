export const sanitizeFileToken = (value) =>
  String(value || '')
    .trim()
    .replace(/\.[^/.]+$/g, '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
