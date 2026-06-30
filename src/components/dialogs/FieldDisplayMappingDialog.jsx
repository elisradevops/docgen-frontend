import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Popover,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  InputAdornment,
  Stack,
} from '@mui/material';
import EditNoteIcon from '@mui/icons-material/EditNote';
import SearchIcon from '@mui/icons-material/Search';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import React, { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { COLOR_REQ, COLOR_TEST_CASE } from '../../constants/traceColors';

const TYPE_COLORS = { Requirement: COLOR_REQ, 'Test Case': COLOR_TEST_CASE };
// TODO: theme token — no equivalent in tokens.js; replace when palette is extended
const TYPE_COLORS_SELECTED = { Requirement: '#b8cfe6', 'Test Case': '#cdc5df' };

function TabBadge({ type, count }) {
  if (!count) return null;
  return (
    <Box component='span' sx={{ ml: 0.75, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', bgcolor: TYPE_COLORS_SELECTED[type], borderRadius: '10px', px: 0.75, minWidth: 18, height: 18, fontSize: '0.68rem', fontWeight: 700, lineHeight: 1, color: 'text.primary' }}>
      {count}
    </Box>
  );
}

// ADO referenceNames + linked-mode pseudo-keys that are always shown and never dragged
const ALWAYS_VISIBLE_REFS = new Set(['System.Id', 'System.Title', 'Req ID', 'Test Case ID', 'Title']);
const EXCLUDED_FIELD_REFS = new Set(['System.WorkItemType']);

// Locked columns in linked mode (only Customer ID is configurable)
const LINKED_REQ_COLUMNS = {
  Requirement: [{ referenceName: 'Customer ID', name: 'Customer ID' }],
  'Test Case': [],
};

// Returns { 'req-test': { Requirement, 'Test Case' }, 'test-req': { Requirement, 'Test Case' } }
function deriveFieldList(traceAnalysisMode, reqTestQuery, testReqQuery, columnMetadata) {
  if (traceAnalysisMode === 'linkedRequirement') {
    return { 'req-test': LINKED_REQ_COLUMNS, 'test-req': LINKED_REQ_COLUMNS };
  }
  if (traceAnalysisMode !== 'query') {
    return { 'req-test': { Requirement: [], 'Test Case': [] }, 'test-req': { Requirement: [], 'Test Case': [] } };
  }

  const filterMeta = (cols) =>
    (cols || []).filter(
      (c) => c?.referenceName && !EXCLUDED_FIELD_REFS.has(c.referenceName) && !ALWAYS_VISIBLE_REFS.has(c.referenceName)
    );

  const fallbackFromQuery = (query) => {
    const seen = new Set();
    const cols = [];
    for (const col of (query?.columns || [])) {
      if (!col?.referenceName || seen.has(col.referenceName)) continue;
      if (EXCLUDED_FIELD_REFS.has(col.referenceName)) continue;
      if (ALWAYS_VISIBLE_REFS.has(col.referenceName)) continue;
      seen.add(col.referenceName);
      cols.push({ referenceName: col.referenceName, name: col.name });
    }
    return cols;
  };

  const resolveQuerySides = (queryKey, query) => {
    const meta = columnMetadata?.[queryKey];
    if (meta) {
      return {
        Requirement: filterMeta(meta.Requirement),
        'Test Case': filterMeta(meta['Test Case']),
      };
    }
    // Fallback: use this query's own declared columns for both sides (loading / no metadata)
    const fb = fallbackFromQuery(query);
    return { Requirement: fb, 'Test Case': fb };
  };

  return {
    'req-test': resolveQuerySides('req-test', reqTestQuery),
    'test-req': resolveQuerySides('test-req', testReqQuery),
  };
}

function countMods(mappingByType, visibilityByType, type) {
  const renames = Object.keys(mappingByType[type] || {}).length;
  const hidden = Object.values(visibilityByType[type] || {}).filter((v) => v === false).length;
  return renames + hidden;
}

// Sortable row component
function SortableFieldRow({ field, selectedType, workingMapping, workingVisibility, typeColor, onToggleVisibility, onFieldOverride }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.referenceName,
  });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const isHidden = workingVisibility[selectedType]?.[field.referenceName] === false;
  const hasOverride = Boolean(workingMapping[selectedType]?.[field.referenceName]?.trim());

  return (
    <Box
      ref={setNodeRef}
      style={style}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 0.75,
        px: 0.5,
        borderRadius: 1,
        opacity: isDragging ? 0.5 : isHidden ? 0.4 : 1,
        transition: 'opacity 0.15s ease',
        bgcolor: isDragging ? 'action.selected' : 'transparent',
        '&:hover': { bgcolor: isDragging ? 'action.selected' : 'action.hover' },
      }}
    >
      {/* Drag handle */}
      <Box
        {...attributes}
        {...listeners}
        sx={{ cursor: 'grab', color: 'text.disabled', flexShrink: 0, display: 'flex', alignItems: 'center', '&:active': { cursor: 'grabbing' } }}
      >
        <DragIndicatorIcon sx={{ fontSize: 16 }} />
      </Box>

      {/* Field tile */}
      <Tooltip
        title={isHidden ? `Click to show ${field.name}` : field.referenceName}
        placement='left'
      >
        <Box
          sx={{
            flex: '0 0 150px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: typeColor,
            borderRadius: 1,
            pl: 1,
            pr: 0.5,
            py: 0.5,
            minHeight: 34,
            cursor: 'pointer',
            borderLeft: hasOverride ? '3px solid' : '3px solid transparent',
            borderLeftColor: hasOverride ? 'primary.main' : 'transparent',
            transition: 'border-color 0.15s ease',
          }}
          onClick={() => onToggleVisibility(field.referenceName)}
        >
          <Typography
            variant='body2'
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              fontWeight: 500,
              flexGrow: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              textDecoration: isHidden ? 'line-through' : 'none',
              color: isHidden ? 'text.disabled' : 'text.primary',
              mr: 0.5,
            }}
          >
            {field.name}
          </Typography>
          <IconButton size='small' tabIndex={-1} sx={{ p: 0.25, flexShrink: 0, pointerEvents: 'none', color: 'action.active' }}>
            {isHidden ? <VisibilityOffIcon sx={{ fontSize: 13 }} /> : <VisibilityIcon sx={{ fontSize: 13 }} />}
          </IconButton>
        </Box>
      </Tooltip>

      <ArrowForwardIcon fontSize='small' sx={{ flexShrink: 0, color: 'text.disabled', fontSize: 16 }} />

      <TextField
        size='small'
        variant='outlined'
        placeholder='Rename...'
        value={workingMapping[selectedType]?.[field.referenceName] || ''}
        onChange={(e) => onFieldOverride(field.referenceName, e.target.value)}
        disabled={isHidden}
        sx={{ flex: 1 }}
      />
    </Box>
  );
}

const FieldDisplayMappingDialog = ({
  fieldDisplayMapping = {},
  onMappingChange,
  fieldVisibility = {},
  onVisibilityChange,
  fieldOrder = {},
  onOrderChange,
  traceAnalysisMode = 'none',
  reqTestQuery = null,
  testReqQuery = null,
  columnMetadata = {}, // {} = not yet fetched / loading; { 'req-test': { Requirement, 'Test Case' }, 'test-req': { ... } } = fetched per query
  iconOnly = false,
}) => {
  const [open, setOpen] = useState(false);
  const [infoAnchor, setInfoAnchor] = useState(null);
  const [workingMapping, setWorkingMapping] = useState({});
  const [workingVisibility, setWorkingVisibility] = useState({});
  const [workingOrder, setWorkingOrder] = useState({});
  const [selectedType, setSelectedType] = useState('Requirement');
  const [selectedQuery, setSelectedQuery] = useState(() => reqTestQuery ? 'req-test' : 'test-req');
  useEffect(() => {
    if (!open) return;
    setSelectedQuery(reqTestQuery ? 'req-test' : 'test-req');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const [searchText, setSearchText] = useState('');

  // Auto-correct selectedQuery if the previously selected query is no longer available
  useEffect(() => {
    if (selectedQuery === 'req-test' && !reqTestQuery && testReqQuery) setSelectedQuery('test-req');
    if (selectedQuery === 'test-req' && !testReqQuery && reqTestQuery) setSelectedQuery('req-test');
  }, [reqTestQuery, testReqQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const fieldsByQuery = useMemo(
    () => deriveFieldList(traceAnalysisMode, reqTestQuery, testReqQuery, columnMetadata),
    [traceAnalysisMode, reqTestQuery, testReqQuery, columnMetadata]
  );
  const fieldsByType = fieldsByQuery[selectedQuery] || { Requirement: [], 'Test Case': [] };

  useEffect(() => {
    if (!open) return;
    setWorkingMapping({ ...fieldDisplayMapping });
    setWorkingVisibility({ ...fieldVisibility });

    // Initialize order per query per side: respect saved order, append new fields
    const initOrder = {};
    for (const [queryKey, sides] of Object.entries(fieldsByQuery)) {
      initOrder[queryKey] = {};
      for (const [side, fields] of Object.entries(sides)) {
        const existing = fieldOrder?.[queryKey]?.[side] || [];
        const knownRefs = new Set(existing);
        initOrder[queryKey][side] = [
          ...existing.filter((ref) => fields.some((f) => f.referenceName === ref)),
          ...fields.filter((f) => !knownRefs.has(f.referenceName)).map((f) => f.referenceName),
        ];
      }
    }
    setWorkingOrder(initOrder);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Augment workingOrder with fields that arrived after dialog opened (e.g. late columnMetadata fetch).
  // Append-only: never resets mapping/visibility; identity-stable when nothing changes.
  useEffect(() => {
    if (!open) return;
    setWorkingOrder((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [queryKey, sides] of Object.entries(fieldsByQuery)) {
        const nextSides = { ...(next[queryKey] || {}) };
        for (const [side, fields] of Object.entries(sides)) {
          const existing = nextSides[side] || [];
          const known = new Set(existing);
          const additions = fields
            .filter((f) => !known.has(f.referenceName))
            .map((f) => f.referenceName);
          if (additions.length) {
            nextSides[side] = [...existing, ...additions];
            changed = true;
          }
        }
        next[queryKey] = nextSides;
      }
      return changed ? next : prev;
    });
  }, [open, fieldsByQuery]);

  // Ordered visible fields for current query + side tab
  const visibleFields = useMemo(() => {
    const allFields = fieldsByType[selectedType] || [];
    const order = workingOrder[selectedQuery]?.[selectedType] || [];

    // Sort by order, unknown refs appended
    const byRef = Object.fromEntries(allFields.map((f) => [f.referenceName, f]));
    const orderSet = new Set(order);
    const orderedRefs = [
      ...order.filter((ref) => byRef[ref]),
      ...allFields.filter((f) => !orderSet.has(f.referenceName)).map((f) => f.referenceName),
    ];
    const sorted = orderedRefs.map((ref) => byRef[ref]).filter(Boolean);

    if (!searchText.trim()) return sorted;
    const lower = searchText.toLowerCase();
    return sorted.filter((f) => f.name.toLowerCase().includes(lower));
  }, [fieldsByType, selectedType, selectedQuery, searchText, workingOrder]);

  // Per-side counts for the active query (used for in-dialog badges and reset logic)
  const modReq = useMemo(() => countMods(workingMapping[selectedQuery] || {}, workingVisibility[selectedQuery] || {}, 'Requirement'), [workingMapping, workingVisibility, selectedQuery]);
  const modTest = useMemo(() => countMods(workingMapping[selectedQuery] || {}, workingVisibility[selectedQuery] || {}, 'Test Case'), [workingMapping, workingVisibility, selectedQuery]);
  const modCountByType = { Requirement: modReq, 'Test Case': modTest };
  // Total across all queries for the trigger button
  const totalCount = useMemo(() => {
    let n = 0;
    for (const qKey of ['req-test', 'test-req']) {
      n += countMods(workingMapping[qKey] || {}, workingVisibility[qKey] || {}, 'Requirement');
      n += countMods(workingMapping[qKey] || {}, workingVisibility[qKey] || {}, 'Test Case');
    }
    return n;
  }, [workingMapping, workingVisibility]);
  // Per-direction total for the direction pills
  const modByDirection = useMemo(() => {
    const forKey = (key) =>
      countMods(workingMapping[key] || {}, workingVisibility[key] || {}, 'Requirement') +
      countMods(workingMapping[key] || {}, workingVisibility[key] || {}, 'Test Case');
    return { 'req-test': forKey('req-test'), 'test-req': forKey('test-req') };
  }, [workingMapping, workingVisibility]);

  const handleFieldOverride = (referenceName, value) => {
    setWorkingMapping((prev) => {
      const querySlice = { ...(prev[selectedQuery] || {}) };
      const typeMap = { ...(querySlice[selectedType] || {}) };
      if (value.trim()) typeMap[referenceName] = value;
      else delete typeMap[referenceName];
      querySlice[selectedType] = typeMap;
      return { ...prev, [selectedQuery]: querySlice };
    });
  };

  const handleToggleVisibility = (referenceName) => {
    if (ALWAYS_VISIBLE_REFS.has(referenceName)) return;
    setWorkingVisibility((prev) => {
      const querySlice = { ...(prev[selectedQuery] || {}) };
      const typeMap = { ...(querySlice[selectedType] || {}) };
      if (typeMap[referenceName] === false) delete typeMap[referenceName];
      else typeMap[referenceName] = false;
      querySlice[selectedType] = typeMap;
      return { ...prev, [selectedQuery]: querySlice };
    });
  };

  const allHidden =
    visibleFields.length > 0 &&
    visibleFields.every((f) => workingVisibility[selectedQuery]?.[selectedType]?.[f.referenceName] === false);

  const handleToggleAll = () => {
    setWorkingVisibility((prev) => {
      const querySlice = { ...(prev[selectedQuery] || {}) };
      const typeMap = { ...(querySlice[selectedType] || {}) };
      if (allHidden) visibleFields.forEach((f) => delete typeMap[f.referenceName]);
      else visibleFields.forEach((f) => { typeMap[f.referenceName] = false; });
      querySlice[selectedType] = typeMap;
      return { ...prev, [selectedQuery]: querySlice };
    });
  };

  const handleClear = () => {
    setWorkingMapping((prev) => {
      const q = { ...(prev[selectedQuery] || {}) };
      delete q[selectedType];
      return { ...prev, [selectedQuery]: q };
    });
    setWorkingVisibility((prev) => {
      const q = { ...(prev[selectedQuery] || {}) };
      delete q[selectedType];
      return { ...prev, [selectedQuery]: q };
    });
    setWorkingOrder((prev) => {
      const base = fieldsByType[selectedType] || [];
      const q = { ...(prev[selectedQuery] || {}) };
      q[selectedType] = base.map((f) => f.referenceName);
      return { ...prev, [selectedQuery]: q };
    });
  };

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    setWorkingOrder((prev) => {
      const q = { ...(prev[selectedQuery] || {}) };
      const items = q[selectedType] || visibleFields.map((f) => f.referenceName);
      const oldIdx = items.indexOf(String(active.id));
      const newIdx = items.indexOf(String(over.id));
      if (oldIdx === -1 || newIdx === -1) return prev;
      q[selectedType] = arrayMove(items, oldIdx, newIdx);
      return { ...prev, [selectedQuery]: q };
    });
  };

  const handleClose = () => {
    const cleanSides = (sides) =>
      Object.fromEntries(Object.entries(sides || {}).filter(([, v]) => v && Object.keys(v).length > 0));
    const cleanQueries = (src) =>
      Object.fromEntries(
        Object.entries(src || {})
          .map(([qKey, sides]) => [qKey, cleanSides(sides)])
          .filter(([, sides]) => Object.keys(sides).length > 0)
      );
    onMappingChange(cleanQueries(workingMapping));
    if (onVisibilityChange) onVisibilityChange(cleanQueries(workingVisibility));
    if (onOrderChange) onOrderChange({ ...workingOrder });
    setOpen(false);
  };

  const isDisabled = traceAnalysisMode === 'none' || (iconOnly && !testReqQuery);
  const hasMappings = modCountByType[selectedType] > 0;
  const renamedCount = Object.keys(workingMapping[selectedQuery]?.[selectedType] || {}).length;
  const hiddenCount = Object.values(workingVisibility[selectedQuery]?.[selectedType] || {}).filter((v) => v === false).length;
  const statusParts = [];
  if (renamedCount > 0) statusParts.push(`${renamedCount} renamed`);
  if (hiddenCount > 0) statusParts.push(`${hiddenCount} hidden`);

  const typeColor = TYPE_COLORS[selectedType];

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  return (
    <>
      {iconOnly ? (
        <Tooltip title={isDisabled ? 'Select a query first' : 'Column Settings'}>
          <span>
            <IconButton
              onClick={() => setOpen(true)}
              disabled={isDisabled}
              color='secondary'
              size='small'
              sx={{ position: 'relative', mt: 0.5 }}
            >
              <EditNoteIcon />
              {totalCount > 0 && (
                <Box sx={{ position: 'absolute', top: 2, right: 2, width: 14, height: 14, bgcolor: 'primary.main', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: '#fff', pointerEvents: 'none' }}>
                  {totalCount}
                </Box>
              )}
            </IconButton>
          </span>
        </Tooltip>
      ) : (
        <Tooltip title={
          traceAnalysisMode === 'none'
            ? 'Enable trace analysis first'
            : traceAnalysisMode === 'linkedRequirement'
            ? 'Configure linked requirement column display'
            : 'Configure columns for both trace directions — Req → TC and TC → Req settings are independent'
        }>
          <span>
            <Button
              variant='outlined'
              color='secondary'
              onClick={() => setOpen(true)}
              disabled={isDisabled}
              endIcon={
                totalCount > 0 ? (
                  <Chip label={totalCount} size='small' sx={{ height: 20, bgcolor: 'primary.main', color: '#fff', fontWeight: 700, fontSize: '0.68rem', '& .MuiChip-label': { px: 0.75 } }} />
                ) : (
                  <EditNoteIcon />
                )
              }
              sx={{ width: '100%', whiteSpace: 'nowrap' }}
            >
              Column Settings
            </Button>
          </span>
        </Tooltip>
      )}

      <Dialog open={open} onClose={handleClose} maxWidth='sm' fullWidth PaperProps={{ sx: { borderRadius: 2, minWidth: 480 } }}>
        <DialogTitle sx={{ pb: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Stack direction='row' alignItems='flex-start' justifyContent='space-between'>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Stack direction='row' alignItems='center' spacing={0.5}>
                <Typography variant='h6' component='div' sx={{ lineHeight: 1.3 }}>Column Settings</Typography>
                <Tooltip title='How to use' arrow>
                  <IconButton size='small' onClick={(e) => setInfoAnchor(e.currentTarget)} sx={{ color: 'text.disabled', '&:hover': { color: 'text.secondary' } }}>
                    <InfoOutlinedIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                </Tooltip>
              </Stack>
              <Popover
                open={Boolean(infoAnchor)}
                anchorEl={infoAnchor}
                onClose={() => setInfoAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                PaperProps={{ sx: { maxWidth: 320, borderRadius: 2, p: 0 } }}
              >
                <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
                  <Typography variant='subtitle2' sx={{ fontWeight: 700 }}>How to use Column Settings</Typography>
                </Box>
                <List dense disablePadding sx={{ px: 1, pb: 1 }}>
                  <ListItem sx={{ alignItems: 'flex-start', py: 0.5 }}>
                    <ListItemText
                      primary='Direction chips (Req → TC / TC → Req)'
                      secondary='Switch between the two trace query directions. Each direction has fully independent column settings.'
                      primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                  <ListItem sx={{ alignItems: 'flex-start', py: 0.5 }}>
                    <ListItemText
                      primary='Requirement / Test Case tabs'
                      secondary='Switch between the two work item types within the selected direction.'
                      primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                  <ListItem sx={{ alignItems: 'flex-start', py: 0.5 }}>
                    <ListItemText
                      primary='Column tile — click to show / hide'
                      secondary='Click a tile to toggle column visibility. Strikethrough means the column is hidden in the output.'
                      primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                  <ListItem sx={{ alignItems: 'flex-start', py: 0.5 }}>
                    <ListItemText
                      primary='Rename field — type a display name'
                      secondary='Override the column header in the document. Leave blank to use the original ADO field name.'
                      primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                  <ListItem sx={{ alignItems: 'flex-start', py: 0.5 }}>
                    <ListItemText
                      primary='Drag handle — reorder columns'
                      secondary='Drag rows up or down to change the column order in the generated trace tables.'
                      primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                  <ListItem sx={{ alignItems: 'flex-start', py: 0.5 }}>
                    <ListItemText
                      primary='Reset'
                      secondary='Clears all renames and visibility overrides for the current direction and side.'
                      primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                </List>
              </Popover>
              {traceAnalysisMode === 'query' && (reqTestQuery || testReqQuery) ? (
                reqTestQuery && testReqQuery ? (
                  <Stack direction='row' spacing={0.75} alignItems='center' sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                    <Tooltip title={reqTestQuery?.title ?? 'No query selected for this direction'} arrow>
                      <span>
                        <Chip
                          label={
                            <Box component='span' sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              Req → TC
                              {modByDirection['req-test'] > 0 && (
                                <Box component='span' sx={{ fontSize: '0.62rem', fontWeight: 700, bgcolor: 'rgba(0,0,0,0.15)', borderRadius: '10px', px: 0.6, py: 0.1, lineHeight: 1.4 }}>
                                  {modByDirection['req-test']}
                                </Box>
                              )}
                            </Box>
                          }
                          size='small'
                          clickable={!!reqTestQuery}
                          disabled={!reqTestQuery}
                          onClick={reqTestQuery ? () => { setSelectedQuery('req-test'); setSearchText(''); } : undefined}
                          sx={{
                            fontWeight: selectedQuery === 'req-test' ? 600 : 400,
                            bgcolor: selectedQuery === 'req-test' ? '#b8cfe6' : 'transparent',
                            border: '1px solid',
                            borderColor: selectedQuery === 'req-test' ? '#b8cfe6' : 'divider',
                            transition: 'all 0.15s ease',
                            '&:hover': { bgcolor: selectedQuery === 'req-test' ? '#a8bfd6' : 'action.hover' },
                          }}
                        />
                      </span>
                    </Tooltip>
                    <Tooltip title={testReqQuery?.title ?? 'No query selected for this direction'} arrow>
                      <span>
                        <Chip
                          label={
                            <Box component='span' sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              TC → Req
                              {modByDirection['test-req'] > 0 && (
                                <Box component='span' sx={{ fontSize: '0.62rem', fontWeight: 700, bgcolor: 'rgba(0,0,0,0.15)', borderRadius: '10px', px: 0.6, py: 0.1, lineHeight: 1.4 }}>
                                  {modByDirection['test-req']}
                                </Box>
                              )}
                            </Box>
                          }
                          size='small'
                          clickable={!!testReqQuery}
                          disabled={!testReqQuery}
                          onClick={testReqQuery ? () => { setSelectedQuery('test-req'); setSearchText(''); } : undefined}
                          sx={{
                            fontWeight: selectedQuery === 'test-req' ? 600 : 400,
                            bgcolor: selectedQuery === 'test-req' ? '#cdc5df' : 'transparent',
                            border: '1px solid',
                            borderColor: selectedQuery === 'test-req' ? '#cdc5df' : 'divider',
                            transition: 'all 0.15s ease',
                            '&:hover': { bgcolor: selectedQuery === 'test-req' ? '#bdb5cf' : 'action.hover' },
                          }}
                        />
                      </span>
                    </Tooltip>
                    <Tooltip title={(selectedQuery === 'req-test' ? reqTestQuery?.title : testReqQuery?.title) ?? ''} arrow>
                      <Typography variant='caption' sx={{ color: 'text.disabled', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                        {selectedQuery === 'req-test' ? reqTestQuery?.title : testReqQuery?.title}
                      </Typography>
                    </Tooltip>
                  </Stack>
                ) : (
                  <Typography variant='caption' sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                    {reqTestQuery ? `Req → TC: ${reqTestQuery.title}` : `TC → Req: ${testReqQuery.title}`}
                  </Typography>
                )
              ) : (
                <Typography variant='caption' color='text.secondary'>Show/hide, rename, or reorder columns in the generated trace tables</Typography>
              )}
            </Box>
            <Tooltip title={hasMappings ? `Reset ${selectedType} columns` : 'No changes to reset'}>
              <span>
                <Button size='small' color='warning' onClick={handleClear} disabled={!hasMappings} startIcon={<DeleteSweepIcon />} sx={{ textTransform: 'none', mt: 0.25, flexShrink: 0 }}>
                  Reset
                </Button>
              </span>
            </Tooltip>
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ pt: '12px !important' }}>
          <Stack spacing={1.5}>

            {traceAnalysisMode === 'linkedRequirement' && (
              <Alert severity='info' sx={{ py: 0.5 }}>
                In linked mode only Customer ID is configurable. Switch to query mode for full column control.
              </Alert>
            )}

            {/* Side tabs — fill colors restored */}
            <ToggleButtonGroup
              value={selectedType}
              exclusive
              onChange={(_, val) => { if (val !== null) { setSelectedType(val); setSearchText(''); } }}
              size='small'
              fullWidth
              sx={{
                border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden',
                '& .MuiToggleButtonGroup-grouped': { border: 0, borderRadius: 0 },
                '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 500, py: 1, transition: 'background-color 0.15s ease' },
                '& .MuiToggleButton-root[value="Requirement"].Mui-selected': { backgroundColor: TYPE_COLORS_SELECTED['Requirement'], color: 'text.primary', fontWeight: 600, '&:hover': { backgroundColor: TYPE_COLORS_SELECTED['Requirement'] } },
                '& .MuiToggleButton-root[value="Test Case"].Mui-selected': { backgroundColor: TYPE_COLORS_SELECTED['Test Case'], color: 'text.primary', fontWeight: 600, '&:hover': { backgroundColor: TYPE_COLORS_SELECTED['Test Case'] } },
              }}
            >
              <ToggleButton value='Requirement'><Box sx={{ display: 'flex', alignItems: 'center' }}>Requirement<TabBadge type='Requirement' count={modCountByType['Requirement']} /></Box></ToggleButton>
              <ToggleButton value='Test Case'><Box sx={{ display: 'flex', alignItems: 'center' }}>Test Case<TabBadge type='Test Case' count={modCountByType['Test Case']} /></Box></ToggleButton>
            </ToggleButtonGroup>

            {/* Linked-requirements notice */}
            {traceAnalysisMode === 'linkedRequirement' && (
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, bgcolor: 'action.hover', borderRadius: 1, px: 1.5, py: 1 }}>
                <InfoOutlinedIcon sx={{ fontSize: 15, mt: 0.1, color: 'text.secondary', flexShrink: 0 }} />
                <Typography variant='caption' color='text.secondary' sx={{ lineHeight: 1.4 }}>
                  Linked Requirements mode provides a fixed column set. ID and Title columns are always shown. Switch to Queries mode to configure additional columns.
                </Typography>
              </Box>
            )}

            {/* Search + hide all */}
            <Stack direction='row' spacing={1} alignItems='center'>
              <TextField
                size='small'
                placeholder='Search columns...'
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                sx={{ flex: 1 }}
                slotProps={{ input: { startAdornment: <InputAdornment position='start'><SearchIcon fontSize='small' color='action' /></InputAdornment> } }}
              />
              {visibleFields.length > 0 && (
                <Tooltip title={allHidden ? 'Show all columns' : 'Hide all columns'}>
                  <Button size='small' variant='outlined' color='secondary' onClick={handleToggleAll} startIcon={allHidden ? <VisibilityIcon /> : <VisibilityOffIcon />} sx={{ textTransform: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {allHidden ? 'Show all' : 'Hide all'}
                  </Button>
                </Tooltip>
              )}
            </Stack>

            {/* Status line */}
            {statusParts.length > 0 && (
              <Typography variant='caption' color='text.secondary' sx={{ pl: 0.5 }}>
                {selectedType}: {statusParts.join(' · ')}
              </Typography>
            )}

            <Divider />

            {/* Column list */}
            <Box sx={{ maxHeight: 340, overflowY: 'auto', mx: -0.5, px: 0.5 }}>
              {visibleFields.length === 0 && (
                <Typography variant='body2' color='text.secondary' sx={{ py: 4, textAlign: 'center' }}>
                  {traceAnalysisMode === 'query' ? 'Select trace queries to see available columns' : 'No configurable columns for this mode'}
                </Typography>
              )}

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={visibleFields.map((f) => f.referenceName)} strategy={verticalListSortingStrategy}>
                  {visibleFields.map((field) => (
                    <SortableFieldRow
                      key={field.referenceName}
                      field={field}
                      selectedType={selectedType}
                      workingMapping={workingMapping[selectedQuery] || {}}
                      workingVisibility={workingVisibility[selectedQuery] || {}}
                      typeColor={typeColor}
                      onToggleVisibility={handleToggleVisibility}
                      onFieldOverride={handleFieldOverride}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </Box>
          </Stack>
        </DialogContent>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 3, pb: 2, pt: 0.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button onClick={handleClose} variant='contained' size='small'>Apply & Close</Button>
        </Box>
      </Dialog>
    </>
  );
};

export default FieldDisplayMappingDialog;
