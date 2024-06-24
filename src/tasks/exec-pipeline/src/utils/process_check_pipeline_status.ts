import * as tl from "azure-pipelines-task-lib/task";
import { getPipelineExecution } from "./api_check_pipeline_status";
import { logger } from "./logger";
/**
 * Get the pipeline status
 * @param url_exec The URL to get the pipeline status
 * @param accessToken The access token to authenticate
 * @param is_bearer Boolean to know if the token is a bearer token
 */
export async function processCheckPipelineStatus(
  url_exec: string,
  accessToken: string,
  is_bearer: boolean
) {
  const intervalTime = 10000;
  const intervalId = setInterval(async () => {
    try {
      const response = await getPipelineExecution(
        url_exec,
        accessToken,
        is_bearer
      );

      const pipelineStatus = response["status"] ?? response["state"];
      logger.info(`Pipeline status: ${pipelineStatus}`);
      if (pipelineStatus === "inProgress") {
        return;
      }
      const pipelineResult = response["result"];

      if (pipelineResult === "succeeded") {
        logger.info("Pipeline completed successfully!!!");
        tl.setResult(
          tl.TaskResult.Succeeded,
          "Pipeline completed successfully!!!"
        );
        clearInterval(intervalId);
      } else if (pipelineResult === "partiallySucceeded") {
        logger.info("Pipeline partially succeeded!!!");
        tl.setResult(
          tl.TaskResult.SucceededWithIssues,
          "Pipeline partially succeeded!!!"
        );
        clearInterval(intervalId);
      } else if (pipelineResult === "canceled" || pipelineResult === "failed") {
        logger.error(`Pipeline ${pipelineResult}...`);
        tl.setResult(tl.TaskResult.Failed, `Pipeline ${pipelineResult}...`);
        clearInterval(intervalId);
      }
    } catch (error) {
      logger.error(`Error fetching pipeline status: ${error}`);
      clearInterval(intervalId);
      tl.setResult(tl.TaskResult.Failed, error);
      process.exit(1);
    }
  }, intervalTime);
}
