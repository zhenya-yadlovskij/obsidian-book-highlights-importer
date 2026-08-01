import { YandexBookClient } from "yandex-book-api-ts";

const token = process.env.YANDEX_BOOKS_OAUTH_TOKEN?.trim();

if (!token) {
  console.error("YANDEX_BOOKS_OAUTH_TOKEN is required.");
  process.exit(2);
}

const report = async (name, operation) => {
  try {
    const value = await operation();
    const result = { name, ok: true };
    if (Array.isArray(value)) result.count = value.length;
    if (name === "getProfile") result.hasIdentity = Boolean(value?.uuid?.trim());
    console.log(JSON.stringify(result));
    return value;
  } catch (error) {
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

if (!profile?.uuid?.trim()) {
  process.exitCode = 1;
} else {
  await report("getMyLibrary", () => client.getMyLibrary(100, 0));
  await report("getUserQuotes", () => client.getUserQuotes(profile.uuid, 1, 100));
}
