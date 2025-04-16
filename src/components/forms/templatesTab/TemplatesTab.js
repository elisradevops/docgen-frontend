import React, { useEffect, useState, useRef } from 'react';
import { observer } from 'mobx-react';
import { Alert, Grid } from '@mui/material';
import { Button, Table, Tooltip, Input, Space } from 'antd';
import { DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { toast } from 'react-toastify';
import Highlighter from 'react-highlight-words';

const TemplatesTab = observer(({ store, selectedTeamProject }) => {
  const [templates, setTemplates] = useState([]);
  const [deletingTemplateEtag, setDeletingTemplateEtag] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [searchedColumn, setSearchedColumn] = useState('');
  const searchInput = useRef(null);

  useEffect(() => {
    store.fetchTemplatesListForDownload();
  }, [selectedTeamProject]);

  useEffect(() => {
    setTemplates(store.templateForDownload || []);
  }, [store.templateForDownload]);

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

  const handleTemplateDelete = (template) => {
    setDeletingTemplateEtag(template.etag);
    store
      .deleteFileObject(template, 'templates')
      .then((res) => {
        toast.success('Template deleted successfully');
      })
      .catch((err) => {
        const templateName = template.name.split('/').pop();
        toast.error(`Error while deleting template ${templateName}: ${err.message}`, { autoClose: false });
      })
      .finally(() => {
        setDeletingTemplateEtag(null);
        store.fetchTemplatesListForDownload();
      });
  };

  const columns = [
    {
      title: 'Template File',
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
      sortDirections: ['ascend', 'descend'],
    },
    {
      title: 'Last Modified',
      dataIndex: 'lastModified',
      key: 'lastModified',
      sorter: (a, b) => new Date(a.lastModified) - new Date(b.lastModified),
      sortDirections: ['ascend', 'descend'],
      render: (text) => new Date(text).toLocaleString(),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Tooltip title='Delete Template'>
          <Button
            loading={deletingTemplateEtag === record.etag}
            disabled={record.name.startsWith('shared/')}
            onClick={() => handleTemplateDelete(record)}
            icon={<DeleteOutlined />}
            danger
          />
        </Tooltip>
      ),
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
          To download a template for a specific project, pick the project from the dropdown above. Otherwise,
          you'll see the shared templates.
        </Alert>
      </Grid>
      <Grid
        item
        xs={12}
      >
        <Table
          columns={columns}
          dataSource={templates.map((row, index) => ({
            ...row,
            key: row.name || index,
          }))}
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} templates`,
          }}
        />
      </Grid>
    </Grid>
  );
});

export default TemplatesTab;
