import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { liveStatus, liveAnnouncement } from './logsExplorerState';

const TONE_COLOR = { warn: '#b45309', live: '#15803d' };

// The Live status next to the Live button. It owns the one-second clock behind "updated Ns ago", so the
// tick re-renders only this label and never the (large) logs table around it.
const LiveStatus = ({ live, hidden, failures, lastOkAt }) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!live) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [live]);

  const status = liveStatus({ live, hidden, failures, lastOkAt, now });
  const color = TONE_COLOR[status.tone] || '#64748b';
  return (
    <>
      <Box component='span' sx={{ fontSize: 12, fontWeight: 500, color, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
        {status.label}
      </Box>
      <Box
        component='span'
        role='status'
        aria-live='polite'
        sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}
      >
        {liveAnnouncement(status)}
      </Box>
    </>
  );
};

export default React.memo(LiveStatus);
