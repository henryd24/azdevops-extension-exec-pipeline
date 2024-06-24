import * as tl from "azure-pipelines-task-lib";

/**
 * Process the parameters to be used in the pipeline
 * @param parameters The parameters to process
 * @param isParameter Boolean to know if the parameters are parameters or variables
 * @param execType The type of execution
 * @returns Parameters or variables to be used in the pipeline
 */
export function processParameters(
  parameters: string,
  isParameter: boolean,
  execType: string
) {
  let dataContainer: Record<string, any> = {};
  if (parameters) {
    parameters = parameters.replace(/'/gi, '"');
    try {
      dataContainer = JSON.parse(parameters);
      if (
        !isParameter &&
        execType === "run" &&
        Object.keys(dataContainer).length !== 0
      ) {
        let transformed = {};
        for (var key in dataContainer) {
          if (dataContainer.hasOwnProperty(key)) {
            transformed[key] = { value: dataContainer[key] };
          }
        }
        dataContainer = transformed;
      }
    } catch (e) {
      console.error(
        `Error parsing parameters for ${
          isParameter ? "Parameters" : "Variables"
        }:`,
        e
      );
      tl.setResult(tl.TaskResult.Failed, e);
    }
  }
  return dataContainer;
}
