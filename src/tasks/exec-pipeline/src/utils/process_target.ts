export interface TargetInput {
  useServiceConnection: boolean;
  /** Values read from the service connection (when used) */
  svc?: { organization: string; project: string; apitoken: string };
  /** Predefined variables of the running pipeline */
  collectionUri?: string;
  teamProject?: string;
  accessToken?: string;
  /** Optional task inputs */
  targetOrganization?: string;
  targetProject?: string;
  personalAccessToken?: string;
}

export interface Target {
  /** https://dev.azure.com/{org}/{project} (no trailing slash) */
  url: string;
  token: string;
  isBearer: boolean;
  organization: string;
  project: string;
  warnings: string[];
}

const basic = (pat: string) => Buffer.from(`${pat}:`).toString("base64");

/** "https://dev.azure.com/org/" or "https://org.visualstudio.com/" -> "org" */
export function organizationFromUri(uri: string): string {
  const url = new URL(uri);
  if (url.hostname.endsWith(".visualstudio.com")) {
    return url.hostname.split(".")[0];
  }
  return url.pathname.split("/").filter(Boolean)[0] ?? "";
}

/**
 * Decide which organization/project/credentials the task talks to.
 * With no overrides it behaves exactly like previous versions.
 * @throws Error on impossible combinations (e.g. other org without a PAT)
 */
export function resolveTarget(input: TargetInput): Target {
  const warnings: string[] = [];
  const orgOverride = input.targetOrganization?.trim() || "";
  const projectOverride = input.targetProject?.trim() || "";
  const pat = input.personalAccessToken?.trim() || "";

  if (input.useServiceConnection) {
    const svc = input.svc!;
    if (pat) {
      warnings.push(
        "personalAccessToken is ignored because a service connection is used."
      );
    }
    const organization = orgOverride || svc.organization;
    const project = projectOverride || svc.project;
    return {
      url: `https://dev.azure.com/${organization}/${encodeURIComponent(project)}`,
      token: basic(svc.apitoken),
      isBearer: false,
      organization,
      project,
      warnings,
    };
  }

  const collectionUri = (input.collectionUri ?? "").replace(/\/+$/, "");
  const currentOrg = organizationFromUri(`${collectionUri}/`);
  const project = projectOverride || input.teamProject || "";
  const sameOrg = !orgOverride || orgOverride.toLowerCase() === currentOrg.toLowerCase();

  if (!sameOrg && !pat) {
    throw new Error(
      `The target organization "${orgOverride}" differs from the current one ("${currentOrg}"). ` +
        `System.AccessToken only works inside the current organization: provide personalAccessToken ` +
        `(e.g. $(mySecretPat)) or use a service connection.`
    );
  }

  const organization = sameOrg ? currentOrg : orgOverride;
  const base = sameOrg ? collectionUri : `https://dev.azure.com/${orgOverride}`;
  return {
    url: `${base}/${encodeURIComponent(project)}`,
    token: pat ? basic(pat) : input.accessToken!,
    isBearer: !pat,
    organization,
    project,
    warnings,
  };
}
