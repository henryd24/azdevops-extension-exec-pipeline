import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { resolveTarget, organizationFromUri } from "../utils/process_target";
import { processParameters, readParametersFile } from "../utils/process_parameters";
import { resolvePipelineId, cancelRun } from "../utils/api_pipeline_lookup";
import { apiRequest, HttpError } from "../utils/api_client";
import { formatDuration } from "../utils/process_check_pipeline_status";

jest.mock("azure-pipelines-task-lib", () => ({
  setResult: jest.fn(),
  warning: jest.fn(),
  TaskResult: { Succeeded: 0, SucceededWithIssues: 1, Failed: 2 },
}));

const mockFetch = (status: number, body: any, statusText = "") => {
  const fn = jest.fn().mockResolvedValue({
    status,
    statusText,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  });
  (global as any).fetch = fn;
  return fn;
};

describe("resolveTarget", () => {
  const base = {
    useServiceConnection: false,
    collectionUri: "https://dev.azure.com/acme/",
    teamProject: "My Project",
    accessToken: "sys-token",
  };

  it("matches previous behavior without overrides", () => {
    const t = resolveTarget(base);
    expect(t.url).toBe("https://dev.azure.com/acme/My%20Project");
    expect(t.token).toBe("sys-token");
    expect(t.isBearer).toBe(true);
  });

  it("allows another project in the same org with System.AccessToken", () => {
    const t = resolveTarget({ ...base, targetProject: "Other" });
    expect(t.url).toBe("https://dev.azure.com/acme/Other");
    expect(t.isBearer).toBe(true);
  });

  it("treats the same org (case-insensitive) as current", () => {
    const t = resolveTarget({ ...base, targetOrganization: "ACME" });
    expect(t.isBearer).toBe(true);
  });

  it("requires a PAT for another organization", () => {
    expect(() => resolveTarget({ ...base, targetOrganization: "other" })).toThrow(
      /personalAccessToken/
    );
  });

  it("uses the PAT (Basic) for another organization", () => {
    const t = resolveTarget({
      ...base,
      targetOrganization: "other",
      targetProject: "P",
      personalAccessToken: "pat",
    });
    expect(t.url).toBe("https://dev.azure.com/other/P");
    expect(t.isBearer).toBe(false);
    expect(t.token).toBe(Buffer.from("pat:").toString("base64"));
  });

  it("uses the service connection and allows a project override", () => {
    const svc = { organization: "o", project: "p", apitoken: "tok" };
    const t = resolveTarget({ useServiceConnection: true, svc });
    expect(t.url).toBe("https://dev.azure.com/o/p");
    expect(t.isBearer).toBe(false);
    const t2 = resolveTarget({ useServiceConnection: true, svc, targetProject: "q", personalAccessToken: "x" });
    expect(t2.url).toBe("https://dev.azure.com/o/q");
    expect(t2.warnings).toHaveLength(1);
  });

  it("parses organizations from both URL styles", () => {
    expect(organizationFromUri("https://dev.azure.com/acme/")).toBe("acme");
    expect(organizationFromUri("https://acme.visualstudio.com/")).toBe("acme");
  });
});

describe("parameters file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "params-"));
  const write = (name: string, content: string) => {
    fs.writeFileSync(path.join(dir, name), content);
    return name;
  };

  it("reads JSON as-is (quotes inside values are preserved)", () => {
    const f = write("a.json", '{"msg":"it\'s \\"ok\\""}');
    expect(readParametersFile(f, dir)).toEqual({ msg: 'it\'s "ok"' });
  });

  it("rejects missing files, bad JSON and non-objects", () => {
    expect(() => readParametersFile("nope.json", dir)).toThrow(/Cannot read/);
    expect(() => readParametersFile(write("b.json", "{bad"), dir)).toThrow(/not valid JSON/);
    expect(() => readParametersFile(write("c.json", "[1]"), dir)).toThrow(/JSON object/);
  });

  it("inline values override the file and variables get wrapped for run", () => {
    expect(processParameters('{"b":"2"}', false, "run", { a: "1", b: "x" })).toEqual({
      a: { value: "1" },
      b: { value: "2" },
    });
    expect(processParameters("", true, "run", { a: 1 })).toEqual({ a: 1 });
  });

  it("throws on invalid inline JSON instead of triggering the pipeline", () => {
    expect(() => processParameters("{oops", true, "run")).toThrow(/Error parsing parameters/);
  });
});

describe("api_client", () => {
  it("includes Azure DevOps message and a hint", async () => {
    mockFetch(403, { message: "TF401444: nope" }, "Forbidden");
    const err: HttpError = await apiRequest("u", "t", true).catch((e) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(err.message).toContain("TF401444");
    expect(err.hint).toMatch(/Permission denied/);
  });

  it("surfaces YAML validation results instead of the generic message", async () => {
    mockFetch(400, {
      message: "Could not queue the build because there were validation errors or warnings.",
      customProperties: {
        ValidationResults: [{ result: "error", message: "Variable group Negro was not found" }],
      },
    });
    const err: HttpError = await apiRequest("u", "t", true).catch((e) => e);
    expect(err.message).toContain("[error] Variable group Negro was not found");
    expect(err.message).not.toContain("Could not queue");
  });

  it("does not dump HTML and treats 203 as an auth failure", async () => {
    mockFetch(203, "<html>sign in</html>", "Non-Authoritative");
    const err: HttpError = await apiRequest("u", "t", false).catch((e) => e);
    expect(err.detail).toBe("");
    expect(err.hint).toMatch(/Authentication failed/);
  });

  it("sends Basic/Bearer and JSON body", async () => {
    const f = mockFetch(200, { ok: true });
    await apiRequest("u", "tok", false, { method: "POST", body: { a: 1 } });
    const init = f.mock.calls[0][1];
    expect(init.headers.Authorization).toBe("Basic tok");
    expect(init.body).toBe('{"a":1}');
  });
});

describe("resolvePipelineId", () => {
  it("resolves a unique name", async () => {
    const f = mockFetch(200, { value: [{ id: 7, name: "deploy", path: "\\" }] });
    await expect(resolvePipelineId("https://x/o/p", "deploy", "t", true)).resolves.toBe("7");
    expect(f.mock.calls[0][0]).toContain("name=deploy");
  });

  it("filters by folder when the name has one", async () => {
    const f = mockFetch(200, { value: [{ id: 9, name: "deploy", path: "\\team" }] });
    await resolvePipelineId("https://x/o/p", "team/deploy", "t", true);
    expect(f.mock.calls[0][0]).toContain("path=%5Cteam");
  });

  it("fails when not found or ambiguous", async () => {
    mockFetch(200, { value: [] });
    await expect(resolvePipelineId("b", "x", "t", true)).rejects.toThrow(/No pipeline named/);
    mockFetch(200, {
      value: [
        { id: 1, name: "x", path: "\\a" },
        { id: 2, name: "x", path: "\\b" },
      ],
    });
    await expect(resolvePipelineId("b", "x", "t", true)).rejects.toThrow(/More than one/);
  });
});

describe("cancelRun / formatDuration", () => {
  it("PATCHes the build with status cancelling", async () => {
    const f = mockFetch(200, {});
    await cancelRun("https://x/o/p", 42, "t", true);
    expect(f.mock.calls[0][0]).toContain("/builds/42");
    expect(f.mock.calls[0][1].method).toBe("PATCH");
    expect(f.mock.calls[0][1].body).toBe('{"status":"cancelling"}');
  });

  it("formats durations", () => {
    expect(formatDuration(5000)).toBe("5s");
    expect(formatDuration(125000)).toBe("2m 5s");
  });
});
