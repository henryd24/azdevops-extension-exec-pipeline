import * as bunyan from "bunyan";
import * as tl from "azure-pipelines-task-lib";

const debug = tl.getVariable("System.Debug") === "true";

const logger = bunyan.createLogger({
  name: "extension",
  level: debug ? "debug" : "info",
  streams: [
    {
      level: "info",
      stream: process.stdout,
    },
  ],
  serializers: bunyan.stdSerializers,
});

export { logger };

// import { createLogger, format, transports } from "winston";
// import * as tl from "azure-pipelines-task-lib/task";

// const debug = tl.getVariable("System.Debug") === "true";

// const logger = createLogger({
//   level: debug ? "debug" : "info",
//   format: format.combine(
//     format.timestamp(),
//     format.printf(({ timestamp, level, message }) => {
//       return `${timestamp} [${level}]: ${message}`;
//     })
//   ),
//   transports: [
//     new transports.Console(),
//     //new transports.File({ filename: "application.log" }),
//   ],
// });

// export { logger };
