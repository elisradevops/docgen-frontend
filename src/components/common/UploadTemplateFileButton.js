import { Button } from '@mui/material';
import { styled } from '@mui/material/styles';
import React from 'react';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { toast } from 'react-toastify';
import logger from '../../utils/logger';

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

const StyledButton = styled(Button)(({ theme }) => ({
  height: '100%',
  width: '100%',
  padding: theme.spacing(1.5),
}));

const UploadTemplateFileButton = ({ store, onNewFileUpload, bucketName }) => {
  const handleUpload = async (event) => {
    if (event.target.files?.length > 0) {
      const file = event.target.files[0];
      if (file) {
        try {
          const response = await store.uploadFile(file, bucketName);
          const { fileItem } = response.data;
          onNewFileUpload(fileItem);
          toast.success('File uploaded successfully');
        } catch (err) {
          toast.error(`Error while uploading file ${err.message}`, { autoClose: false });
          logger.error('Error uploading file:', err.message);
          //Refresh the template list
          onNewFileUpload(null);
        }
      }
    }
  };

  return (
    <StyledButton
      component='label'
      variant='contained'
      startIcon={<CloudUploadIcon />}
    >
      Upload
      <VisuallyHiddenInput
        type='file'
        name='file'
        onChange={handleUpload}
      />
    </StyledButton>
  );
};

export default UploadTemplateFileButton;
