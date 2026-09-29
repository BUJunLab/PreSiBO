import { Box, Link, Paper, Stack, Typography } from "@mui/material";
import { featureTiers, referenceSections } from "./aboutContent";

export function AboutPage() {
  return (
    <Paper className="panel-card" sx={{ p: { xs: 2.5, md: 4 } }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h3" gutterBottom>
            PreSiBO
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 960 }}>
            PreSiBO is a relational system that enables quick search of AD
            multi-omics and PRS profile results in a structured manner.
          </Typography>
        </Box>

        <Box>
          <Typography variant="h5" gutterBottom>
            Hierarchical Feature Tiers
          </Typography>
          <Stack component="ol" spacing={1.5} sx={{ pl: 3 }}>
            {featureTiers.map((tier) => (
              <Typography component="li" key={tier.title}>
                <strong>{tier.title}</strong>: {tier.description}
              </Typography>
            ))}
          </Stack>
        </Box>

        <Box>
          <Typography variant="h5" gutterBottom>
            References
          </Typography>
          <Stack spacing={3}>
            {referenceSections.map((section) => (
              <Box key={section.title}>
                <Typography variant="h6" gutterBottom>{section.title}</Typography>
                <Stack component="ol" spacing={1.25} sx={{ pl: 3 }}>
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
        </Box>

        <Box color="text.secondary">
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
      </Stack>
    </Paper>
  );
}
