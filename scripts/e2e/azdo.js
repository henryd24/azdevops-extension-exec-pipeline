// Independent checks of a pipeline run through the Azure DevOps Builds API (does not use the task code).
// Uses the agent's predefined variables and SYSTEM_ACCESSTOKEN (map it in the step's env).
//
//   node scripts/e2e/azdo.js build <buildId> [--status completed] [--result succeeded]
//                                  [--param key=value] [--var key=value]
//   node scripts/e2e/azdo.js wait  <buildId> --result <result> [--timeout <seconds>] [--param ...] [--var ...]
//
// `build` checks the current state once; `wait` polls until the build is completed (or the timeout is
// reached) and then runs the same checks.
const collectionUri = (process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI || "").replace(/\/+$/, "");
const project = process.env.SYSTEM_TEAMPROJECT;
const token = process.env.SYSTEM_ACCESSTOKEN;
if (!collectionUri || !project || !token) {
  console.error("SYSTEM_TEAMFOUNDATIONCOLLECTIONURI, SYSTEM_TEAMPROJECT and SYSTEM_ACCESSTOKEN must be set.");
  process.exit(2);
}

const [command, buildId, ...rest] = process.argv.slice(2);
const options = (name) => rest.flatMap((value, i) => (value === name ? [rest[i + 1]] : []));
const option = (name) => options(name)[0];

async function getBuild() {
  const url = `${collectionUri}/${encodeURIComponent(project)}/_apis/build/builds/${buildId}?api-version=7.1`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error(`GET build ${buildId} -> ${response.status} ${(await response.text()).slice(0, 200)}`);
  return response.json();
}

const errors = [];
const expect = (ok, message) => {
  console.log(`${ok ? "OK  " : "FAIL"} ${message}`);
  if (!ok) errors.push(message);
};

function check(build) {
  console.log(`Build ${build.id}: status=${build.status} result=${build.result} definition=${build.definition?.name} branch=${build.sourceBranch}`);
  const status = option("--status");
  if (status) expect(build.status === status, `status is ${status} (found ${build.status})`);
  const result = option("--result");
  if (result) expect(build.result === result, `result is ${result} (found ${build.result})`);

  for (const pair of options("--param")) {
    const [key, ...value] = pair.split("=");
    const actual = build.templateParameters?.[key];
    expect(actual === value.join("="), `template parameter ${key} = ${value.join("=")} (found ${actual})`);
  }
  if (options("--var").length) {
    let variables = {};
    try {
      variables = JSON.parse(build.parameters || "{}");
    } catch {
      /* leave empty */
    }
    for (const pair of options("--var")) {
      const [key, ...value] = pair.split("=");
      expect(variables[key] === value.join("="), `variable ${key} = ${value.join("=")} (found ${variables[key]})`);
    }
  }
}

(async () => {
  if (!buildId) throw new Error("Missing build id");
  if (command === "build") {
    check(await getBuild());
  } else if (command === "wait") {
    const deadline = Date.now() + Number(option("--timeout") ?? 300) * 1000;
    let build = await getBuild();
    while (build.status !== "completed" && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      build = await getBuild();
    }
    check(build);
  } else {
    throw new Error(`Unknown command '${command}'`);
  }
  if (errors.length) process.exit(1);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
