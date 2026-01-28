const stripBearerPrefix = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^bearer:/i.test(raw)) return raw.slice('bearer:'.length).trim();
  if (/^bearer\s+/i.test(raw)) return raw.replace(/^bearer\s+/i, '').trim();
  return raw;
};

const isJwtLike = (value) =>
  /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(String(value || '').trim());

export const isAccessToken = (token) => {
  const stripped = stripBearerPrefix(token);
  if (!stripped) return false;
  return isJwtLike(stripped);
};

export const getTokenKind = (token) => {
  const raw = String(token || '').trim();
  if (!raw) return 'none';
  return isAccessToken(raw) ? 'access' : 'pat';
};
