import { Box, Divider, Typography } from '@mui/material';

const describeDropped = (d) => {
  const tags = [];
  if (d.wasRenamed) tags.push('renamed');
  if (d.wasHidden) tags.push('hidden');
  const base = `${d.label} (${d.side})`;
  return tags.length ? `${base} — was ${tags.join(', ')}` : base;
};

// Renders a describeColumnDrift() result as a toast body, grouped by query direction (using the
// query's own title, e.g. "Req-Test") so the user knows exactly which query a change came from
// instead of guessing — the root-cause bugs behind this feature were always "wrong query" or
// "wrong side" mixups, so surfacing that is the whole point, not an afterthought.
const ColumnDriftToast = ({ drift, wasPruned = false }) => {
  const queryEntries = Object.entries(drift);

  return (
    <Box sx={{ maxWidth: 340 }}>
      <Typography variant='body2' sx={{ fontWeight: 600, mb: 0.5 }}>
        Trace Analysis columns changed in ADO since this favorite was saved
      </Typography>

      {queryEntries.map(([queryKey, { title, dropped, added }], i) => (
        <Box key={queryKey} sx={{ mt: i > 0 ? 1 : 0 }}>
          {i > 0 && <Divider sx={{ mb: 1 }} />}
          <Typography variant='caption' sx={{ display: 'block', fontWeight: 700 }}>
            {title}
          </Typography>

          {dropped.length > 0 && (
            <Box sx={{ mb: added.length > 0 ? 0.75 : 0.25 }}>
              <Typography variant='caption' color='text.secondary' sx={{ display: 'block', fontWeight: 600 }}>
                Removed ({dropped.length})
              </Typography>
              <Box component='ul' sx={{ m: 0, pl: 2.5, maxHeight: 140, overflowY: 'auto' }}>
                {dropped.map((d) => (
                  <Typography key={`${d.side}:${d.label}`} component='li' variant='caption' sx={{ lineHeight: 1.6 }}>
                    {describeDropped(d)}
                  </Typography>
                ))}
              </Box>
            </Box>
          )}

          {added.length > 0 && (
            <Box>
              <Typography variant='caption' color='text.secondary' sx={{ display: 'block', fontWeight: 600 }}>
                Added ({added.length})
              </Typography>
              <Box component='ul' sx={{ m: 0, pl: 2.5, maxHeight: 140, overflowY: 'auto' }}>
                {added.map((a) => (
                  <Typography key={`${a.side}:${a.label}`} component='li' variant='caption' sx={{ lineHeight: 1.6 }}>
                    {a.label} ({a.side})
                  </Typography>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      ))}

      {wasPruned && (
        <Typography variant='caption' sx={{ fontStyle: 'italic', display: 'block', mt: 1 }}>
          Save this favorite again to keep this fix.
        </Typography>
      )}
    </Box>
  );
};

export default ColumnDriftToast;
