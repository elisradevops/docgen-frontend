import React from 'react';
import { Button, Paper, Tooltip, Typography } from '@mui/material';

const FooterBar = ({
  message,
  disabled,
  loading,
  onClick,
  disabledTooltip = '',
  endIcon = null,
  buttonLabel = 'Send Request',
}) => {
  return (
    <Paper
      variant='outlined'
      className='footer-bar'
      sx={{
        flexShrink: 0,
        mt: 'auto',
        mb: '10px',
        mx: 'auto',
        maxWidth: 760,
        width: '100%',
        px: { xs: 1.75, md: 2.5 },
        py: { xs: 1.25, md: 1.5 },
        backgroundColor: (theme) => theme.palette.background.paper,
        display: 'flex',
        alignItems: { xs: 'stretch', sm: 'center' },
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between',
        gap: { xs: 1.25, sm: 2 },
        borderRadius: 999,
        boxShadow: (theme) => theme.shadows[4],
        border: (theme) => `1px solid ${theme.palette.divider}`,
        overflow: 'visible',
      }}
    >
      <Typography
        variant='body2'
        color={disabled ? 'warning.main' : 'text.secondary'}
        sx={{ fontWeight: 500, flex: 1, minWidth: 0 }}
      >
        {message}
      </Typography>
      <Tooltip title={disabled ? disabledTooltip : ''} arrow>
        <span>
          <Button
            endIcon={endIcon}
            loading={loading}
            loadingPosition='end'
            variant='contained'
            size='large'
            sx={{
              px: { xs: 2.75, sm: 3 },
              py: { xs: 0.75, sm: 1 },
              fontWeight: 600,
              borderRadius: 2,
              alignSelf: { xs: 'stretch', sm: 'center' },
              boxShadow: 'none',
            }}
            onClick={onClick}
            disabled={disabled || loading}
          >
            {buttonLabel}
          </Button>
        </span>
      </Tooltip>
    </Paper>
  );
};

export default FooterBar;
