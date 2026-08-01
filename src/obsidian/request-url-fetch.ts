import type { RequestUrlParam, RequestUrlResponse } from "obsidian";

export type RequestUrlCaller = (request: RequestUrlParam | string) => Promise<RequestUrlResponse>;

export const createObsidianFetch = (requestUrl: RequestUrlCaller): typeof fetch =>
  async (input, init): Promise<Response> => {
    const request = new Request(input, init);
    if (request.signal.aborted) throw request.signal.reason;
    const body = request.body === null ? undefined : await request.arrayBuffer();
    const response = await requestUrl({
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      ...(body === undefined ? {} : { body }),
      throw: false,
    });
    const responseBody = response.status === 204 || response.status === 205 || response.status === 304
      ? null
      : response.arrayBuffer;
    return new Response(responseBody, {
      headers: response.headers,
      status: response.status,
    });
  };
