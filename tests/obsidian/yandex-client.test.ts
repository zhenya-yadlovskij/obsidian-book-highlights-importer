import { expect, it, vi } from "vitest";

const { constructorArguments } = vi.hoisted(() => ({
  constructorArguments: [] as unknown[][],
}));

vi.mock("yandex-book-api-ts", () => ({
  YandexBookClient: function YandexBookClient(...args: unknown[]): object {
    constructorArguments.push(args);
    return {};
  },
}));

import { createObsidianYandexClient } from "../../src/obsidian/yandex-client";

it("constructs the Yandex client with an Obsidian requestUrl transport", () => {
  const requestUrl = vi.fn();

  createObsidianYandexClient("credential", requestUrl);

  expect(constructorArguments).toHaveLength(1);
  expect(constructorArguments[0]?.[0]).toBe("credential");
  expect(typeof constructorArguments[0]?.[1]).toBe("function");
});
