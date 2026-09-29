import SearchIcon from "@mui/icons-material/Search";
import {
  Box,
  Button,
  Divider,
  Link,
  Paper,
  Stack,
  Typography
} from "@mui/material";
import { useState } from "react";

import { GeneSearchField } from "../../components/common/GeneSearchField";
import { featureTiers, referenceSections } from "../about/aboutContent";

interface LandingPageProps {
  onEnterApp: (gene: string | null) => void;
}

export function LandingPage({ onEnterApp }: LandingPageProps) {
  const [selectedGene, setSelectedGene] = useState<string | null>(null);

  const handleExploreTarget = () => {
    if (!selectedGene) {
      return;
    }
    onEnterApp(selectedGene);
  };

  return (
    <Box
      component="main"
      sx={{
        minHeight: "100vh",
        p: { xs: 1.5, sm: 3, lg: 4 },
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <Paper
        className="landing-card"
        sx={{ width: "100%", maxWidth: 1500, overflow: "hidden" }}
      >
        <Box
          sx={{
            px: { xs: 2.5, md: 4 },
            pt: { xs: 2.25, md: 3 },
            display: "flex",
            justifyContent: "flex-end",
            background: "linear-gradient(135deg, rgba(31,95,148,0.08), rgba(87,192,203,0.10))"
          }}
        >
          <Button
            variant="outlined"
            color="primary"
            startIcon={<SearchIcon />}
            onClick={() => onEnterApp(null)}
            sx={{
              borderRadius: 999,
              px: 2.5,
              backgroundColor: "rgba(255,255,255,0.72)"
            }}
          >
            Explore Database
          </Button>
        </Box>
        <Box
          sx={{
            p: { xs: 3, md: 5.5 },
            pt: { xs: 2.5, md: 4 },
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "minmax(0, 0.9fr) minmax(360px, 1.1fr)" },
            gap: { xs: 3, md: 6 },
            alignItems: "center",
            background: "linear-gradient(135deg, rgba(31,95,148,0.08), rgba(87,192,203,0.10))"
          }}
        >
          <Stack spacing={1.5}>
            <Typography component="h1" variant="h2" sx={{ color: "primary.main" }}>
              PreSiBO
            </Typography>
            <Typography sx={{ maxWidth: 590, fontSize: { xs: 17, md: 19 }, lineHeight: 1.65, color: "#18324a" }}>
              PreSiBO is a relational system that enables quick search of AD multi-omics
              and PRS profile results in a structured manner.
            </Typography>
          </Stack>

          <Stack spacing={2}>
            <GeneSearchField
              label="Search genes"
              value={selectedGene}
              onChange={setSelectedGene}
              onSubmit={handleExploreTarget}
            />
            <Button
              variant="contained"
              size="large"
              startIcon={<SearchIcon />}
              disabled={!selectedGene}
              onClick={handleExploreTarget}
              sx={{ alignSelf: { xs: "stretch", sm: "center" }, minWidth: 270, py: 1.35 }}
            >
              Explore Target
            </Button>
          </Stack>
        </Box>

        <Divider />

        <Box
          sx={{
            p: { xs: 2, md: 4 },
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 2.5
          }}
        >
          <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3.5 }, boxShadow: "none" }}>
            <Typography variant="h5" sx={{ color: "primary.main" }}>Hierarchical Feature Tiers</Typography>
            <Divider sx={{ my: 2 }} />
            <Stack component="ol" spacing={0} sx={{ m: 0, pl: 3 }}>
              {featureTiers.map((tier) => (
                <Box component="li" key={tier.title} sx={{ py: 1.5 }}>
                  <Typography sx={{ fontWeight: 700 }}>{tier.title}</Typography>
                  <Typography>{tier.description}</Typography>
                </Box>
              ))}
            </Stack>
          </Paper>

          <Paper
            variant="outlined"
            sx={{ p: { xs: 2.5, md: 3.5 }, boxShadow: "none" }}
          >
            <Typography variant="h5" sx={{ color: "primary.main" }}>References</Typography>
            <Divider sx={{ my: 2 }} />
            <Stack spacing={3}>
              {referenceSections.map((section) => (
                <Box key={section.title}>
                  <Typography variant="h6" sx={{ mb: 1 }}>{section.title}</Typography>
                  <Stack component="ol" spacing={1.25} sx={{ m: 0, pl: 3 }}>
                    {section.references.map((reference) => (
                      <Typography component="li" key={reference.citation}>
                        <Link href={reference.href} target="_blank" rel="noreferrer">
                          {reference.citation}
                        </Link>
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Paper>
        </Box>

        <Box sx={{ mx: { xs: 2, md: 4 }, mb: { xs: 2, md: 4 }, p: 2.5, bgcolor: "rgba(31,95,148,0.08)", borderRadius: 2 }}>
          <Typography>Copyright (c) 2026 Trustees of Boston University</Typography>
          <Typography>
            Primary software contributor: {" "}
            <Link href="https://sites.bu.edu/junlab/" target="_blank" rel="noreferrer">
              Jun Lab
            </Link>
          </Typography>
          <Typography>
            Software licensed under the MIT License; production data are not distributed in
            this repository.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
