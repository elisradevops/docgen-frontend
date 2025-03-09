import React, { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react';
import Highlighter from 'react-highlight-words';
import { Alert, Grid } from '@mui/material';
import { Button, Input, Space, Table } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

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
      sorter: (a, b) => a.name.localeCompare(b.name),
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
        <Table
          dataSource={store.documents}
          rowKey='name'
          columns={columns}
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} documents`,
          }}
        />
      </Grid>
    </Grid>
  );
});
export default DocumentsTab;
