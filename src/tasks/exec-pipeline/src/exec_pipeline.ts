import * as tl from "azure-pipelines-task-lib";
import { PipelineRun } from "./interface/run";
import { Build } from "./interface/queue";
import { exec_pipeline } from "./utils/process_exec_pipeline";
import { processParameters, readParametersFile } from "./utils/process_parameters";
import {
  processCheckPipelineStatus,
  formatDuration,
} from "./utils/process_check_pipeline_status";
import { parseNumberInput, normalizeBranch } from "./utils/process_options";
import { resolveTarget } from "./utils/process_target";
import { cancelRun, resolvePipelineId } from "./utils/api_pipeline_lookup";

/**
 * Runs the Exec Pipeline Task.
 * Resolves the target (organization/project/credentials), starts the pipeline
 * and, optionally, waits for it to finish.
 */
async function run() {
  const useServiceConnection = tl.getInput("useSVC", true) === "true";
  let svc: { organization: string; project: string; apitoken: string } | undefined;

  if (useServiceConnection) {
    const idServiceconnection: string =
      tl.getInput("azureDevopsPath", true) ?? "";
    svc = {
      organization: tl.getEndpointAuthorizationParameter(idServiceconnection, "organization", true)!,
      project: tl.getEndpointAuthorizationParameter(idServiceconnection, "project", true)!,
      apitoken: tl.getEndpointAuthorizationParameter(idServiceconnection, "apitoken", true)!,
    };
  }

  const personalAccessToken = tl.getInput("personalAccessToken", false);
  if (personalAccessToken) {
    tl.setSecret(personalAccessToken);
  }

  const target = resolveTarget({
    useServiceConnection,
    svc,
    collectionUri: tl.getVariable("System.TeamFoundationCollectionUri"),
    teamProject: tl.getVariable("System.TeamProject"),
    accessToken: tl.getVariable("System.AccessToken"),
    targetOrganization: tl.getInput("targetOrganization", false),
    targetProject: tl.getInput("targetProject", false),
    personalAccessToken,
  });
  target.warnings.forEach((w) => tl.warning(w));
  const { url, token, isBearer } = target;

  const branch = tl.getInput("branch", true)!;
  const execType = tl.getInput("execType", true)!;
  const isParameter = tl.getInput("isParameter", false) === "true";
  const onlyExecution = tl.getInput("onlyExecution", false) === "true";
  const cancelOnAbort = tl.getInput("cancelOnAbort", false) === "true";

  // Pipeline: the ID wins over the name when both are given
  let pipelineId = tl.getInput("pipelineID", false)?.trim() ?? "";
  const pipelineName = tl.getInput("pipelineName", false)?.trim() ?? "";
  if (pipelineId && pipelineName) {
    tl.warning("Both pipelineID and pipelineName were provided: using pipelineID.");
  }
  if (!pipelineId) {
    if (!pipelineName) {
      throw new Error("Provide either the pipeline ID or the pipeline name.");
    }
    pipelineId = await resolvePipelineId(url, pipelineName, token, isBearer);
    console.log(`Pipeline "${pipelineName}" resolved to ID ${pipelineId}`);
  }

  // Parameters: optional JSON file, overridden by the inline JSON
  const parametersFile = tl.getInput("parametersFile", false)?.trim();
  const fileData = parametersFile
    ? readParametersFile(parametersFile, tl.getVariable("System.DefaultWorkingDirectory") ?? process.cwd())
    : {};
  const dataContainer = processParameters(
    tl.getInput("parameters", false) ?? "",
    isParameter,
    execType,
    fileData
  );

  const kind = isParameter ? "Parameters" : "Variables";
  const names = Object.keys(dataContainer);
  console.log("Executing pipeline");
  console.log(`  Organization/Project: ${target.organization}/${target.project}`);
  console.log(`  Pipeline ID:          ${pipelineId}`);
  console.log(`  Branch:               ${normalizeBranch(branch)}`);
  console.log(`  Execution type:       ${execType}`);
  console.log(`  ${(kind + ":").padEnd(22)}${names.length ? names.join(", ") : "(none)"}`);

  const returnedData: PipelineRun | Build = await exec_pipeline(
    execType,
    pipelineId,
    branch,
    dataContainer,
    isParameter,
    token,
    isBearer,
    url
  );

  if (!returnedData) {
    tl.setResult(tl.TaskResult.Failed, "Pipeline execution failed. Check logs for more details.");
    return;
  }
  if (returnedData["status"] === "Failed") {
    // The error and the failed result were already reported by the API layer
    return;
  }

  const webUrl = returnedData._links.web.href;
  console.log(`Pipeline URL: ${webUrl}`);
  // Output variables (reference them as $(<step name>.runId) from later steps)
  tl.setVariable("runId", `${returnedData.id}`, false, true);
  tl.setVariable("runUrl", webUrl, false, true);

  if (onlyExecution) {
    return;
  }

  const cancelChild = async (why: string) => {
    console.log(`${why}: canceling pipeline run ${returnedData.id}...`);
    try {
      await cancelRun(url, returnedData.id, token, isBearer);
    } catch (e) {
      tl.warning(`Could not cancel pipeline run ${returnedData.id}: ${e}`);
    }
  };
  if (cancelOnAbort) {
    const onSignal = async () => {
      await cancelChild("Task canceled");
      tl.setResult(tl.TaskResult.Failed, "Task canceled");
      process.exit(1);
    };
    process.once("SIGINT", onSignal);
    process.once("SIGTERM", onSignal);
  }

  const intervalSeconds = parseNumberInput(
    "pollIntervalSeconds",
    tl.getInput("pollIntervalSeconds", false),
    10,
    5,
    300
  );
  const timeoutMinutes = parseNumberInput(
    "timeoutMinutes",
    tl.getInput("timeoutMinutes", false),
    0,
    0,
    10080
  );
  const startedAt = Date.now();
  const result = await processCheckPipelineStatus(returnedData.url, token, isBearer, {
    intervalMs: intervalSeconds * 1000,
    timeoutMs: timeoutMinutes * 60000,
  });
  tl.setVariable("runResult", result, false, true);
  if (result === "timeout" && cancelOnAbort) {
    await cancelChild("Wait timeout reached");
  }
  console.log(`Summary: ${result} after ${formatDuration(Date.now() - startedAt)} - ${webUrl}`);
}

run().catch((err) => {
  tl.setResult(tl.TaskResult.Failed, err?.message ?? `${err}`);
});
