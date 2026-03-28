import { Build } from "../interface/queue";
import { PipelineRun } from "../interface/run";
import * as tl from "azure-pipelines-task-lib";

/**
 * Execute a pipeline by its ID
 * @param pipelineId The ID of the pipeline
 * @param branch The branch to execute the pipeline
 * @param reason  The reason to execute the pipeline
 * @param parameters  The parameters to execute the pipeline
 * @param token The token to authenticate
 * @param isBearer  Boolean to know if the token is a bearer token
 * @param baseUri The base URI to execute the pipeline
 * @returns Build object (defined in the interface folder)
 */
export async function execPipelineQueue(
  pipelineId: string,
  branch: string,
  reason: string,
  parameters: Record<string, any>,
  isParameter: boolean,
  token: string,
  isBearer: boolean,
  baseUri: string
): Promise<Build> {
  const url = `${baseUri}/_apis/build/builds?api-version=7.2-preview.7`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: isBearer ? `Bearer ${token}` : `Basic ${token}`,
  };
  const body = {
    definition: {
      id: pipelineId,
    },
    sourceBranch: `refs/heads/${branch}`,
    reason: reason,
    ...(isParameter ? { templateParameters: parameters } : { variables: parameters }),
  };
  tl.debug(`Request URL: ${url}`);
  tl.debug(`Request Body: ${JSON.stringify(body)}`);
  return await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }).then((res) => {
    if (res.status !== 200) {
      tl.error(`Validate if the inputs parameters are correct (pipeline ID, branch, etc) and if the pipeline has the correct permissions to be executed.`);
      throw new Error(`Pipeline execution failed with status ${res.status}: ${res.statusText}`);
    }
    console.log("Pipeline execution started...");
    const data: Promise<Build> = res.json();
    return data;
  })
  .catch((err) => {
    err["status"] = "Failed";
    tl.setResult(tl.TaskResult.Failed, err);
    return err;
  });
}

/**
 * Run a pipeline by its ID
 * @param pipelineId The ID of the pipeline
 * @param branch  The branch to execute the pipeline
 * @param parameters  The parameters to execute the pipeline
 * @param isParameter Boolean to know if the parameters are parameters or variables
 * @param token The token to authenticate
 * @param isBearer  Boolean to know if the token is a bearer token
 * @param baseUri The base URI to execute the pipeline
 * @returns PipelineRun object (defined in the interface folder)
 */
export async function execPipelineRun(
  pipelineId: string,
  branch: string,
  parameters: Record<string, any>,
  isParameter: boolean,
  token: string,
  isBearer: boolean,
  baseUri: string
) {
  const url = `${baseUri}/_apis/pipelines/${pipelineId}/runs?api-version=7.2-preview.1`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: isBearer ? `Bearer ${token}` : `Basic ${token}`,
  };
  const body = {
    resources: {
      repositories: {
        self: {
          refName: `refs/heads/${branch}`,
        },
      },
    },
    ...(isParameter ? { templateParameters: parameters } : { variables: parameters }),
  };
  tl.debug(`Request URL: ${url}`);
  tl.debug(`Request Body: ${JSON.stringify(body)}`);
  return await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }).then((res) => {
    if (res.status !== 200) {
      tl.error(`Validate if the inputs parameters are correct (pipeline ID, branch, etc) and if the pipeline has the correct permissions to be executed.`);
      tl.setResult(tl.TaskResult.Failed, res.statusText);
      throw new Error(`Pipeline execution failed with status ${res.status}: ${res.statusText}`);
    }
    console.log("Pipeline execution started...");
    const data: Promise<PipelineRun> = res.json();
    return data;
  })
  .catch((err) => {
    err["status"] = "Failed";
    tl.setResult(tl.TaskResult.Failed, err);
    return err;
  });
}
