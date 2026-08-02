import { YANDEX_TOKEN_SECRET_ID } from "../compatibility/yandex-runtime";
import type { CredentialStorePort } from "../core/ports";

interface SecretStorageHost {
  readonly getSecret: (id: string) => string | null;
  readonly setSecret: (id: string, secret: string) => void;
}

const PROVIDER_SECRET_IDS: Readonly<Record<string, string>> = Object.freeze({
  "yandex-books": YANDEX_TOKEN_SECRET_ID,
});

const secretIdFor = (providerId: string): string => {
  const secretId = PROVIDER_SECRET_IDS[providerId];
  if (secretId === undefined) {
    throw new Error(`No credential secret is registered for provider ${providerId}`);
  }
  return secretId;
};

export const createObsidianCredentialStore = (storage: SecretStorageHost): CredentialStorePort => ({
  get: (providerId): string | null => {
    const credential = storage.getSecret(secretIdFor(providerId))?.trim();
    return credential === undefined || credential === "" ? null : credential;
  },
  set: (providerId, credential): void => {
    storage.setSecret(secretIdFor(providerId), credential.trim());
  },
  clear: (providerId): void => {
    storage.setSecret(secretIdFor(providerId), "");
  },
});
