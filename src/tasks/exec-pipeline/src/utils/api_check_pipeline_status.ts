import { apiRequest } from "./api_client";

export { HttpError } from "./api_client";

/**
 * Function to get a pipeline execution
 * @param url URL to get a pipeline execution
 * @param token Token to authenticate
 * @param isBearer Boolean to know if the token is a bearer token
 * @returns Pipeline execution object (Json)
 * @throws HttpError when the response status is not 200
 */
export async function getPipelineExecution(
  url: string,
  token: string,
  isBearer: boolean
): Promise<Record<string, any>> {
  return apiRequest(url, token, isBearer);
}
