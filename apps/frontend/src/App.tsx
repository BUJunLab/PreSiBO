import { Box, ButtonBase, Stack, Typography } from "@mui/material";
import { startTransition, useMemo, useState } from "react";

import { AboutPage } from "./features/about/AboutPage";
import { DrugPage } from "./features/drug/DrugPage";
import { LandingPage } from "./features/landing/LandingPage";
import { NetworkPage } from "./features/network/NetworkPage";
import { TargetPage } from "./features/target/TargetPage";
import { AppShell } from "./components/layout/AppShell";
import {
  AppNavigationProvider,
  type AppNavigationIntent,
  type PageKey
} from "./navigation/AppNavigationContext";

const navItems = [
  { key: "target", label: "Target" },
  { key: "network", label: "Network" },
  { key: "drug", label: "Drug" }
] as const;

export default function App() {
  const [hasEnteredApp, setHasEnteredApp] = useState(false);
  const [activePage, setActivePage] = useState<PageKey>("about");
  const [activeTabLabel, setActiveTabLabel] = useState("Overview");
  const [initialGene, setInitialGene] = useState<string | null>(null);
  const [sharedGene, setSharedGene] = useState<string | null>(null);
  const [navigationIntent, setNavigationIntent] = useState<AppNavigationIntent | null>(null);
  const [hasVisitedDrug, setHasVisitedDrug] = useState(false);
  const returnHome = () => {
    startTransition(() => {
      setHasEnteredApp(false);
      setInitialGene(null);
      setSharedGene(null);
      setNavigationIntent(null);
      setHasVisitedDrug(false);
      setActivePage("about");
      setActiveTabLabel("Overview");
    });
  };
  const enterInterface = (gene: string | null) => {
    startTransition(() => {
      const navigation: AppNavigationIntent = {
        id: Date.now(),
        page: "target",
        tab: "Predictor"
      };

      if (gene) {
        navigation.gene = gene;
      }

      setInitialGene(gene);
      setSharedGene(gene);
      setActivePage("target");
      setActiveTabLabel("Predictor");
      setNavigationIntent(navigation);
      setHasEnteredApp(true);
    });
  };
  const pageContent = useMemo(() => {
    return (
      <>
        <Box sx={{ display: activePage === "target" ? "block" : "none" }}>
          <TargetPage />
        </Box>
        {activePage === "network" || activePage === "geneProfiles" ? <NetworkPage /> : null}
        {hasVisitedDrug ? (
          <Box sx={{ display: activePage === "drug" ? "block" : "none" }}>
            <DrugPage />
          </Box>
        ) : null}
        {activePage === "about" ? <AboutPage /> : null}
      </>
    );
  }, [activePage, hasVisitedDrug]);

  if (!hasEnteredApp) {
    return (
      <LandingPage
        onEnterApp={enterInterface}
      />
    );
  }

  return (
    <AppNavigationProvider
      value={{
        activePage,
        activeTabLabel,
        initialGene,
        sharedGene,
        setSharedGene,
        navigate: (page) => setActivePage(page),
        setActiveTabLabel,
        navigationIntent,
        requestNavigation: (intent) => {
          startTransition(() => {
            if (intent.page === "drug") {
              setHasVisitedDrug(true);
            }
            if (intent.gene !== undefined) {
              setSharedGene(intent.gene);
            }
            setActivePage(intent.page === "geneProfiles" ? "network" : intent.page);
            setNavigationIntent({
              ...intent,
              id: Date.now()
            });
          });
        }
      }}
    >
      <AppShell
        activeKey={activePage}
        items={navItems.map((item) => ({ key: item.key, label: item.label }))}
        onHome={returnHome}
        onNavigate={(nextPage) => {
          startTransition(() => {
            if (nextPage === "drug") {
              setHasVisitedDrug(true);
            }
            setActivePage(nextPage as PageKey);
            setActiveTabLabel(
              nextPage === "target"
                  ? "Predictor"
                  : nextPage === "network"
                    ? "Signature Guided Networks"
                : "M6"
            );
          });
        }}
      >
        <Stack spacing={2.25}>
          <Box className="app-title-bar">
            <Stack
              direction="row"
              spacing={1.5}
              sx={{
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              <Stack spacing={0.35} sx={{ minWidth: 0 }}>
                <ButtonBase
                  aria-label="Go to home"
                  onClick={() => returnHome()}
                  sx={{
                    alignSelf: "flex-start",
                    borderRadius: 1.5,
                    minWidth: 0,
                    p: 0.5,
                    textAlign: "left",
                    "&:hover": {
                      backgroundColor: "rgba(255,255,255,0.32)"
                    }
                  }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                    PreSiBO - v1
                  </Typography>
                </ButtonBase>
                <Typography variant="body2" sx={{ lineHeight: 1.2 }}>
                  {navItems.find((item) => item.key === (activePage === "geneProfiles" ? "network" : activePage))?.label ?? "Home"}
                  {" / "}
                  {activeTabLabel}
                </Typography>
              </Stack>
            </Stack>
          </Box>
          {pageContent}
        </Stack>
      </AppShell>
    </AppNavigationProvider>
  );
}
