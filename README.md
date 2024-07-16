# Extension to Execute Pipelines in Azure DevOps

This extension allows executing Azure DevOps pipelines from another pipeline and waiting for the executed pipeline to finish. It also allows choosing whether to consume the RUN or QUEUE API.

# Usage and Inputs

<div style="display: flex; justify-content: space-around;">
  <img src="https://i.imgur.com/DtOdXwS.png" alt="inputs" style="width: 45%;">
  <img src="https://i.imgur.com/d0RlVQh.png" alt="inputs2" style="width: 45%;">
</div>

Search for the task called "Exec Pipeline" and the inputs are as follows:

1. **Use Service Connection** (required): Indicates if a service connection will be used to consume the Azure DevOps API. If not, the pipeline execution token will be used.
2. **Azure Devops Path** (optional): If you selected the option to use a service connection, you must select the service connection to be used. Otherwise, this field will not be displayed.
3. **Branch** (required): The branch with which the pipeline will be executed.
4. **Pipeline Id** (required): The ID of the pipeline to be executed.
5. **Execution Type** (required): The type of execution to be performed. If "Run" is selected, the pipeline will run immediately. If "Queue" is selected, the pipeline will be queued. Both options execute the pipeline, but "Queue" allows changing the Run Reason.
6. **Run Reason** (optional/required only in queue): The reason for executing the pipeline. This is only used if the "Execution Type" is "Queue".
7. **Extra Data is Parameter** (optional): Indicates if additional information will be sent to the pipeline to be executed. If "true" (selected), it will be sent as a parameter; if "false", it will be sent as a variable.
8. **Parameters or Variables** (optional): Additional information to be sent to the pipeline to be executed. It is sent in JSON format, for example: {"key1": "value1", "key2": "value2"}.
9. **Just execute** (optional): Indicates if you will wait for the executed pipeline to finish. If "true" (selected), it will wait; if "false", it will not wait.

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
