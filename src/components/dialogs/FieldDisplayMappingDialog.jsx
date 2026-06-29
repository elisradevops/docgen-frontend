import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
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
const TYPE_COLORS_SELECTED = { Requirement: '#b8cfe6', 'Test Case': '#cdc5df' };

// ADO referenceNames + linked-mode pseudo-keys that are always shown and never dragged
const ALWAYS_VISIBLE_REFS = new Set(['System.Id', 'System.Title', 'Req ID', 'Test Case ID', 'Title']);
const EXCLUDED_FIELD_REFS = new Set(['System.WorkItemType']);

// Locked columns in linked mode (only Customer ID is configurable)
const LINKED_REQ_COLUMNS = {
  Requirement: [{ referenceName: 'Customer ID', name: 'Customer ID' }],
  'Test Case': [],
};

function deriveFieldList(traceAnalysisMode, reqTestQuery, testReqQuery, columnMetadata) {
  if (traceAnalysisMode === 'linkedRequirement') return LINKED_REQ_COLUMNS;
  if (traceAnalysisMode !== 'query') return { Requirement: [], 'Test Case': [] };

  // When backend-verified per-side metadata is available (null = not yet fetched), use it.
  // This distinguishes "fetch completed, side has zero configurable columns" from "not fetched yet".
  if (columnMetadata !== null && columnMetadata !== undefined) {
    const filterMeta = (cols) =>
      (cols || []).filter(
        (c) => c?.referenceName && !EXCLUDED_FIELD_REFS.has(c.referenceName) && !ALWAYS_VISIBLE_REFS.has(c.referenceName)
      );
    return {
      Requirement: filterMeta(columnMetadata.Requirement),
      'Test Case': filterMeta(columnMetadata['Test Case']),
    };
  }

  // Fallback: merge both queries' declared columns for both sides (legacy / loading state)
  const seen = new Set();
  const merged = [];
  for (const cols of [reqTestQuery?.columns, testReqQuery?.columns].filter(Boolean)) {
    for (const col of cols) {
      if (!col?.referenceName || seen.has(col.referenceName)) continue;
      if (EXCLUDED_FIELD_REFS.has(col.referenceName)) continue;
      if (ALWAYS_VISIBLE_REFS.has(col.referenceName)) continue;
      seen.add(col.referenceName);
      merged.push({ referenceName: col.referenceName, name: col.name });
    }
  }
  return { Requirement: merged, 'Test Case': merged };
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
  columnMetadata = null, // null = not yet fetched; { Requirement:[], 'Test Case':[] } = fetched (may be empty)
}) => {
  const [open, setOpen] = useState(false);
  const [workingMapping, setWorkingMapping] = useState({});
  const [workingVisibility, setWorkingVisibility] = useState({});
  const [workingOrder, setWorkingOrder] = useState({});
  const [selectedType, setSelectedType] = useState('Requirement');
  const [searchText, setSearchText] = useState('');

  const fieldsByType = useMemo(
    () => deriveFieldList(traceAnalysisMode, reqTestQuery, testReqQuery, columnMetadata),
    [traceAnalysisMode, reqTestQuery, testReqQuery, columnMetadata]
  );

  useEffect(() => {
    if (!open) return;
    setWorkingMapping({ ...fieldDisplayMapping });
    setWorkingVisibility({ ...fieldVisibility });

    // Initialize order per type: respect saved order, append any new fields not yet ordered
    const initOrder = {};
    for (const [type, fields] of Object.entries(fieldsByType)) {
      const existing = fieldOrder[type] || [];
      const knownRefs = new Set(existing);
      initOrder[type] = [
        ...existing.filter((ref) => fields.some((f) => f.referenceName === ref)),
        ...fields.filter((f) => !knownRefs.has(f.referenceName)).map((f) => f.referenceName),
      ];
    }
    setWorkingOrder(initOrder);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ordered visible fields for current tab
  const visibleFields = useMemo(() => {
    const allFields = fieldsByType[selectedType] || [];
    const order = workingOrder[selectedType] || [];

    // Sort by order, unknown refs appended
    const byRef = Object.fromEntries(allFields.map((f) => [f.referenceName, f]));
    const orderedRefs = [
      ...order.filter((ref) => byRef[ref]),
      ...allFields.filter((f) => !order.includes(f.referenceName)).map((f) => f.referenceName),
    ];
    const sorted = orderedRefs.map((ref) => byRef[ref]).filter(Boolean);

    if (!searchText.trim()) return sorted;
    const lower = searchText.toLowerCase();
    return sorted.filter((f) => f.name.toLowerCase().includes(lower));
  }, [fieldsByType, selectedType, searchText, workingOrder]);

  const modReq = useMemo(() => countMods(workingMapping, workingVisibility, 'Requirement'), [workingMapping, workingVisibility]);
  const modTest = useMemo(() => countMods(workingMapping, workingVisibility, 'Test Case'), [workingMapping, workingVisibility]);
  const modCountByType = { Requirement: modReq, 'Test Case': modTest };
  const totalCount = modReq + modTest;

  const handleFieldOverride = (referenceName, value) => {
    setWorkingMapping((prev) => {
      const typeMap = { ...(prev[selectedType] || {}) };
      if (value.trim()) typeMap[referenceName] = value;
      else delete typeMap[referenceName];
      return { ...prev, [selectedType]: typeMap };
    });
  };

  const handleToggleVisibility = (referenceName) => {
    if (ALWAYS_VISIBLE_REFS.has(referenceName)) return;
    setWorkingVisibility((prev) => {
      const typeMap = { ...(prev[selectedType] || {}) };
      if (typeMap[referenceName] === false) delete typeMap[referenceName];
      else typeMap[referenceName] = false;
      return { ...prev, [selectedType]: typeMap };
    });
  };

  const allHidden =
    visibleFields.length > 0 &&
    visibleFields.every((f) => workingVisibility[selectedType]?.[f.referenceName] === false);

  const handleToggleAll = () => {
    setWorkingVisibility((prev) => {
      const typeMap = { ...(prev[selectedType] || {}) };
      if (allHidden) visibleFields.forEach((f) => delete typeMap[f.referenceName]);
      else visibleFields.forEach((f) => { typeMap[f.referenceName] = false; });
      return { ...prev, [selectedType]: typeMap };
    });
  };

  const handleClear = () => {
    setWorkingMapping((prev) => { const n = { ...prev }; delete n[selectedType]; return n; });
    setWorkingVisibility((prev) => { const n = { ...prev }; delete n[selectedType]; return n; });
    setWorkingOrder((prev) => {
      const base = fieldsByType[selectedType] || [];
      return { ...prev, [selectedType]: base.map((f) => f.referenceName) };
    });
  };

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    setWorkingOrder((prev) => {
      const items = prev[selectedType] || visibleFields.map((f) => f.referenceName);
      const oldIdx = items.indexOf(String(active.id));
      const newIdx = items.indexOf(String(over.id));
      if (oldIdx === -1 || newIdx === -1) return prev;
      return { ...prev, [selectedType]: arrayMove(items, oldIdx, newIdx) };
    });
  };

  const handleClose = () => {
    const clean = (src) => Object.fromEntries(Object.entries(src).filter(([, v]) => v && Object.keys(v).length > 0));
    onMappingChange(clean(workingMapping));
    if (onVisibilityChange) onVisibilityChange(clean(workingVisibility));
    if (onOrderChange) onOrderChange({ ...workingOrder });
    setOpen(false);
  };

  const isDisabled = traceAnalysisMode === 'none';
  const hasMappings = modCountByType[selectedType] > 0;
  const renamedCount = Object.keys(workingMapping[selectedType] || {}).length;
  const hiddenCount = Object.values(workingVisibility[selectedType] || {}).filter((v) => v === false).length;
  const statusParts = [];
  if (renamedCount > 0) statusParts.push(`${renamedCount} renamed`);
  if (hiddenCount > 0) statusParts.push(`${hiddenCount} hidden`);

  const TabBadge = ({ type }) => {
    const count = modCountByType[type];
    if (!count) return null;
    return (
      <Box component='span' sx={{ ml: 0.75, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', bgcolor: TYPE_COLORS_SELECTED[type], borderRadius: '10px', px: 0.75, minWidth: 18, height: 18, fontSize: '0.68rem', fontWeight: 700, lineHeight: 1, color: 'text.primary' }}>
        {count}
      </Box>
    );
  };

  const typeColor = TYPE_COLORS[selectedType];

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  return (
    <>
      <Tooltip title={isDisabled ? 'Enable trace analysis first' : 'Configure which columns appear and how they are labelled in the trace tables'}>
        <span>
          <Button
            variant='outlined'
            color='secondary'
            onClick={() => setOpen(true)}
            disabled={isDisabled}
            endIcon={
              totalCount > 0 ? (
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {modReq > 0 && (
                    <Chip label={`Req: ${modReq}`} size='small' sx={{ height: 20, bgcolor: TYPE_COLORS_SELECTED['Requirement'], color: 'text.primary', fontWeight: 700, fontSize: '0.68rem', '& .MuiChip-label': { px: 0.75 } }} />
                  )}
                  {modTest > 0 && (
                    <Chip label={`TC: ${modTest}`} size='small' sx={{ height: 20, bgcolor: TYPE_COLORS_SELECTED['Test Case'], color: 'text.primary', fontWeight: 700, fontSize: '0.68rem', '& .MuiChip-label': { px: 0.75 } }} />
                  )}
                </Box>
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

      <Dialog open={open} onClose={handleClose} maxWidth='sm' fullWidth PaperProps={{ sx: { borderRadius: 2, minWidth: 480 } }}>
        <DialogTitle sx={{ pb: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Stack direction='row' alignItems='flex-start' justifyContent='space-between'>
            <Box>
              <Typography variant='h6' component='div' sx={{ lineHeight: 1.3 }}>Column Settings</Typography>
              <Typography variant='caption' color='text.secondary'>Show/hide, rename, or reorder columns in the generated trace tables</Typography>
            </Box>
            <Tooltip title={hasMappings ? `Reset ${selectedType} columns` : 'No changes to reset'}>
              <span>
                <Button size='small' color='warning' onClick={handleClear} disabled={!hasMappings} startIcon={<DeleteSweepIcon />} sx={{ textTransform: 'none', mt: 0.25 }}>
                  Reset
                </Button>
              </span>
            </Tooltip>
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ pt: '12px !important' }}>
          <Stack spacing={1.5}>
            {/* Side tabs */}
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
              <ToggleButton value='Requirement'><Box sx={{ display: 'flex', alignItems: 'center' }}>Requirement<TabBadge type='Requirement' /></Box></ToggleButton>
              <ToggleButton value='Test Case'><Box sx={{ display: 'flex', alignItems: 'center' }}>Test Case<TabBadge type='Test Case' /></Box></ToggleButton>
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
                      workingMapping={workingMapping}
                      workingVisibility={workingVisibility}
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
