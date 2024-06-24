interface PipelineLinks {
  self: { href: string };
  web: { href: string };
  "pipeline.web": { href: string };
  pipeline: { href: string };
}

interface TemplateParameters {}

interface Pipeline {
  url: string;
  id: number;
  revision: number;
  name: string;
  folder: string;
}

interface Repository {
  id: string;
  type: string;
}

interface RepositoryResource {
  repository: Repository;
  refName: string;
  version: string;
}

interface Resources {
  repositories: {
    self: RepositoryResource;
  };
}

interface PipelineRun {
  _links: PipelineLinks;
  templateParameters: TemplateParameters;
  pipeline: Pipeline;
  state: string;
  createdDate: string;
  url: string;
  resources: Resources;
  id: number;
  name: string;
}

export { PipelineRun };
