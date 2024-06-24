import * as tl from "azure-pipelines-task-lib";
import { PipelineRun } from "./interface/run";
import { Build } from "./interface/queue";
import { exec_pipeline } from "./utils/process_exec_pipeline";
import { processParameters } from "./utils/process_parameters";
import { processCheckPipelineStatus } from "./utils/process_check_pipeline_status";

/**
 * Runs the Exec Pipeline Task.
 * This function retrieves the necessary inputs from the task configuration,
 * and creates the repository if it doesn't exist.
 */
async function run() {
  let url: string;
  let token: string;
  let isBearer = false;
  let returnedData: PipelineRun | Build;
  const useServiceConnection = tl.getInput("useSVC", true) === "true";

  if (useServiceConnection) {
    const idServiceconnection: string =
      tl.getInput("azureDevopsPath", true) ?? "";

    const organization = tl.getEndpointAuthorizationParameter(
      idServiceconnection,
      "organization",
      true
    );
    const project = tl.getEndpointAuthorizationParameter(
      idServiceconnection,
      "project",
      true
    );

    url = `https://dev.azure.com/${organization}/${project}`;
    token = Buffer.from(
      `${tl.getEndpointAuthorizationParameter(
        idServiceconnection,
        "apitoken",
        true
      )}:`
    ).toString("base64");
  } else {
    const teamFundationUri = tl.getVariable(
      "System.TeamFoundationCollectionUri"
    );
    const teamProject = tl.getVariable("System.TeamProject");
    url = `${teamFundationUri}${teamProject}`;
    token = tl.getVariable("System.AccessToken")!;
    isBearer = true;
  }

  const branch = tl.getInput("branch", true)!;
  const pipelineId = tl.getInput("pipelineID", true)!;
  const execType = tl.getInput("execType", true)!;
  let parameters = tl.getInput("parameters", false) ?? "";
  const isParameter = tl.getInput("isParameter", false) === "true";
  const onlyExecution = tl.getInput("onlyExecution", false) === "true";
  const dataContainer = processParameters(parameters, isParameter, execType);

  returnedData = await exec_pipeline(
    execType,
    pipelineId,
    branch,
    dataContainer,
    isParameter,
    token,
    isBearer,
    url
  );
  console.log(`Pipeline URL: ${returnedData._links.web.href}`);
  if (!onlyExecution) {
    processCheckPipelineStatus(returnedData.url, token, isBearer);
  }
}

run();
