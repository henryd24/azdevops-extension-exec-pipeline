import fetch from "node-fetch";
import * as tl from "azure-pipelines-task-lib";

/**
 * Function to get a pipeline execution
 * @param url URL to get a pipeline execution
 * @param token Token to authenticate
 * @param isBearer Boolean to know if the token is a bearer token
 * @returns Pipeline execution object (Json)
 */
export async function getPipelineExecution(
  url: string,
  token: string,
  isBearer: boolean
): Promise<Record<string, any>> {
  const headers = {
    Accept: "application/json",
    Authorization: isBearer ? `Bearer ${token}` : `Basic ${token}`,
  };
  return await fetch(url, {
    headers,
  }).then((res) => {
    if (res.status !== 200) {
      tl.setResult(tl.TaskResult.Failed, res.statusText);
      process.exit(1);
    }
    return res.json();
  });
}
