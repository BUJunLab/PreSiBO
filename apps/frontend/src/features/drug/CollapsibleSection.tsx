import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Typography
} from "@mui/material";

interface CollapsibleSectionProps {
  title: string;
  expanded: boolean;
  onChange: (expanded: boolean) => void;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  expanded,
  onChange,
  children
}: CollapsibleSectionProps) {
  return (
    <Accordion
      expanded={expanded}
      onChange={(_event, nextExpanded) => onChange(nextExpanded)}
      disableGutters
      elevation={0}
      sx={{
        borderRadius: 1,
        overflow: "hidden",
        border: "1px solid rgba(31,95,148,0.12)",
        backgroundColor: "rgba(255,255,255,0.8)",
        "&:before": {
          display: "none"
        }
      }}
      slotProps={{
        transition: {
          unmountOnExit: true
        }
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{
          px: 2,
          py: 0.5,
          background:
            "linear-gradient(180deg, rgba(245,249,253,0.96), rgba(233,241,249,0.96))"
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 2 }}>{children}</AccordionDetails>
    </Accordion>
  );
}
