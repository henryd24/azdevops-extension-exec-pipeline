import { Build } from "../interface/queue";
import { PipelineRun } from "../interface/run";
import * as tl from "azure-pipelines-task-lib";
import { normalizeBranch } from "./process_options";
import { apiRequest, HttpError } from "./api_client";

/** Log a readable error and mark the task as failed; returns the error flagged as Failed */
function handleFailure(err: any) {
  const message = err instanceof Error ? err.message : `${err}`;
  tl.error(`Pipeline execution could not be started. ${message}`);
  const hint = err instanceof HttpError ? err.hint : "";
  if (hint) {
    tl.error(hint);
  }
  tl.setResult(tl.TaskResult.Failed, "Pipeline execution could not be started (see the errors above).");
  const failed = err instanceof Error ? err : new Error(message);
  failed["status"] = "Failed";
  return failed;
}

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
  const body = {
    definition: {
      id: pipelineId,
    },
    sourceBranch: normalizeBranch(branch),
    reason: reason,
    ...(isParameter ? { templateParameters: parameters } : { parameters: JSON.stringify(parameters) }),
  };
  tl.debug(`Request URL: ${url}`);
  tl.debug(`Request Body: ${JSON.stringify(body)}`);
  try {
    const data = await apiRequest<Build>(url, token, isBearer, { method: "POST", body });
    console.log("Pipeline execution started...");
    return data;
  } catch (err) {
    return handleFailure(err) as any;
  }
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
  const body = {
    resources: {
      repositories: {
        self: {
          refName: normalizeBranch(branch),
        },
      },
    },
    ...(isParameter ? { templateParameters: parameters } : { variables: parameters }),
  };
  tl.debug(`Request URL: ${url}`);
  tl.debug(`Request Body: ${JSON.stringify(body)}`);
  try {
    const data = await apiRequest<PipelineRun>(url, token, isBearer, { method: "POST", body });
    console.log("Pipeline execution started...");
    return data;
  } catch (err) {
    return handleFailure(err) as any;
  }
}
