import React, { useEffect } from 'react';
import { observer } from 'mobx-react';

import { Dropdown } from '@fluentui/react/lib/Dropdown';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import { Alert, Autocomplete, Grid } from '@mui/material';
import { TextField } from '@mui/material';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';

const dropdownStyles = {
  dropdown: { width: 300 },
};

const DocumentsTab = observer(({ store, selectedTeamProject }) => {
  useEffect(() => {
    if (selectedTeamProject) {
      store.fetchDocuments();
    }
  }, [store, selectedTeamProject]);

  return (
    <Grid
      container
      spacing={2}
    >
      <Grid
        item
        xs={12}
      >
        <Alert severity='info'>
          Please save your documents in your local folders, we have a retention rule of 2 days.
        </Alert>
      </Grid>
      <Grid
        item
        xs={12}
      >
        <TableContainer component={Paper}>
          <Table aria-label='simple table'>
            <TableHead>
              <TableRow>
                <TableCell>
                  <strong>Document Title</strong>
                </TableCell>
                <TableCell>
                  <strong>Changed Date</strong>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {store.documents.map((row) => (
                <TableRow key={row.name}>
                  <TableCell
                    component='th'
                    scope='row'
                  >
                    <a href={row.url}>{row.name}</a>
                  </TableCell>
                  <TableCell
                    component='th'
                    scope='row'
                  >
                    {new Date(row.lastModified).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Grid>
    </Grid>
  );
});
export default DocumentsTab;
