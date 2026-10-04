import * as fs from "fs";
import * as path from "path";

/**
 * Read a JSON file with parameters/variables (a JSON object).
 * Relative paths are resolved against baseDir (the default working directory).
 * The file is parsed as-is: no quote replacement is applied.
 * @throws Error if the file cannot be read or is not a JSON object
 */
export function readParametersFile(
  filePath: string,
  baseDir: string = process.cwd()
): Record<string, any> {
  const fullPath = path.resolve(baseDir, filePath);
  let content: string;
  try {
    content = fs.readFileSync(fullPath, "utf8");
  } catch (e) {
    throw new Error(`Cannot read parameters file "${fullPath}": ${(e as Error).message}`);
  }
  let data: unknown;
  try {
    data = JSON.parse(content.replace(/^﻿/, ""));
  } catch (e) {
    throw new Error(`Parameters file "${fullPath}" is not valid JSON: ${(e as Error).message}`);
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`Parameters file "${fullPath}" must contain a JSON object.`);
  }
  return data as Record<string, any>;
}

/**
 * Process the parameters to be used in the pipeline
 * @param parameters The parameters to process (inline JSON, single quotes are accepted)
 * @param isParameter Boolean to know if the parameters are parameters or variables
 * @param execType The type of execution
 * @param fileData Values read from the parameters file; inline values override them
 * @returns Parameters or variables to be used in the pipeline
 * @throws Error if the inline JSON is invalid
 */
export function processParameters(
  parameters: string,
  isParameter: boolean,
  execType: string,
  fileData: Record<string, any> = {}
) {
  let dataContainer: Record<string, any> = { ...fileData };
  if (parameters) {
    parameters = parameters.replace(/'/gi, '"');
    try {
      dataContainer = { ...dataContainer, ...JSON.parse(parameters) };
    } catch (e) {
      throw new Error(
        `Error parsing parameters for ${isParameter ? "Parameters" : "Variables"}: ${(e as Error).message}`
      );
    }
  }
  if (
    !isParameter &&
    execType === "run" &&
    Object.keys(dataContainer).length !== 0
  ) {
    const transformed: Record<string, any> = {};
    for (const key of Object.keys(dataContainer)) {
      transformed[key] = { value: dataContainer[key] };
    }
    dataContainer = transformed;
  }
  return dataContainer;
}
