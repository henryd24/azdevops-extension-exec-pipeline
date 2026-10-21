// Runs the bundled task (tasks/exec-pipeline/index.js) the way an Azure Pipelines agent would:
// inputs are passed as INPUT_<NAME> variables. The agent already provides the predefined variables
// (SYSTEM_TEAMFOUNDATIONCOLLECTIONURI, SYSTEM_TEAMPROJECT); SYSTEM_ACCESSTOKEN must be mapped
// explicitly in the step: env: { SYSTEM_ACCESSTOKEN: $(System.AccessToken) }.
// The agent interprets the ##vso commands the task prints, so output variables are checked as in
// a real pipeline.
//
// Usage: node scripts/e2e/run-task.js [--expect-failure] [input=value ...]
// Exits 1 when the task finishes with result=Failed (or with 0 if --expect-failure is set and it did).
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const args = process.argv.slice(2);
const expectFailure = args[0] === "--expect-failure";
const pairs = expectFailure ? args.slice(1) : args;

const bundle = path.resolve(process.env.TASK_DIR || path.join(__dirname, "..", "..", "tasks", "exec-pipeline"), "index.js");
if (!fs.existsSync(bundle)) {
  console.error(`${bundle} does not exist. Run first: npm run package:tasks`);
  process.exit(2);
}

const env = { ...process.env };

// The agent fills inputs that were not set with the defaultValue of task.json; do the same.
const manifestPath = path.join(__dirname, "..", "..", "src", "tasks", "exec-pipeline", "task.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
for (const input of manifest.inputs ?? []) {
  if (input.defaultValue !== undefined && input.defaultValue !== "") {
    env[`INPUT_${input.name.toUpperCase().replace(/ /g, "_")}`] = String(input.defaultValue);
  }
}

for (const pair of pairs) {
  const idx = pair.indexOf("=");
  if (idx <= 0) throw new Error(`Invalid input '${pair}'. Expected format: name=value`);
  env[`INPUT_${pair.slice(0, idx).toUpperCase().replace(/ /g, "_")}`] = pair.slice(idx + 1);
}

const base = path.join(os.tmpdir(), "exec-pipeline-e2e-agent");
env.AGENT_TEMPDIRECTORY ??= path.join(base, "temp");
env.AGENT_WORKFOLDER ??= path.join(base, "work");
for (const dir of [env.AGENT_TEMPDIRECTORY, env.AGENT_WORKFOLDER]) fs.mkdirSync(dir, { recursive: true });

let failed = false;
const child = spawn(process.execPath, [bundle], { env, stdio: ["inherit", "pipe", "inherit"] });
// The agent marks a step as failed when it sees task.complete/task.issue errors, whatever the exit
// code of this script. With --expect-failure those lines are printed as plain text instead, so the
// step only fails if the task did NOT fail. Everything else (output variables) still reaches the agent.
const rl = require("node:readline").createInterface({ input: child.stdout, crlfDelay: Infinity });
rl.on("line", (line) => {
  if (/##vso\[task\.complete [^\]]*result=Failed/.test(line)) failed = true;
  if (expectFailure) {
    if (/##vso\[task\.complete /.test(line)) return console.log(line.replace(/^##vso\[task\.complete [^\]]*\]/, "(expected failure) "));
    if (/##vso\[task\.issue type=error/.test(line)) return console.log(line.replace(/^##vso\[task\.issue [^\]]*\]/, "(expected error) "));
  }
  console.log(line);
});
child.on("close", (code) => {
  failed = failed || code !== 0;
  if (expectFailure) {
    if (!failed) console.error("Expected the task to fail, but it succeeded.");
    process.exit(failed ? 0 : 1);
  }
  process.exit(failed ? 1 : 0);
});
