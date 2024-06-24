import fetch from "node-fetch";
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
    parameters: JSON.stringify(parameters),
  };
  return await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }).then((res) => {
    if (res.status !== 200) {
      tl.setResult(tl.TaskResult.Failed, res.statusText);
      process.exit(1);
    }
    console.log("Pipeline execution started...");
    const data: Promise<Build> = res.json();
    return data;
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
    templateParameters: isParameter ? parameters : {},
    variables: !isParameter ? parameters : {},
  };
  return await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }).then((res) => {
    if (res.status !== 200) {
      tl.setResult(tl.TaskResult.Failed, res.statusText);
      process.exit(1);
    }
    console.log("Pipeline execution started...");
    const data: Promise<PipelineRun> = res.json();
    return data;
  });
}
