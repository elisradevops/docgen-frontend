import { Box, Typography } from '@mui/material';

// Renders a describeColumnDrift() result as a toast body — a plain sentence gets unreadable once
// there are more than a couple of changed columns, so this lists them instead, each on its own
// line, with the dropped/added sections independently scrollable if long.
const ColumnDriftToast = ({ drift, wasPruned = false }) => {
  const { dropped, added } = drift;

  const describeDropped = (d) => {
    const tags = [];
    if (d.wasRenamed) tags.push('renamed');
    if (d.wasHidden) tags.push('hidden');
    return tags.length ? `${d.label} (was ${tags.join(', ')})` : d.label;
  };

  return (
    <Box sx={{ maxWidth: 320 }}>
      <Typography variant='body2' sx={{ fontWeight: 600, mb: 0.5 }}>
        Trace Analysis columns changed in ADO since this favorite was saved
      </Typography>

      {dropped.length > 0 && (
        <Box sx={{ mb: added.length > 0 ? 1 : 0.5 }}>
          <Typography variant='caption' color='text.secondary' sx={{ display: 'block', fontWeight: 600 }}>
            Removed ({dropped.length})
          </Typography>
          <Box component='ul' sx={{ m: 0, pl: 2.5, maxHeight: 140, overflowY: 'auto' }}>
            {dropped.map((d) => (
              <Typography key={d.label} component='li' variant='caption' sx={{ lineHeight: 1.6 }}>
                {describeDropped(d)}
              </Typography>
            ))}
          </Box>
        </Box>
      )}

      {added.length > 0 && (
        <Box sx={{ mb: wasPruned ? 1 : 0.5 }}>
          <Typography variant='caption' color='text.secondary' sx={{ display: 'block', fontWeight: 600 }}>
            Added ({added.length})
          </Typography>
          <Box component='ul' sx={{ m: 0, pl: 2.5, maxHeight: 140, overflowY: 'auto' }}>
            {added.map((name) => (
              <Typography key={name} component='li' variant='caption' sx={{ lineHeight: 1.6 }}>
                {name}
              </Typography>
            ))}
          </Box>
        </Box>
      )}

      {wasPruned && (
        <Typography variant='caption' sx={{ fontStyle: 'italic', display: 'block' }}>
          Save this favorite again to keep this fix.
        </Typography>
      )}
    </Box>
  );
};

export default ColumnDriftToast;
