import * as tl from "azure-pipelines-task-lib";
import { getPipelineExecution, HttpError } from "./api_check_pipeline_status";

export interface PollOptions {
  /** Time between status checks (default 10s) */
  intervalMs?: number;
  /** Maximum time to wait for the pipeline, 0 = no limit (default) */
  timeoutMs?: number;
  /** Consecutive transient errors tolerated before failing (default 3) */
  maxConsecutiveErrors?: number;
  /** Injectable for tests */
  sleep?: (ms: number) => Promise<void>;
}

/** 125000 -> "2m 5s" */
export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Network errors, throttling (429) and 5xx are worth retrying; 4xx are not. */
function isTransient(error: unknown): boolean {
  if (error instanceof HttpError) {
    return error.status === 429 || error.status >= 500;
  }
  return true;
}

/**
 * Wait for a pipeline to finish and set the task result accordingly.
 * @param url_exec The URL to get the pipeline status
 * @param accessToken The access token to authenticate
 * @param is_bearer Boolean to know if the token is a bearer token
 * @param options Polling options
 * @returns The final result of the pipeline (succeeded, failed, ...) or "timeout"
 */
export async function processCheckPipelineStatus(
  url_exec: string,
  accessToken: string,
  is_bearer: boolean,
  options: PollOptions = {}
): Promise<string> {
  const intervalMs = options.intervalMs ?? 10000;
  const timeoutMs = options.timeoutMs ?? 0;
  const maxErrors = options.maxConsecutiveErrors ?? 3;
  const sleep = options.sleep ?? defaultSleep;
  const startedAt = Date.now();
  let consecutiveErrors = 0;
  let lastStatus: string | undefined;
  let lastLogAt = startedAt;
  const elapsed = () => formatDuration(Date.now() - startedAt);

  while (true) {
    if (timeoutMs > 0 && Date.now() - startedAt >= timeoutMs) {
      const message = `Timed out after ${Math.round(
        timeoutMs / 60000
      )} minute(s) waiting for the pipeline. The pipeline keeps running.`;
      console.error(message);
      tl.setResult(tl.TaskResult.Failed, message);
      return "timeout";
    }
    await sleep(intervalMs);

    let response: Record<string, any>;
    try {
      response = await getPipelineExecution(url_exec, accessToken, is_bearer);
      consecutiveErrors = 0;
    } catch (error) {
      consecutiveErrors++;
      if (isTransient(error) && consecutiveErrors < maxErrors) {
        console.warn(
          `Error fetching pipeline status (attempt ${consecutiveErrors}/${maxErrors}), retrying: ${error}`
        );
        continue;
      }
      console.error(`Error fetching pipeline status: ${error}`);
      tl.setResult(tl.TaskResult.Failed, `${error}`);
      return "error";
    }

    const pipelineStatus = response["status"] ?? response["state"];
    // Log on every change and, while nothing changes, once a minute
    if (pipelineStatus !== lastStatus || Date.now() - lastLogAt >= 60000) {
      console.log(`Pipeline status: ${pipelineStatus} (elapsed ${elapsed()})`);
      lastStatus = pipelineStatus;
      lastLogAt = Date.now();
    }
    if (pipelineStatus === "inProgress") {
      continue;
    }
    const pipelineResult = response["result"];

    if (pipelineResult === "succeeded") {
      console.log(`Pipeline completed successfully!!! (took ${elapsed()})`);
      tl.setResult(
        tl.TaskResult.Succeeded,
        "Pipeline completed successfully!!!"
      );
      return pipelineResult;
    } else if (pipelineResult === "partiallySucceeded") {
      console.log(`Pipeline partially succeeded!!! (took ${elapsed()})`);
      tl.setResult(
        tl.TaskResult.SucceededWithIssues,
        "Pipeline partially succeeded!!!"
      );
      return pipelineResult;
    } else if (pipelineResult === "canceled" || pipelineResult === "failed") {
      console.error(`Pipeline ${pipelineResult}... (after ${elapsed()})`);
      tl.setResult(tl.TaskResult.Failed, `Pipeline ${pipelineResult}...`);
      return pipelineResult;
    } else if (pipelineStatus === "completed") {
      // Finished with a result we do not know: do not wait forever.
      const message = `Pipeline completed with unexpected result: ${pipelineResult}`;
      console.error(message);
      tl.setResult(tl.TaskResult.Failed, message);
      return `${pipelineResult}`;
    }
  }
}
