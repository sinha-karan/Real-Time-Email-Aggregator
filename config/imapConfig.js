require("dotenv").config();

const imapConfig = [
  {
    user: process.env.EMAIL1_USER,
    password: process.env.EMAIL1_PASSWORD,
    host: process.env.EMAIL1_HOST,
    port: 993,
    tls: true,
  },
  {
    user: process.env.EMAIL2_USER,
    password: process.env.EMAIL2_PASSWORD,
    host: process.env.EMAIL2_HOST,
    port: 993,
    tls: true,
  },
];

module.exports = imapConfig;