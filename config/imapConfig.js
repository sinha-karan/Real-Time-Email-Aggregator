require("dotenv").config();

const imapConfig = [
  {
    user: process.env.EMAIL1_USER,
    password: process.env.EMAIL1_PASSWORD,
    host: "imap.gmail.com",
    port: 993,
    tls: true,
    tlsOptions: {
       rejectUnauthorized: false, 
    },
  },
  {
    user: process.env.EMAIL2_USER,
    password: process.env.EMAIL2_PASSWORD,
    host: "imap.gmail.com",
    port: 993,
    tls: true,
    tlsOptions: {
      rejectUnauthorized: false,
    },
  },
];

module.exports = imapConfig;