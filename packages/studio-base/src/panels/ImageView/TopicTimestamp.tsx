// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { makeStyles } from "@mui/styles";

const useStyles = makeStyles({
  topicTimestamp: {
    padding: "0px 15px 0px 0px",
    fontSize: 10,
    fontStyle: "italic",
  },
});

type Props = {
  text: string;
  style?: {
    [key: string]: string;
  };
};

export const TopicTimestamp = (props: Props): JSX.Element => {
  const { text, style: styleObj } = props;
  const classes = useStyles();
  if (text === "") {
    return <></>;
  }

  return (
    <span className={classes.topicTimestamp} style={styleObj}>
      {text}
    </span>
  );
};
