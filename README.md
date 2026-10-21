# Extension to Execute Pipelines in Azure DevOps

This extension allows executing Azure DevOps pipelines from another pipeline and waiting for the executed pipeline to finish. It also allows choosing whether to consume the RUN or QUEUE API.

# Usage and Inputs

<div style="display: flex; justify-content: space-around;">
  <img src="https://i.imgur.com/DtOdXwS.png" alt="inputs" style="width: 45%;">
  <img src="https://i.imgur.com/d0RlVQh.png" alt="inputs2" style="width: 45%;">
</div>

Search for the task called "Exec Pipeline" and the inputs are as follows:

1. **Use Service Connection** (required): Indicates if a service connection will be used to consume the Azure DevOps API. If not, the pipeline execution token will be used.
2. **Azure Devops PAT** (optional): If you selected the option to use a service connection, you must select the service connection to be used. Otherwise, this field will not be displayed. See [Personal Access Token (PAT) scopes](#personal-access-token-pat-scopes).
3. **Branch** (required): The branch with which the pipeline will be executed.
4. **Pipeline Id** (required): The ID of the pipeline to be executed.
5. **Execution Type** (required): The type of execution to be performed. If "Run" is selected, the pipeline will run immediately. If "Queue" is selected, the pipeline will be queued. Both options execute the pipeline, but "Queue" allows changing the Run Reason.
6. **Run Reason** (optional/required only in queue): The reason for executing the pipeline. This is only used if the "Execution Type" is "Queue".
7. **Extra Data is Parameter** (optional): Indicates if additional information will be sent to the pipeline to be executed. If "true" (selected), it will be sent as a parameter; if "false", it will be sent as a variable.
8. **Parameters or Variables** (optional): Additional information to be sent to the pipeline to be executed. It is sent in JSON format, for example: {"key1": "value1", "key2": "value2"}.
9. **Just execute** (optional): Indicates if you will wait for the executed pipeline to finish. If "true" (selected), it will wait; if "false", it will not wait.

10. **Polling interval (seconds)** (optional): Seconds between status checks while waiting (5-300). Default `10`.
11. **Wait timeout (minutes)** (optional): Maximum time to wait for the executed pipeline. `0` (default) means no limit. On timeout the task fails, but the executed pipeline keeps running (unless "Cancel executed pipeline" is enabled).
12. **Pipeline Name** (optional): Alternative to *Pipeline ID*. If several pipelines share a name, prefix it with the folder (`folder\name`). If both are set, the ID is used.
13. **Parameters file (JSON)** (optional): Path (relative to the working directory) to a JSON file with an object of parameters/variables. The file is read as standard JSON; values in the inline field override the file. To use a pipeline variable instead, write `$(myVariable)` in the inline field.
14. **Target Organization / Target Project** (optional): Run a pipeline that lives in another project or organization. See below.
15. **Personal Access Token** (optional, only without a service connection): PAT used for another organization. Pass a secret variable, e.g. `$(myPat)`.
16. **Cancel executed pipeline on cancel/timeout** (optional): While waiting, cancel the executed pipeline if this task is canceled or the wait timeout is reached.

The **Branch** input accepts either a branch name (`main`) or a full ref (`refs/heads/main`, `refs/tags/v1`).

# Other projects and organizations

| Scenario                                  | What to configure                                                                                                                        |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Same project                              | Nothing (default).                                                                                                                       |
| Another project, same organization        | `targetProject`. With `System.AccessToken` the project's *Build Service* identity must have access to the target project and pipeline.  |
| Another organization (no service connection) | `targetOrganization` + `targetProject` + `personalAccessToken` (PAT with *Build: Read & execute*).                                     |
| Another organization (service connection) | Use a service connection that stores the destination organization/project/PAT. `targetProject` can still override the project.        |

# Output variables

Give the step a `name` to read these from later steps as `$(<name>.<variable>)`:

| Variable    | Description                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------- |
| `runId`     | ID of the executed run/build                                                                 |
| `runUrl`    | Web URL of the executed run/build                                                            |
| `runResult` | `succeeded`, `partiallySucceeded`, `failed`, `canceled` or `timeout` (only when waiting)    |

Error messages include the reason reported by Azure DevOps and a hint (authentication, permissions, not found...). Parameter and variable *names* are logged, never their values.

Transient errors (network, HTTP 429/5xx) while waiting are retried up to 3 times before the task fails.

# Usage Example

```yaml
- task: hendamm-exec-pipeline-task@0
  inputs:
    useSVC: false
    branch: "main"
    pipelineID: "1234"
    execType: "queue"
    reason: "individualCI"
    parameters: '{"key1": "value1", "key2": "value2"}'
```

Another project, by pipeline name, with a parameters file and waiting up to 30 minutes:

```yaml
- task: hendamm-exec-pipeline-task@0
  name: deploy
  inputs:
    useSVC: false
    targetProject: "Platform"
    pipelineName: "infra\\deploy"
    branch: "main"
    execType: "run"
    isParameter: true
    parametersFile: "config/deploy-params.json"
    onlyExecution: false
    timeoutMinutes: 30
    cancelOnAbort: true
- script: echo "Result $(deploy.runResult) - $(deploy.runUrl)"
```

# Installation

To install the project dependencies, run the following command:

```bash
npm install
```

# Build

To build the extension, use the following command:

```bash
npm run build
```

# Package

To package the extension, use the following command:

```bash
npm run pack
# Bump version and package
npm run packupversion
```

## Personal Access Token (PAT) scopes

The service connection asks for an Azure DevOps Personal Access Token (create one in Azure DevOps under *User settings → Personal access tokens → New Token*). Use **Custom defined** scopes and enable only:

| Scope | Access | Why |
| --- | --- | --- |
| **Build** | **Read & execute** | Queue/run the pipeline, look up pipelines by name and read the status of the run. |

The token must belong to a user with permission to queue builds on the target pipeline and project, and it must cover the organization set in the service connection. If you don't use a service connection, the pipeline's own token is used instead (`System.AccessToken`), and the project's Build Service identity needs permission to queue builds.

### Canceling the executed pipeline (`cancelOnAbort`)

Canceling needs more than queueing. Some projects forbid `System.AccessToken` from acting on another run, and cancelling then fails with `HTTP 403: Cross-run use of System.AccessToken is not allowed in this project`. The task keeps working (it only logs a warning), but **the executed pipeline keeps running** after a cancel or a wait timeout.

If you need `cancelOnAbort` in such a project, use a service connection or a Personal Access Token (scope **Build: Read & execute**) that is allowed to stop builds on the target pipeline instead of `System.AccessToken`.
