import { YandexBookClient } from "yandex-book-api-ts";

const token = process.env.YANDEX_BOOKS_OAUTH_TOKEN?.trim();
let failed = false;

if (!token) {
  console.error("YANDEX_BOOKS_OAUTH_TOKEN is required.");
  process.exit(2);
}

const report = async (name, operation) => {
  try {
    const value = await operation();
    const result = { name, ok: true };
    if (Array.isArray(value)) result.count = value.length;
    if (name === "getProfile") result.hasIdentity = Boolean(value?.login?.trim());
    console.log(JSON.stringify(result));
    return value;
  } catch (error) {
    failed = true;
    console.log(JSON.stringify({
      name,
      ok: false,
      errorType: error?.constructor?.name ?? "unknown",
      ...(typeof error?.status === "number" ? { status: error.status } : {}),
    }));
    return undefined;
  }
};

const client = new YandexBookClient(token);
const profile = await report("getProfile", () => client.getProfile());

if (!profile?.login?.trim()) {
  failed = true;
} else {
  await report("getMyLibrary", () => client.getMyLibrary(100, 0));
  await report("getUserQuotes", () => client.getUserQuotes(profile.login, 1, 100));
}

if (failed) process.exitCode = 1;
