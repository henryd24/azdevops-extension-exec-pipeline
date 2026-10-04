import { normalizeBranch, parseNumberInput } from "../utils/process_options";
import { processParameters } from "../utils/process_parameters";
import { processCheckPipelineStatus } from "../utils/process_check_pipeline_status";
import * as api from "../utils/api_check_pipeline_status";
import * as tl from "azure-pipelines-task-lib";

jest.mock("azure-pipelines-task-lib", () => ({
  setResult: jest.fn(),
  warning: jest.fn(),
  TaskResult: { Succeeded: 0, SucceededWithIssues: 1, Failed: 2 },
}));

describe("normalizeBranch", () => {
  it("prefixes plain branch names", () => {
    expect(normalizeBranch("main")).toBe("refs/heads/main");
  });
  it("keeps full refs untouched", () => {
    expect(normalizeBranch("refs/heads/main")).toBe("refs/heads/main");
    expect(normalizeBranch("refs/tags/v1")).toBe("refs/tags/v1");
  });
});

describe("parseNumberInput", () => {
  it("falls back when empty, invalid or out of range", () => {
    expect(parseNumberInput("x", "", 10, 5, 300)).toBe(10);
    expect(parseNumberInput("x", "abc", 10, 5, 300)).toBe(10);
    expect(parseNumberInput("x", "1", 10, 5, 300)).toBe(10);
  });
  it("accepts valid values", () => {
    expect(parseNumberInput("x", "30", 10, 5, 300)).toBe(30);
  });
});

describe("processParameters", () => {
  it("wraps variables for the run API", () => {
    expect(processParameters("{'a':'b'}", false, "run")).toEqual({
      a: { value: "b" },
    });
  });
  it("keeps parameters as they are", () => {
    expect(processParameters('{"a":"b"}', true, "run")).toEqual({ a: "b" });
  });
});

describe("processCheckPipelineStatus", () => {
  const sleep = jest.fn().mockResolvedValue(undefined);
  const opts = { intervalMs: 1, sleep };
  let spy: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    spy = jest.spyOn(api, "getPipelineExecution");
    jest.spyOn(console, "log").mockImplementation();
    jest.spyOn(console, "warn").mockImplementation();
    jest.spyOn(console, "error").mockImplementation();
  });

  it("waits while inProgress and succeeds", async () => {
    spy
      .mockResolvedValueOnce({ status: "inProgress" })
      .mockResolvedValueOnce({ status: "completed", result: "succeeded" });
    await expect(processCheckPipelineStatus("u", "t", true, opts)).resolves.toBe("succeeded");
    expect(tl.setResult).toHaveBeenCalledWith(tl.TaskResult.Succeeded, expect.any(String));
  });

  it("supports the run API (state instead of status)", async () => {
    spy.mockResolvedValueOnce({ state: "completed", result: "failed" });
    await expect(processCheckPipelineStatus("u", "t", true, opts)).resolves.toBe("failed");
    expect(tl.setResult).toHaveBeenCalledWith(tl.TaskResult.Failed, expect.any(String));
  });

  it("maps partiallySucceeded to SucceededWithIssues", async () => {
    spy.mockResolvedValueOnce({ status: "completed", result: "partiallySucceeded" });
    await processCheckPipelineStatus("u", "t", true, opts);
    expect(tl.setResult).toHaveBeenCalledWith(tl.TaskResult.SucceededWithIssues, expect.any(String));
  });

  it("retries transient errors", async () => {
    spy
      .mockRejectedValueOnce(new api.HttpError(503, "Unavailable"))
      .mockResolvedValueOnce({ status: "completed", result: "succeeded" });
    await expect(processCheckPipelineStatus("u", "t", true, opts)).resolves.toBe("succeeded");
  });

  it("fails after too many transient errors", async () => {
    spy.mockRejectedValue(new api.HttpError(500, "boom"));
    await expect(processCheckPipelineStatus("u", "t", true, opts)).resolves.toBe("error");
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("fails immediately on 4xx", async () => {
    spy.mockRejectedValue(new api.HttpError(401, "Unauthorized"));
    await expect(processCheckPipelineStatus("u", "t", true, opts)).resolves.toBe("error");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("times out", async () => {
    spy.mockResolvedValue({ status: "inProgress" });
    await expect(
      processCheckPipelineStatus("u", "t", true, { ...opts, timeoutMs: 1 })
    ).resolves.toBe("timeout");
    expect(tl.setResult).toHaveBeenCalledWith(tl.TaskResult.Failed, expect.stringContaining("Timed out"));
  });
});
