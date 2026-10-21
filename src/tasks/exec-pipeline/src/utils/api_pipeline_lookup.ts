import { apiRequest, HttpError } from "./api_client";

interface Definition {
  id: number;
  name: string;
  path: string;
}

/**
 * Resolve a pipeline name (optionally prefixed by its folder, e.g.
 * "team\\deploy" or "team/deploy") to its numeric ID.
 * @throws Error when no pipeline, or more than one, matches
 */
export async function resolvePipelineId(
  baseUrl: string,
  pipelineName: string,
  token: string,
  isBearer: boolean
): Promise<string> {
  const cut = Math.max(
    pipelineName.lastIndexOf("\\"),
    pipelineName.lastIndexOf("/")
  );
  const name = cut >= 0 ? pipelineName.slice(cut + 1) : pipelineName;
  const folder = cut >= 0 ? pipelineName.slice(0, cut).replace(/\//g, "\\") : "";

  let url = `${baseUrl}/_apis/build/definitions?name=${encodeURIComponent(
    name
  )}&api-version=7.1`;
  if (folder) {
    url += `&path=${encodeURIComponent(folder.startsWith("\\") ? folder : `\\${folder}`)}`;
  }
  const result = await apiRequest<{ value: Definition[] }>(url, token, isBearer);
  const matches = result.value ?? [];

  if (matches.length === 0) {
    throw new Error(
      `No pipeline named "${pipelineName}" was found. Check the name (and folder) or use the pipeline ID.`
    );
  }
  if (matches.length > 1) {
    const list = matches.map((m) => `${m.path}\\${m.name} (id ${m.id})`).join(", ");
    throw new Error(
      `More than one pipeline is named "${pipelineName}": ${list}. Prefix the name with its folder (folder\\name) or use the pipeline ID.`
    );
  }
  return `${matches[0].id}`;
}

/**
 * Ask Azure DevOps to cancel a run/build (run ID and build ID are the same).
 */
export async function cancelRun(
  baseUrl: string,
  runId: number | string,
  token: string,
  isBearer: boolean
): Promise<void> {
  await apiRequest(
    `${baseUrl}/_apis/build/builds/${runId}?api-version=7.1`,
    token,
    isBearer,
    { method: "PATCH", body: { status: "cancelling" } }
  );
}

/**
 * Actionable suggestion to append to the warning shown when cancelling a run fails.
 * Cancelling needs more than queueing: some projects forbid System.AccessToken from acting on another
 * run (HTTP 403 "Cross-run use of System.AccessToken is not allowed in this project").
 */
export function cancelFailureHint(error: unknown, isBearer: boolean): string {
  if (!(error instanceof HttpError) || (error.status !== 401 && error.status !== 403)) {
    return "";
  }
  return isBearer
    ? " The run keeps going. System.AccessToken may not be allowed to cancel other runs (some projects block cross-run use of the token): " +
        "to use cancelOnAbort there, run the task with a service connection or a personal access token (Build: Read & execute) that can stop builds on the target pipeline."
    : " The run keeps going. The service connection / personal access token needs permission to stop builds on the target pipeline.";
}
