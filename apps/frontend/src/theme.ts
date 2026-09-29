import { createTheme } from "@mui/material/styles";

export const inactivePanelHeaderActionSx = {
  color: "#fff",
  borderColor: "rgba(255,255,255,0.82)",
  "&:hover": {
    color: "#fff",
    borderColor: "#fff",
    backgroundColor: "rgba(255,255,255,0.08)"
  }
} as const;

export const appTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1f5f94"
    },
    secondary: {
      main: "#d97a3a"
    },
    background: {
      default: "#eef3f8",
      paper: "#ffffff"
    }
  },
  shape: {
    borderRadius: 18
  },
  typography: {
    fontFamily: '"Arial", sans-serif',
    h1: {
      fontFamily: '"Arial", sans-serif',
      fontWeight: 700
    },
    h2: {
      fontFamily: '"Arial", sans-serif',
      fontWeight: 700
    },
    h3: {
      fontFamily: '"Arial", sans-serif',
      fontWeight: 700
    }
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          border: "1px solid rgba(31,95,148,0.08)",
          boxShadow: "0 18px 40px rgba(23, 46, 79, 0.08)"
        }
      }
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          bottom: 4
        }
      }
    }
  }
});
