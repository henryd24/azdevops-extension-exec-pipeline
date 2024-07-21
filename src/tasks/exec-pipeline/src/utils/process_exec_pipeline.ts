import { Build } from "../interface/queue";
import { PipelineRun } from "../interface/run";
import { execPipelineQueue, execPipelineRun } from "./api_exec_pipelines";
import * as tl from "azure-pipelines-task-lib";

/**
 * Execute a pipeline by its ID
 * @param pipelineId The ID of the pipeline
 * @param branch The branch to execute the pipeline
 * @param reason The reason to execute the pipeline
 * @param parameters The parameters to execute the pipeline
 * @param token The token to authenticate
 * @param isBearer  Boolean to know if the token is a bearer token
 * @param baseUri   The base URI to execute the pipeline
 * @returns Build or PipelineRun object depending on the execution type (both interfaces are defined in the interface folder)
 */
export async function exec_pipeline(
  exec_type: string,
  pipeline_id: string,
  branch: string,
  parameters: Record<string, any>,
  is_parameter: boolean,
  token: string,
  is_bearer: boolean,
  url: string
): Promise<PipelineRun | Build> {
  if (exec_type === "run") {
    return await execPipelineRun(
      pipeline_id,
      branch,
      parameters,
      is_parameter,
      token,
      is_bearer,
      url
    );
  } else {
    const reason = tl.getInput("reason", true)!;
    return await execPipelineQueue(
      pipeline_id,
      branch,
      reason,
      parameters,
      token,
      is_bearer,
      url
    );
  }
}
