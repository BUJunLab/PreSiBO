import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Box, ButtonBase, Link, Menu, MenuItem, Stack, Typography } from "@mui/material";
import { useState } from "react";

import type { RichTableCell as RichTableCellValue, TableCellAction } from "../../api/types";
import { useAppNavigation } from "../../navigation/AppNavigationContext";
import { ExpandableTableCellLine } from "./ExpandableTableCellLine";

interface RichTableCellProps {
  value: RichTableCellValue;
  align?: "center" | "flex-start";
  expanded?: boolean;
  columnName?: string;
  columnWidth?: number;
  onExpand?: () => void;
  onCollapse?: () => void;
  onExpandColumn?: (text: string) => void;
  onAction?: (action: TableCellAction) => void;
}

const ignoreColumnExpansion = () => undefined;

export function RichTableCell({
  value,
  align = "center",
  expanded = false,
  columnName = "",
  columnWidth = Number.POSITIVE_INFINITY,
  onExpand,
  onCollapse,
  onExpandColumn = ignoreColumnExpansion,
  onAction
}: RichTableCellProps) {
  const { requestNavigation } = useAppNavigation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [activeActions, setActiveActions] = useState<TableCellAction[]>([]);

  const isCollapsed = Boolean(onExpand) && value.lines.length > 1 && !expanded;

  function handleAction(action: TableCellAction) {
    if (action.kind === "navigate" && action.navigation) {
      requestNavigation(action.navigation);
      return;
    }

    if (action.kind === "detail") {
      onAction?.(action);
      return;
    }

    if (action.href) {
      window.open(action.href, "_blank", "noopener,noreferrer");
    }
  }

  function renderImageLine(imageUrl: string, imageAlt: string, key: string) {
    return (
      <Box
        key={key}
        component="img"
        src={imageUrl}
        alt={imageAlt}
        sx={{
          display: "block",
          maxWidth: 160,
          maxHeight: 120,
          width: "100%",
          height: "auto",
          objectFit: "contain",
          mx: "auto"
        }}
      />
    );
  }

  return (
    <>
      <Stack
        spacing={0.75}
        sx={{
          width: "100%",
          alignItems: align,
          justifyContent: "center",
          py: 0.5
        }}
      >
        {isCollapsed && onExpand ? (
          <ButtonBase
            onClick={(event) => {
              event.stopPropagation();
              onExpand();
            }}
            sx={{
              typography: "body2",
              color: "secondary.main",
              justifyContent: align === "center" ? "center" : "flex-start"
            }}
          >
            View all ({value.lines.length})
          </ButtonBase>
        ) : null}
        {!isCollapsed ? value.lines.map((line, index) => {
          const key = `${line.text || "line"}-${index}`;

          if (line.imageUrl) {
            return renderImageLine(line.imageUrl, line.imageAlt ?? line.text, key);
          }

          if (line.actions?.length) {
            return (
              <ExpandableTableCellLine
                key={key}
                text={line.text}
                columnName={columnName}
                columnWidth={columnWidth}
                align={align}
                onExpandColumn={onExpandColumn}
              >
                <ButtonBase
                  onClick={(event) => {
                    event.stopPropagation();
                    setAnchorEl(event.currentTarget);
                    setActiveActions(line.actions ?? []);
                  }}
                  sx={{
                    typography: "body2",
                    textAlign: align === "center" ? "center" : "left",
                    color: "primary.main",
                    justifyContent: align === "center" ? "center" : "flex-start"
                  }}
                >
                  {line.text}
                  <ExpandMoreIcon fontSize="inherit" sx={{ ml: 0.5 }} />
                </ButtonBase>
              </ExpandableTableCellLine>
            );
          }

          if (line.clickAction) {
            return (
              <ExpandableTableCellLine
                key={key}
                text={line.text}
                columnName={columnName}
                columnWidth={columnWidth}
                align={align}
                onExpandColumn={onExpandColumn}
              >
                <ButtonBase
                  onClick={(event) => {
                    event.stopPropagation();
                    handleAction(line.clickAction as TableCellAction);
                  }}
                  sx={{
                    typography: "body2",
                    textAlign: align === "center" ? "center" : "left",
                    color: "primary.main",
                    justifyContent: align === "center" ? "center" : "flex-start"
                  }}
                >
                  {line.text}
                </ButtonBase>
              </ExpandableTableCellLine>
            );
          }

          if (line.href) {
            return (
              <ExpandableTableCellLine
                key={key}
                text={line.text}
                columnName={columnName}
                columnWidth={columnWidth}
                align={align}
                onExpandColumn={onExpandColumn}
              >
                <Link
                  href={line.href}
                  target="_blank"
                  rel="noreferrer"
                  underline="hover"
                  onClick={(event) => event.stopPropagation()}
                  sx={{ textAlign: align === "center" ? "center" : "left" }}
                >
                  {line.text}
                </Link>
              </ExpandableTableCellLine>
            );
          }

          return (
            <ExpandableTableCellLine
              key={key}
              text={line.text}
              columnName={columnName}
              columnWidth={columnWidth}
              align={align}
              onExpandColumn={onExpandColumn}
            >
              <Typography
                variant="body2"
                sx={{
                  width: "100%",
                  textAlign: align === "center" ? "center" : "left"
                }}
              >
                {line.text}
              </Typography>
            </ExpandableTableCellLine>
          );
        }) : null}
        {!isCollapsed && expanded && value.lines.length > 1 && onCollapse ? (
          <ButtonBase
            onClick={(event) => {
              event.stopPropagation();
              onCollapse();
            }}
            sx={{
              typography: "body2",
              color: "secondary.main",
              justifyContent: align === "center" ? "center" : "flex-start",
              mt: 0.25
            }}
          >
            Collapse
          </ButtonBase>
        ) : null}
      </Stack>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => {
          setAnchorEl(null);
          setActiveActions([]);
        }}
      >
        {activeActions.map((action) => (
          <MenuItem
            key={`${action.label}-${action.href ?? action.detailId ?? action.navigation?.page ?? "action"}`}
            onClick={(event) => {
              event.stopPropagation();
              setAnchorEl(null);
              setActiveActions([]);
              handleAction(action);
            }}
          >
            {action.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
