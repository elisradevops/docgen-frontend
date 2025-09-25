import React, { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react';
import Highlighter from 'react-highlight-words';
import { Alert, Box, Paper, Stack } from '@mui/material';
import { Button, Input, Space, Table } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import LoadingState from '../../common/LoadingState';

const DocumentsTab = observer(({ store, selectedTeamProject }) => {
  const [searchText, setSearchText] = useState('');
  const [searchedColumn, setSearchedColumn] = useState('');
  const searchInput = useRef(null);

  useEffect(() => {
    if (selectedTeamProject) {
      store.fetchDocuments();
    }
  }, [store, selectedTeamProject]);

  const handleSearch = (selectedKeys, confirm, dataIndex) => {
    confirm();
    setSearchText(selectedKeys[0]);
    setSearchedColumn(dataIndex);
  };

  const handleReset = (clearFilters, confirm) => {
    clearFilters();
    setSearchText('');
    confirm();
  };

  const getColumnSearchProps = (dataIndex) => ({
    filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters, close }) => (
      <div
        style={{ padding: 8 }}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Input
          ref={searchInput}
          placeholder={`Search ${dataIndex}`}
          value={selectedKeys[0]}
          onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
          onPressEnter={() => handleSearch(selectedKeys, confirm, dataIndex)}
          style={{ marginBottom: 8, display: 'block' }}
        />
        <Space>
          <Button
            type='primary'
            onClick={() => handleSearch(selectedKeys, confirm, dataIndex)}
            icon={<SearchOutlined />}
            size='small'
            style={{ width: 90 }}
          >
            Search
          </Button>
          <Button
            onClick={() => clearFilters && handleReset(clearFilters, confirm)}
            size='small'
            style={{ width: 90 }}
          >
            Reset
          </Button>
          <Button
            type='link'
            size='small'
            onClick={() => {
              close();
            }}
          >
            Close
          </Button>
        </Space>
      </div>
    ),
    filterIcon: (filtered) => <SearchOutlined style={{ color: filtered ? '#1677ff' : undefined }} />,
    onFilter: (value, record) => record[dataIndex]?.toString().toLowerCase().includes(value.toLowerCase()),
    filterDropdownProps: {
      onOpenChange(open) {
        if (open) {
          setTimeout(() => searchInput.current?.select(), 100);
        }
      },
    },
    render: (text) =>
      searchedColumn === dataIndex ? (
        <Highlighter
          highlightStyle={{
            backgroundColor: '#ffc069',
            padding: 0,
          }}
          searchWords={[searchText]}
          autoEscape
          textToHighlight={text ? text.toString() : ''}
        />
      ) : (
        text
      ),
  });

  const columns = [
    {
      title: 'Document Title',
      dataIndex: 'name',
      key: 'name',
      ...getColumnSearchProps('name'),
      render: (text, record) => {
        const content =
          searchedColumn === 'name' ? (
            <Highlighter
              highlightStyle={{
                backgroundColor: '#ffc069',
                padding: 0,
              }}
              searchWords={[searchText]}
              autoEscape
              textToHighlight={text ? text.toString() : ''}
            />
          ) : (
            text
          );
        return <a href={record.url}>{content}</a>;
      },
      sorter: (a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
    },
    {
      title: 'Created By',
      dataIndex: 'createdBy',
      key: 'createdBy',
      ...getColumnSearchProps('createdBy'),
      render: (text) => {
        const content =
          searchedColumn === 'createdBy' ? (
            <Highlighter
              highlightStyle={{
                backgroundColor: '#ffc069',
                padding: 0,
              }}
              searchWords={[searchText]}
              autoEscape
              textToHighlight={text ? text.toString() : ''}
            />
          ) : (
            text
          );
        return content;
      },
      sorter: (a, b) => a.createdBy.toLowerCase().localeCompare(b.createdBy.toLowerCase()),
    },
    {
      title: 'Changed Date',
      dataIndex: 'lastModified',
      key: 'lastModified',
      render: (date) => new Date(date).toLocaleString(),
      sorter: (a, b) => new Date(a.lastModified) - new Date(b.lastModified),
    },
  ];

  return (
    <Stack spacing={2} sx={{ height: '100%', minHeight: 0 }}>
      <Alert severity='info' sx={{ flexShrink: 0 }}>
        Please save your documents in your local folders; a retention rule deletes items after two days.
      </Alert>
      {store.loadingState.documentsLoadingState ? (
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <LoadingState title='Fetching documents' columns={[2, 1, 1]} />
        </Box>
      ) : (
        <Paper
          variant='outlined'
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 2,
            overflow: 'hidden',
            bgcolor: (theme) => theme.palette.background.paper,
            '& .ant-table-wrapper': { borderRadius: 0 },
            '& .ant-table-container': { borderRadius: 0 },
            '& .ant-table-content': { borderRadius: 0 },
          }}
        >
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: { xs: 0, md: 1 } }}>
            <Table
              loading={false}
              dataSource={store.documents}
              rowKey={(record) => record?.url || record?.name}
              columns={columns}
              pagination={{
                defaultPageSize: 10,
                showSizeChanger: true,
                pageSizeOptions: ['10', '20', '50'],
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} documents`,
              }}
            />
          </Box>
        </Paper>
      )}
    </Stack>
  );
});
export default DocumentsTab;
