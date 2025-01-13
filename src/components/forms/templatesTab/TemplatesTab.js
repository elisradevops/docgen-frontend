import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react';
import { Grid, TableContainer, Paper, Table, TableBody, TableRow, TableCell, TableHead } from '@mui/material';
const TemplatesTab = observer(({ store, selectedTeamProject }) => {
  const [templates, setTemplates] = useState([]);

  useEffect(async () => {
    store.fetchTemplatesListForDownload();
  }, [selectedTeamProject]);

  useEffect(() => {
    setTemplates(store.templateForDownload || []);
  }, [store.templateForDownload]);

  return (
    <Grid
      container
      spacing={2}
    >
      <Grid
        item
        xs={12}
      >
        <TableContainer component={Paper}>
          <Table aria-label='simple table'>
            <TableHead>
              <TableRow>
                <TableCell>
                  <strong>Template File</strong>
                </TableCell>
                <TableCell>
                  <strong>Last Modified</strong>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {templates.map((row) => (
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

export default TemplatesTab;
