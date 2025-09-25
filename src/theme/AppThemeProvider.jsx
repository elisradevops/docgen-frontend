import React from 'react';
import PropTypes from 'prop-types';
import { ConfigProvider, theme as antdTheme } from 'antd';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  StyledEngineProvider,
} from '@mui/material';
import { colors, spacing, shape, typography, shadows } from './tokens';

const muiTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: colors.primary,
      light: colors.primaryLight,
      dark: colors.primaryDark,
      contrastText: '#ffffff',
    },
    secondary: {
      main: colors.info,
    },
    error: {
      main: colors.danger,
    },
    success: {
      main: colors.success,
    },
    background: {
      default: colors.background,
      paper: colors.surface,
    },
    text: {
      primary: colors.textPrimary,
      secondary: colors.textSecondary,
    },
  },
  typography: {
    fontFamily: typography.fontFamily,
    fontWeightBold: typography.headingWeight,
    fontWeightRegular: typography.bodyWeight,
    h6: {
      fontWeight: typography.headingWeight,
    },
  },
  shape: {
    borderRadius: shape.borderRadius,
  },
  spacing: spacing.base,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: shape.borderRadiusSm,
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: shape.borderRadius,
          boxShadow: shadows.medium,
        },
      },
    },
  },
});

const antdTokens = {
  token: {
    colorPrimary: colors.primary,
    colorInfo: colors.info,
    colorBgBase: colors.surface,
    colorTextBase: colors.textPrimary,
    fontFamily: typography.fontFamily,
    borderRadius: shape.borderRadiusSm,
  },
  algorithm: antdTheme.defaultAlgorithm,
};

const AppThemeProvider = ({ children }) => {
  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={muiTheme}>
        <ConfigProvider {...antdTokens}>
          <CssBaseline />
          {children}
        </ConfigProvider>
      </ThemeProvider>
    </StyledEngineProvider>
  );
};

AppThemeProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default AppThemeProvider;
