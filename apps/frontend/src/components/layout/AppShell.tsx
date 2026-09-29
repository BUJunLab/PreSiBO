import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import {
  Box,
  Drawer,
  Link,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
  useMediaQuery
} from "@mui/material";
import { IconButton } from "@mui/material";
import { useMemo, useState } from "react";
import { useTheme } from "@mui/material/styles";

export interface NavItem {
  key: string;
  label: string;
}

interface AppShellProps {
  activeKey: string;
  items: NavItem[];
  onHome: () => void;
  onNavigate: (key: string) => void;
  children: React.ReactNode;
}

const drawerWidth = 204;

export function AppShell({ activeKey, items, onHome, onNavigate, children }: AppShellProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const drawerContent = useMemo(
    () => (
      <Box className="app-drawer" sx={{ height: "100%" }}>
        <Stack direction="row" spacing={1} sx={{ p: 1.5, alignItems: "center" }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            PreSiBO - v1
          </Typography>
        </Stack>
        <List sx={{ px: 0.75, pb: 14 }}>
          <ListItemButton
            onClick={() => {
              onHome();
              setDesktopOpen(false);
              setMobileOpen(false);
            }}
            sx={{
              borderRadius: 3,
              mb: 1,
              color: "#1f5f94",
              backgroundColor: "rgba(31,95,148,0.08)",
              "&:hover": {
                backgroundColor: "rgba(31,95,148,0.14)"
              }
            }}
          >
            <ListItemIcon sx={{ color: "inherit", minWidth: 36 }}>
              <HomeRoundedIcon />
            </ListItemIcon>
            <ListItemText primary="Home" />
          </ListItemButton>
          {items.map((item) => (
            <ListItemButton
              key={item.key}
              selected={item.key === activeKey}
              onClick={() => {
                onNavigate(item.key);
                setDesktopOpen(false);
                setMobileOpen(false);
              }}
              sx={{
                borderRadius: 3,
                mb: 0.5
              }}
            >
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
        <Link
          href="https://sites.bu.edu/junlab/"
          target="_blank"
          rel="noreferrer"
          underline="none"
          sx={{
            position: "absolute",
            inset: "auto 14px 14px 14px",
            display: "block"
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              px: 0.25,
              py: 0.25
            }}
          >
            <Box
              sx={{
                width: 44,
                height: 34,
                border: "2px solid #c40000",
                backgroundColor: "#b40000",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "Arial, sans-serif",
                fontSize: 16,
                fontWeight: 700,
                lineHeight: 1
              }}
            >
              BU
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{ color: "#111", fontSize: 12.5, fontWeight: 700, lineHeight: 1.15 }}
              >
                School of Medicine
              </Typography>
              <Typography
                sx={{ color: "#111", fontSize: 11.5, lineHeight: 1.15 }}
              >
                Jun Lab
              </Typography>
            </Box>
          </Box>
        </Link>
      </Box>
    ),
    [activeKey, isDesktop, items, onHome, onNavigate]
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Box
        component="nav"
        sx={{ width: { lg: desktopOpen ? drawerWidth : 0 }, flexShrink: { lg: 0 } }}
      >
        {isDesktop && desktopOpen ? (
          <Drawer
            variant="permanent"
            open
            slotProps={{
              paper: {
                sx: {
                  width: drawerWidth,
                  boxSizing: "border-box",
                  border: "none",
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(236,243,251,0.98))"
                }
              }
            }}
          >
            {drawerContent}
          </Drawer>
        ) : !isDesktop ? (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            slotProps={{
              paper: {
                sx: {
                  width: drawerWidth,
                  boxSizing: "border-box"
                }
              }
            }}
          >
            {drawerContent}
          </Drawer>
        ) : null}
      </Box>

      <IconButton
        aria-label={isDesktop ? (desktopOpen ? "Collapse sidebar" : "Open sidebar") : mobileOpen ? "Collapse sidebar" : "Open sidebar"}
        onClick={() => {
          if (isDesktop) {
            setDesktopOpen((current) => !current);
            return;
          }

          setMobileOpen((current) => !current);
        }}
        sx={{
          position: "fixed",
          top: 12,
          left: 18,
          zIndex: 1350,
          border: "1px solid rgba(31,95,148,0.12)",
          backgroundColor: "rgba(255,255,255,0.9)",
          boxShadow: "0 12px 28px rgba(16,52,81,0.08)"
        }}
      >
        {((isDesktop && desktopOpen) || (!isDesktop && mobileOpen)) ? (
          <CloseIcon />
        ) : (
          <MenuIcon />
        )}
      </IconButton>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          px: { xs: 2, md: 4 },
          pt: { xs: 10, lg: 11 },
          pb: 4
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
