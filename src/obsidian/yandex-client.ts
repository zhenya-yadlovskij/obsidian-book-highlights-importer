import { YandexBookClient } from "yandex-book-api-ts";

import { createObsidianFetch, type RequestUrlCaller } from "./request-url-fetch";

export const createObsidianYandexClient = (
  credential: string,
  requestUrl: RequestUrlCaller,
): YandexBookClient => new YandexBookClient(credential, createObsidianFetch(requestUrl));
