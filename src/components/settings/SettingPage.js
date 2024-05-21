import React, { useState } from "react";
import { observer } from "mobx-react";
import {
  Grid,
  Paper,
  Avatar,
  TextField,
  FormControlLabel,
  Checkbox,
  Button,
} from "@material-ui/core";

const SettingsPage = observer(({ store, login }) => {
  const [selectedUrl, setSelectedUrl] = useState("www.example.com");
  const [selectedPat, setSelectedPAT] = useState("");

  const paperStyle = {
    padding: 40,
    height: "35vh",
    width: 280,
    margin: "100px auto",
  };

  const avatarStyle = { backgroundColor: "red" };
  const buttonStyle = { margin: "8px 0" };
  return (
    <Grid>
      <Paper elevation={10} style={paperStyle}>
        <Grid align="center">
          <Avatar style={avatarStyle}>DG</Avatar>
          <h2>Login</h2>
          <TextField
            name="org-url"
            label="Organization Url:"
            placeholder="Enter url"
            onChange={(event) => {
              setSelectedUrl(event.target.value);
            }}
            fullWidth
            required
          />
          <TextField
            label="Personal Access Token"
            placeholder="Enter Token"
            onChange={(event) => {
              setSelectedPAT(event.target.value);
            }}
            type="password"
            fullWidth
            required
          />
        </Grid>
        <Button
          type="submit"
          color="primary"
          variant="contained"
          fullWidth
          style={buttonStyle}
          onClick={() => {
            login(selectedUrl, selectedPat);
          }}
        >
          Sign in
        </Button>
      </Paper>
    </Grid>
  );
});

export default SettingsPage;
