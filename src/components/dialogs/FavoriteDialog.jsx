import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  Checkbox,
} from '@mui/material';
import SmartAutocomplete from '../common/SmartAutocomplete';
import React, { useEffect, useState, useCallback } from 'react';
import logger from '../../utils/logger';
import DeleteIcon from '@mui/icons-material/Delete';
import CachedIcon from '@mui/icons-material/Cached';
import SaveIcon from '@mui/icons-material/Save';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { toast } from 'react-toastify';
import Highlighter from 'react-highlight-words';

const FavoriteDialog = ({ store, docType, selectedTeamProject, isDisabled }) => {
  const [favoriteList, setFavoriteList] = useState([]);
  const [selectedFavorite, setSelectedFavorite] = useState(null);
  const [loadingFavoriteList, setLoadingFavoriteList] = useState(false);
  const [newFavoriteLoading, setNewFavoriteLoading] = useState(false);
  const [newFavoriteName, setNewFavoriteName] = useState('');
  const [isShared, setIsShared] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [favoriteToDelete, setFavoriteToDelete] = useState(null);
  const [deletingFavoriteLoading, setDeletingFavoriteLoading] = useState(false);
  const [confirmDeleteInput, setConfirmDeleteInput] = useState('');
  const [openDuplicateDialog, setOpenDuplicateDialog] = useState(false);
  const [filterMode, setFilterMode] = useState('all');

  const fetchFavorites = useCallback(async () => {
    setLoadingFavoriteList(true);

    try {
      const favorites = await store.fetchFavoritesList();
      setFavoriteList(favorites);
    } catch (err) {
      logger.error('Error fetching favorite list:', err.message);
      toast.error(`Error while fetching favorite list: ${err.message}`, { autoClose: false });
    } finally {
      setLoadingFavoriteList(false);
    }
  }, [store]);

  useEffect(() => {
    if (docType) {
      fetchFavorites();
    }
  }, [store, selectedTeamProject, docType, fetchFavorites]);

  useEffect(() => {
    if (openDialog) {
      setSelectedFavorite(null);
      setNewFavoriteName('');
      setIsShared(true);
      setFilterMode('all');
      fetchFavorites();
    }
  }, [openDialog, fetchFavorites]);

  useEffect(() => {
    if (!selectedFavorite) return;
    const matches = favoriteList.some((f) => {
      const inFilter = filterMode === 'all' ? true : filterMode === 'shared' ? !!f.isShared : !f.isShared;
      return inFilter && f.id === selectedFavorite.key;
    });
    if (!matches) setSelectedFavorite(null);
  }, [filterMode, favoriteList, selectedFavorite]);

  useEffect(() => {
    if (favoriteList.length === 0 && filterMode !== 'all') {
      setFilterMode('all');
    }
  }, [favoriteList, filterMode]);

  const optionsList = React.useMemo(() => {
    const filtered = favoriteList.filter((f) =>
      filterMode === 'all' ? true : filterMode === 'shared' ? !!f.isShared : !f.isShared
    );
    const sorted = filtered.sort((a, b) => {
      if (a.isShared !== b.isShared) return a.isShared ? -1 : 1;
      const an = (a.name || '').toLowerCase();
      const bn = (b.name || '').toLowerCase();
      return an.localeCompare(bn);
    });
    return sorted.map((favorite) => {
      const tplText =
        favorite?.dataToSave?.selectedTemplate?.text || favorite?.dataToSave?.selectedTemplate?.url || '';
      const templateLabel = tplText
        ? String(tplText)
            .split('/')
            .pop()
            .replace(/\.do[ct]x?$/i, '')
        : '';
      return {
        key: favorite.id,
        text: favorite.name,
        templateLabel,
        isShared: favorite.isShared,
      };
    });
  }, [favoriteList, filterMode]);

  const handleClickOpen = () => {
    setOpenDialog(true);
  };

  const handleClose = () => {
    setOpenDialog(false);
  };

  const handleDeleteFavorite = async (favoriteId) => {
    const deletingToastId = toast.loading('Deleting favorite...');
    try {
      setSelectedFavorite(null);
      await store.deleteFavorite(favoriteId);
      await fetchFavorites();
      toast.update(deletingToastId, {
        render: 'Favorite deleted and list refreshed',
        type: 'success',
        isLoading: false,
        autoClose: 2000,
      });
    } catch (err) {
      logger.error('Error deleting favorite:', err.message);
      toast.update(deletingToastId, {
        render: `Error while deleting favorite: ${err.message}`,
        type: 'error',
        isLoading: false,
        autoClose: false,
      });
    }
  };

  const handleConfirmDuplicateSave = async () => {
    setNewFavoriteLoading(true);
    try {
      await store.saveFavorite(newFavoriteName.trim(), isShared);
      toast.success('Favorite saved');
      await fetchFavorites();
      setOpenDuplicateDialog(false);
      setOpenDialog(false);
    } catch (err) {
      logger.error('Error saving duplicate favorite:', err.message);
    } finally {
      setNewFavoriteLoading(false);
    }
  };

  const handleSaveNewFavorite = async () => {
    const trimmed = newFavoriteName.trim();
    if (!trimmed) return;
    const duplicate = favoriteList.some((f) => f.name?.trim().toLowerCase() === trimmed.toLowerCase());
    if (duplicate) {
      setOpenDuplicateDialog(true);
      return;
    }
    setNewFavoriteLoading(true);
    await store.saveFavorite(trimmed, isShared);
    toast.success('Favorite saved');
    await fetchFavorites();
    setNewFavoriteLoading(false);
    setOpenDialog(false);
  };

  const handleLoadSelectedFavorite = async () => {
    store.loadFavorite(selectedFavorite.key);
  };

  const handleNewFavoriteFieldChange = (event) => {
    setNewFavoriteName(event.target.value);
  };

  return (
    <>
      <Tooltip title='Manage your favorite parameters (Create, Load, or Delete)' placement='right'>
        <Button
          variant='contained'
          onClick={handleClickOpen}
          endIcon={<BookmarkIcon />}
          color='secondary'
          disabled={isDisabled || !selectedTeamProject}
        >
          Favorites
        </Button>
      </Tooltip>
      <Dialog open={openDialog} onClose={handleClose} maxWidth='md' fullWidth>
        <DialogTitle sx={{ pb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          Favorites
          <Tooltip title='Favorites let you store the current configuration (template, suites, filters) for quick reuse.'>
            <InfoOutlinedIcon fontSize='small' color='info' />
          </Tooltip>
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 2, pb: 0 }}>
          {loadingFavoriteList ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={32} />
            </Box>
          ) : (
            <Stack spacing={2.5}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
                <ToggleButtonGroup
                  size='small'
                  color='primary'
                  exclusive
                  value={filterMode}
                  onChange={(e, val) => {
                    if (val) setFilterMode(val);
                  }}
                  aria-label='Filter favorites'
                  sx={{ flexWrap: 'wrap' }}
                >
                  <ToggleButton value='all' aria-label='All' disabled={favoriteList.length === 0}>
                    All
                  </ToggleButton>
                  <ToggleButton value='shared' aria-label='Only Shared' disabled={favoriteList.length === 0}>
                    Shared
                  </ToggleButton>
                  <ToggleButton value='private' aria-label='Only Private' disabled={favoriteList.length === 0}>
                    Private
                  </ToggleButton>
                </ToggleButtonGroup>
                <Typography variant='caption' color='text.secondary'>
                  Filter favorites by visibility.
                </Typography>
              </Stack>

              {favoriteList.length > 0 && optionsList.length === 0 && (
                <Alert severity='info'>No favorites match the current filter.</Alert>
              )}
              {favoriteList.length === 0 && (
                <Alert severity='info'>No favorites yet. Save your current configuration to reuse it later.</Alert>
              )}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'flex-start' }}>
                <SmartAutocomplete
                  disableClearable
                  sx={{ width: '100%' }}
                  autoHighlight
                  openOnFocus
                  value={selectedFavorite}
                  options={optionsList}
                  searchKeys={['text', 'templateLabel']}
                  optionLabelKey='text'
                  renderOption={(props, option, state) => {
                    const { key, ...optionProps } = props;
                    return (
                      <li
                        key={key}
                        {...optionProps}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 12,
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <Typography variant='body2'>
                            <Highlighter
                              highlightStyle={{ backgroundColor: 'rgba(255, 235, 59, 0.35)' }}
                              searchWords={(state?.inputValue || '').trim().split(/\s+/).filter(Boolean)}
                              autoEscape
                              textToHighlight={option.text}
                            />
                          </Typography>
                          {(option.templateLabel || option.isShared) && (
                            <Stack direction='row' spacing={0.75} alignItems='center'>
                              {option.isShared ? (
                                <Chip
                                  size='small'
                                  variant='outlined'
                                  icon={<PeopleAltOutlinedIcon fontSize='small' />}
                                  label='Shared'
                                  color='primary'
                                />
                              ) : null}
                              {option.templateLabel ? (
                                <Typography variant='caption' color='text.secondary'>
                                  Template: {option.templateLabel}
                                </Typography>
                              ) : null}
                            </Stack>
                          )}
                        </div>
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            setFavoriteToDelete({
                              id: option.key,
                              name: option.text,
                              templateLabel: option.templateLabel,
                              isShared: option.isShared,
                            });
                            setConfirmDeleteInput('');
                          }}
                          size='small'
                        >
                          <DeleteIcon fontSize='small' />
                        </IconButton>
                      </li>
                    );
                  }}
                  label='Select a Favorite'
                  onChange={(event, newValue) => {
                    setSelectedFavorite(newValue);
                  }}
                  textFieldProps={{
                    onKeyDown: (e) => {
                      if (e.key === 'Enter' && selectedFavorite) {
                        handleLoadSelectedFavorite();
                      }
                    },
                  }}
                />
                <Box sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 160 }, display: 'flex' }}>
                  <Button
                    variant='outlined'
                    onClick={handleLoadSelectedFavorite}
                    disabled={!selectedFavorite}
                    startIcon={<CachedIcon />}
                    fullWidth
                    sx={{
                      height: 48,
                      fontWeight: 600,
                      textTransform: 'none',
                      whiteSpace: 'nowrap',
                      px: 2.75,
                    }}
                  >
                    Load selection
                  </Button>
                </Box>
              </Stack>

              <Divider flexItem sx={{ my: 1 }} />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'flex-start' }}>
                <Box sx={{ flex: 1 }}>
                  <TextField
                    id='new-favorite'
                    label='Favorite name'
                    onChange={handleNewFavoriteFieldChange}
                    value={newFavoriteName}
                    fullWidth
                    autoComplete='off'
                    spellCheck={false}
                    inputProps={{ autoComplete: 'new-password', name: 'new-favorite-name' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newFavoriteName.trim()) {
                        handleSaveNewFavorite();
                      }
                    }}
                  />
                  <FormControlLabel
                    label='Share with everyone'
                    control={
                      <Checkbox checked={isShared} onChange={(event, checked) => setIsShared(checked)} />
                    }
                    sx={{ mt: 1 }}
                  />
                </Box>
                <Box sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 160 }, display: 'flex' }}>
                  <Button
                    variant='contained'
                    loading={newFavoriteLoading}
                    onClick={handleSaveNewFavorite}
                    disabled={newFavoriteName.trim() === ''}
                    startIcon={<SaveIcon />}
                    fullWidth
                    sx={{
                      height: 48,
                      fontWeight: 600,
                      textTransform: 'none',
                      whiteSpace: 'nowrap',
                      px: 2.75,
                    }}
                  >
                    Save favorite
                  </Button>
                </Box>
              </Stack>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>OK</Button>
        </DialogActions>
      </Dialog>
      {/* Confirm Delete Favorite Dialog */}
      <Dialog
        open={!!favoriteToDelete}
        onClose={() => (deletingFavoriteLoading ? null : setFavoriteToDelete(null))}
        onKeyDown={(e) => {
          const needsConfirm = !!favoriteToDelete?.isShared;
          const canConfirm = !needsConfirm || confirmDeleteInput.trim() === favoriteToDelete?.name;
          if (e.key === 'Enter' && favoriteToDelete && !deletingFavoriteLoading) {
            if (!canConfirm) {
              if (needsConfirm) {
                toast.error(`Name does not match. Type "${favoriteToDelete?.name}" to confirm.`);
              }
              return;
            }
            const id = favoriteToDelete.id;
            setDeletingFavoriteLoading(true);
            (async () => {
              await handleDeleteFavorite(id);
              setDeletingFavoriteLoading(false);
              setFavoriteToDelete(null);
            })();
          }
        }}
      >
        <DialogTitle>Delete favorite?</DialogTitle>
        <DialogContent>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Typography variant='body2' sx={{ fontWeight: 500 }}>
              Are you sure you want to delete
              {favoriteToDelete?.name ? ` "${favoriteToDelete.name}"` : ''}?
            </Typography>
            {(favoriteToDelete?.isShared || favoriteToDelete?.templateLabel) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {favoriteToDelete?.isShared ? (
                  <Chip
                    size='small'
                    variant='outlined'
                    color='primary'
                    icon={<PeopleAltOutlinedIcon fontSize='small' />}
                    label='Shared'
                  />
                ) : null}
                {favoriteToDelete?.templateLabel ? (
                  <Typography variant='caption' color='text.secondary'>
                    Template: {favoriteToDelete.templateLabel}
                  </Typography>
                ) : null}
              </div>
            )}
            {favoriteToDelete?.isShared && (
              <Alert severity='warning' sx={{ mt: 1 }}>
                This favorite is shared and visible to all users. Deleting it will remove access for everyone.
              </Alert>
            )}
            <Typography variant='body2' color='text.secondary'>
              Only the selected favorite will be deleted. Templates and files are not affected.
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              This action cannot be undone.
            </Typography>
            {favoriteToDelete?.isShared && (
              <TextField
                autoFocus
                margin='dense'
                label={`Type "${favoriteToDelete.name}" to confirm`}
                fullWidth
                size='small'
                value={confirmDeleteInput}
                onChange={(e) => setConfirmDeleteInput(e.target.value)}
                error={Boolean(confirmDeleteInput) && confirmDeleteInput.trim() !== favoriteToDelete?.name}
                helperText={
                  Boolean(confirmDeleteInput) && confirmDeleteInput.trim() !== favoriteToDelete?.name
                    ? 'Entered name does not match'
                    : ' '
                }
                autoComplete='off'
                spellCheck={false}
                inputProps={{ autoComplete: 'new-password', name: 'confirm-delete-favorite' }}
              />
            )}
          </div>
        </DialogContent>
        <DialogActions>
          <Button disabled={deletingFavoriteLoading} onClick={() => setFavoriteToDelete(null)}>
            Cancel
          </Button>
          <Button
            color='error'
            variant='contained'
            loading={deletingFavoriteLoading}
            onClick={async () => {
              const id = favoriteToDelete?.id;
              if (!id) return;
              const needsConfirm = !!favoriteToDelete?.isShared;
              const canConfirm = !needsConfirm || confirmDeleteInput.trim() === favoriteToDelete?.name;
              if (!canConfirm) {
                if (needsConfirm) {
                  toast.error(`Name does not match. Type "${favoriteToDelete?.name}" to confirm.`);
                }
                return;
              }
              setDeletingFavoriteLoading(true);
              await handleDeleteFavorite(id);
              setDeletingFavoriteLoading(false);
              setFavoriteToDelete(null);
            }}
            disabled={
              deletingFavoriteLoading ||
              (favoriteToDelete?.isShared && confirmDeleteInput.trim() !== favoriteToDelete?.name)
            }
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={openDuplicateDialog}
        onClose={() => (newFavoriteLoading ? null : setOpenDuplicateDialog(false))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !newFavoriteLoading) {
            handleConfirmDuplicateSave();
          }
        }}
      >
        <DialogTitle>Favorite name already exists</DialogTitle>
        <DialogContent>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Alert severity='warning'>
              A favorite with the name "{(newFavoriteName || '').trim()}" already exists.
            </Alert>
            <Typography variant='body2' color='text.secondary'>
              Do you want to create another favorite with the same name?
            </Typography>
          </div>
        </DialogContent>
        <DialogActions>
          <Button disabled={newFavoriteLoading} onClick={() => setOpenDuplicateDialog(false)}>
            Cancel
          </Button>
          <Button variant='contained' loading={newFavoriteLoading} onClick={handleConfirmDuplicateSave}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default FavoriteDialog;
