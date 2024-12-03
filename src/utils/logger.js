import * as winston from 'winston';

import { format } from 'winston';
let logsPath = process.env.logs_path || './logs/';
const logFormat = winston.format.printf((info) => {
  // Function to stringify messages and metadata
  const stringify = (obj) => {
    if (typeof obj === 'object') {
      return JSON.stringify(obj, null, 2);
    }
    return obj;
  };

  // Stringify the main message
  const message = stringify(info.message);

  // Stringify additional metadata
  const meta = info[Symbol.for('splat')] || [];
  const metaString = meta.map(stringify).join(' ');

  return `${info.timestamp} - ${info.level}: ${message} ${metaString}`;
});
const logger = winston.createLogger({
  format: format.combine(format.timestamp(), format.colorize()),
  level: 'silly',
  transports: [new winston.transports.Console({ format: logFormat, level: 'debug' })],
});

export default logger;
