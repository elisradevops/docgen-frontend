import {
  Autocomplete,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Grid,
  IconButton,
  TextField,
  Tooltip,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import logger from '../../utils/logger';
import DeleteIcon from '@mui/icons-material/Delete';
import CachedIcon from '@mui/icons-material/Cached';
import SaveIcon from '@mui/icons-material/Save';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import { toast } from 'react-toastify';

const FavoriteDialog = ({ store, docType, selectedTeamProject, isDisabled }) => {
  const [favoriteList, setFavoriteList] = useState([]);
  const [selectedFavorite, setSelectedFavorite] = useState(null);
  const [loadingFavoriteList, setLoadingFavoriteList] = useState(false);
  const [newFavoriteLoading, setNewFavoriteLoading] = useState(false);
  const [newFavoriteName, setNewFavoriteName] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);

  const fetchFavorites = async () => {
    setLoadingFavoriteList(true);

    try {
      // Fetch the list of favorites
      const favorites = await store.fetchFavoritesList();
      setFavoriteList(favorites);
    } catch (err) {
      logger.error('Error fetching favorite list:', err.message);
      toast.error(`Error while fetching favorite list: ${err.message}`, { autoClose: false });
    } finally {
      setLoadingFavoriteList(false);
    }
  };

  // Refactor the useEffect to not be directly async
  useEffect(() => {
    if (docType) {
      fetchFavorites();
    }
  }, [store, selectedTeamProject, docType]);

  useEffect(() => {
    if (openDialog) {
      setSelectedFavorite(null);
      setNewFavoriteName('');
      setIsShared(false);
    }
  }, [openDialog]);

  const handleClickOpen = () => {
    setOpenDialog(true);
  };

  const handleClose = () => {
    setOpenDialog(false);
  };

  const handleDeleteFavorite = async (favoriteId) => {
    try {
      setSelectedFavorite(null);
      await store.deleteFavorite(favoriteId);
      await fetchFavorites();
    } catch (err) {
      logger.error('Error deleting favorite:', err.message);
      toast.error(`Error while deleting favorite: ${err.message}`, { autoClose: false });
    }
  };

  //If the user selects a favorite, set it as the selected favorite
  const handleSaveNewFavorite = async () => {
    setNewFavoriteLoading(true);
    await store.saveFavorite(newFavoriteName, isShared);
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
      <Tooltip
        title='Manage your favorite parameters (Create, Load, or Delete)'
        placement='right'
      >
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
      <Dialog
        open={openDialog}
        onClose={handleClose}
      >
        <DialogTitle>Favorites</DialogTitle>
        <DialogContent>
          {loadingFavoriteList ? (
            <CircularProgress />
          ) : (
            <Grid
              container
              spacing={2}
              alignItems='center'
              sx={{ display: 'flex', justifyContent: 'center' }}
            >
              <Grid
                item
                xs={8}
                sx={{ display: 'flex', justifyContent: 'center' }}
              >
                <Autocomplete
                  disableClearable
                  sx={{ my: 1, width: '100%' }}
                  autoHighlight
                  openOnFocus
                  value={selectedFavorite}
                  options={favoriteList.map((favorite) => {
                    return {
                      key: favorite.id,
                      text: favorite.name,
                    };
                  })}
                  getOptionLabel={(option) => option.text}
                  renderOption={(props, option) => {
                    const { key, ...optionProps } = props;
                    return (
                      <li
                        key={key}
                        {...optionProps}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        {option.text}
                        <IconButton
                          onClick={async (e) => {
                            e.stopPropagation(); // Prevent triggering selection
                            await handleDeleteFavorite(option.key);
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </li>
                    );
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label='Select a Favorite'
                      variant='outlined'
                      fullWidth
                    />
                  )}
                  onChange={(event, newValue) => {
                    setSelectedFavorite(newValue);
                  }}
                />
              </Grid>
              <Grid
                item
                xs={4}
              >
                <Button
                  variant='contained'
                  loading={newFavoriteLoading}
                  loadingPosition='end'
                  onClick={handleLoadSelectedFavorite}
                  disabled={selectedFavorite === null}
                  fullWidth
                  startIcon={<CachedIcon />}
                >
                  Load
                </Button>
              </Grid>
              <Grid
                item
                xs={8}
              >
                <Grid container>
                  <Grid
                    item
                    xs={12}
                  >
                    <TextField
                      id='new-favorite'
                      label='Insert Favorite Name'
                      onChange={handleNewFavoriteFieldChange}
                      value={newFavoriteName}
                      fullWidth
                    />
                  </Grid>
                  <Grid
                    item
                    xs={12}
                  >
                    <FormControlLabel
                      label='Is Shared? (visible to all users)'
                      control={
                        <Checkbox
                          checked={isShared}
                          onChange={(event, checked) => setIsShared(checked)}
                        />
                      }
                    />
                  </Grid>
                </Grid>
              </Grid>
              <Grid
                item
                xs={4}
              >
                <Button
                  variant='contained'
                  loading={newFavoriteLoading}
                  loadingPosition='end'
                  onClick={handleSaveNewFavorite}
                  disabled={newFavoriteName === ''}
                  fullWidth
                  startIcon={<SaveIcon />}
                >
                  Save
                </Button>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>OK</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default FavoriteDialog;
