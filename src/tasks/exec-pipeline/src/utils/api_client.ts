/**
 * Error thrown when the Azure DevOps API answers with an unexpected status.
 * Carries the message sent by Azure DevOps (when any) and a human hint.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    statusText: string,
    public readonly detail: string = ""
  ) {
    super(`HTTP ${status}: ${statusText}${detail ? ` - ${detail}` : ""}`);
    this.name = "HttpError";
  }

  /** Actionable suggestion for the most common failures */
  get hint(): string {
    switch (this.status) {
      case 203:
      case 401:
        return "Authentication failed. Check the service connection / personal access token (it may be invalid or expired).";
      case 403:
        return "Permission denied. The identity needs permission to view and queue builds on the target pipeline (if you use System.AccessToken on another project, grant access to the Build Service identity there).";
      case 404:
        return "Not found. Check the organization, project and pipeline ID/name, and that the pipeline is visible to the identity.";
      case 400:
        return "Bad request. Read the validation messages above first (e.g. YAML errors, variable groups or service connections not found/authorized). Otherwise check the branch, parameters/variables (they must be settable at queue time) and, for queue, the reason.";
      default:
        return "";
    }
  }
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
}

/**
 * Perform a JSON request against the Azure DevOps API.
 * @throws HttpError when the response status is not 200
 */
export async function apiRequest<T = Record<string, any>>(
  url: string,
  token: string,
  isBearer: boolean,
  options: RequestOptions = {}
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: isBearer ? `Bearer ${token}` : `Basic ${token}`,
  };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (res.status !== 200) {
    throw new HttpError(res.status, res.statusText, await readErrorDetail(res));
  }
  return res.json() as Promise<T>;
}

/** Validation errors/warnings of a rejected queue request (YAML load errors, etc.) */
function validationMessages(body: any): string[] {
  const results = [
    ...(body?.customProperties?.ValidationResults ?? []),
    ...(body?.validationResults ?? []),
  ];
  return results
    .filter((r: any) => r?.message)
    .map((r: any) => `[${r.result ?? "error"}] ${r.message}`);
}

async function readErrorDetail(res: Response): Promise<string> {
  try {
    const text = await res.text();
    try {
      const body = JSON.parse(text);
      const details = validationMessages(body);
      // The generic message adds nothing once we have the real reasons
      return details.length ? details.join(" | ") : body.message ?? "";
    } catch {
      // Azure DevOps answers HTML on auth failures: do not dump it in the log
      return text.trimStart().startsWith("<") ? "" : text.slice(0, 300);
    }
  } catch {
    return "";
  }
}
