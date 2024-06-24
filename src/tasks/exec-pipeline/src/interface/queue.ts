interface BuildLinks {
  self: { href: string };
  web: { href: string };
  sourceVersionDisplayUri: { href: string };
  timeline: { href: string };
  badge: { href: string };
}

interface BuildProperties {}

interface Plan {
  planId: string;
}

interface TriggerInfo {}

interface Project {
  id: string;
  name: string;
  url: string;
  state: string;
  revision: number;
  visibility: string;
  lastUpdateTime: string;
}

interface Definition {
  drafts: any[];
  id: number;
  name: string;
  url: string;
  uri: string;
  path: string;
  type: string;
  queueStatus: string;
  revision: number;
  project: Project;
}

interface QueuePool {
  id: number;
  name: string;
  isHosted: boolean;
}

interface Queue {
  id: number;
  name: string;
  pool: QueuePool;
}

interface RequestedUser {
  displayName: string;
  url: string;
  _links: {
    avatar: {
      href: string;
    };
  };
  id: string;
  uniqueName: string;
  imageUrl: string;
  descriptor: string;
}

interface OrchestrationPlan {
  planId: string;
}

interface Logs {
  id: number;
  type: string;
  url: string;
}

interface Repository {
  id: string;
  type: string;
  name: string;
  url: string;
  clean: boolean | null;
  checkoutSubmodules: boolean;
}

interface Build {
  _links: BuildLinks;
  properties: BuildProperties;
  tags: any[];
  validationResults: any[];
  plans: Plan[];
  triggerInfo: TriggerInfo;
  id: number;
  buildNumber: string;
  status: string;
  queueTime: string;
  url: string;
  definition: Definition;
  buildNumberRevision: number;
  project: Project;
  uri: string;
  sourceBranch: string;
  sourceVersion: string;
  queue: Queue;
  priority: string;
  reason: string;
  requestedFor: RequestedUser;
  requestedBy: RequestedUser;
  lastChangedDate: string;
  lastChangedBy: RequestedUser;
  orchestrationPlan: OrchestrationPlan;
  logs: Logs;
  repository: Repository;
  retainedByRelease: boolean;
  triggeredByBuild: null | any;
  appendCommitMessageToRunName: boolean;
}

export { Build };
