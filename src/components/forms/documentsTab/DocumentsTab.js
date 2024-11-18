import React from 'react';
import { observer } from 'mobx-react';

import { Dropdown } from '@fluentui/react/lib/Dropdown';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import { Autocomplete } from '@mui/material';
import { TextField } from '@mui/material';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';

const dropdownStyles = {
  dropdown: { width: 300 },
};

const DocumentsTab = observer(({ store }) => {
  return (
    <div>
      <Autocomplete
        disableClearable
        style={{ marginBlock: 8, width: 300 }}
        autoHighlight
        openOnFocus
        options={store.teamProjectsList.map((teamProject) => {
          return { key: teamProject.id, text: teamProject.name };
        })}
        getOptionLabel={(option) => `${option.text}`}
        renderInput={(params) => (
          <TextField
            {...params}
            label='Select a TeamProject'
            variant='outlined'
          />
        )}
        onChange={async (event, newValue) => {
          store.setTeamProject(newValue.key, newValue.text);
          store.fetchSharedQueries();
        }}
      />
      <div>
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
                    {row.lastModified}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </div>
    </div>
  );
});
export default DocumentsTab;
