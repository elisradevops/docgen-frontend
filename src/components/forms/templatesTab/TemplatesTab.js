import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react';
import { Alert, Grid } from '@mui/material';
import { Button, Table, Tooltip } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { toast } from 'react-toastify';
import { set } from 'mobx';
const TemplatesTab = observer(({ store, selectedTeamProject }) => {
  const [templates, setTemplates] = useState([]);
  const [deletingTemplateEtag, setDeletingTemplateEtag] = useState(null);
  useEffect(async () => {
    store.fetchTemplatesListForDownload();
  }, [selectedTeamProject]);

  useEffect(() => {
    setTemplates(store.templateForDownload || []);
  }, [store.templateForDownload]);

  const handleTemplateDelete = (template) => {
    setDeletingTemplateEtag(template.etag);
    store
      .deleteTemplate(template)
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
      render: (text, record) => <a href={record.url}>{text}</a>,
    },
    {
      title: 'Last Modified',
      dataIndex: 'lastModified',
      key: 'lastModified',
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
            key: row.name || index, // Adding a key property required by Ant Design
          }))}
          pagination={false} // Optional: removes pagination if not needed
        />
      </Grid>
    </Grid>
  );
});

export default TemplatesTab;
