import { Box, ButtonBase } from "@mui/material";

import { tableTextNeedsEllipsis } from "./tableLayoutUtils";

interface ExpandableTableCellLineProps {
  children: React.ReactNode;
  text: string;
  columnName: string;
  columnWidth: number;
  align?: "center" | "flex-start";
  onExpandColumn: (text: string) => void;
}

export function ExpandableTableCellLine({
  children,
  text,
  columnName,
  columnWidth,
  align = "center",
  onExpandColumn
}: ExpandableTableCellLineProps) {
  const needsEllipsis = tableTextNeedsEllipsis(text, columnWidth);

  return (
    <Box
      sx={{
        display: "flex",
        width: "100%",
        minWidth: 0,
        alignItems: "center",
        justifyContent: align === "center" ? "center" : "flex-start"
      }}
    >
      <Box
        sx={{
          display: "flex",
          minWidth: 0,
          overflow: "hidden",
          whiteSpace: "nowrap",
          alignItems: "center",
          justifyContent: align === "center" ? "center" : "flex-start",
          typography: "body2",
          "& > *": {
            display: "inline-flex",
            alignItems: "center",
            maxWidth: "100%",
            overflow: "hidden",
            whiteSpace: "nowrap"
          }
        }}
      >
        {children}
      </Box>
      {needsEllipsis ? (
        <ButtonBase
          aria-label={`Expand ${columnName} column to fit this value`}
          onClick={(event) => {
            event.stopPropagation();
            onExpandColumn(text);
          }}
          sx={{
            flex: "0 0 auto",
            ml: 0.25,
            px: 0.25,
            color: "primary.main",
            fontWeight: 700,
            lineHeight: 1
          }}
        >
          …
        </ButtonBase>
      ) : null}
    </Box>
  );
}
