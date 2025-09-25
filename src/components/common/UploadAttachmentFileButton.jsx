import { Upload, Button } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import React, { useState } from 'react';
import { toast } from 'react-toastify';
import logger from '../../utils/logger';

const UploadAttachmentFileButton = ({ store, onNewFileUpload, onClear, bucketName, isDisabled }) => {
  const [fileList, setFileList] = useState([]);
  const [selectedUploadedFileResponse, setSelectedUploadedFileResponse] = useState(null);

  // Define allowed file types
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ];

  // File extensions for the accept attribute
  const acceptString = '.pdf,.doc,.docx,.txt';

  const uploadProps = {
    name: 'file',
    maxCount: 1,
    accept: acceptString,
    fileList: fileList,
    showUploadList: true,
    beforeUpload: async (file) => {
      // Validate file type
      if (!allowedTypes.includes(file.type)) {
        toast.error('You can only upload PDF, DOC, DOCX, or TXT files!');
        return Upload.LIST_IGNORE;
      }

      const newFile = {
        uid: file.uid,
        name: file.name,
        status: 'uploading',
      };
      setFileList([newFile]);

      try {
        const response = await store.uploadFile(file, bucketName);
        logger.info('File upload response:', response);
        const { fileItem } = response.data;

        // Update file status to done
        setFileList([
          {
            uid: file.uid,
            name: file.name,
            status: 'done',
            url: fileItem.url, // If fileItem has a URL property
          },
        ]);
        setSelectedUploadedFileResponse(fileItem); // Assuming fileItem has an etag property

        toast.success('File uploaded successfully');
        onNewFileUpload(fileItem);
      } catch (err) {
        // Update file status to error
        setFileList([
          {
            uid: file.uid,
            name: file.name,
            status: 'error',
          },
        ]);

        toast.error(`Error while uploading file ${err.message}`, { autoClose: false });
        console.error('Error uploading file:', err.message);
        onNewFileUpload(null);
      }
      return false;
    },
    onRemove: () => {
      setFileList([]);
      if (selectedUploadedFileResponse.etag) {
        store
          .deleteFileObject(selectedUploadedFileResponse, bucketName)
          .then(() => {
            toast.success('File deleted successfully');
            onClear();
          })
          .catch((err) => {
            toast.error(`Error while deleting file: ${err.message}`, { autoClose: false });
          });
      }
    },
  };

  return (
    <Upload {...uploadProps}>
      <Button
        disabled={isDisabled}
        icon={<UploadOutlined />}
      >
        Upload Installation Wiki File
      </Button>
    </Upload>
  );
};

export default UploadAttachmentFileButton;
