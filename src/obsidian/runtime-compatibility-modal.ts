import { Modal, Notice, Setting, type App, type TextComponent } from "obsidian";

import type { YandexRuntimeHarness, YandexRuntimeResult } from "../compatibility/yandex-runtime";

const resultText = (result: YandexRuntimeResult): string => JSON.stringify(result, null, 2);

export class RuntimeCompatibilityModal extends Modal {
  private credential = "";
  private opened = false;
  private requestGeneration = 0;
  private readonly harness: YandexRuntimeHarness;
  private readonly onClosed: (() => void) | undefined;

  constructor(app: App, harness: YandexRuntimeHarness, onClosed?: () => void) {
    super(app);
    this.harness = harness;
    this.onClosed = onClosed;
  }

  override onOpen(): void {
    this.opened = true;
    this.requestGeneration += 1;
    this.setTitle("Runtime compatibility harness");
    this.contentEl.empty();

    const configuredEl = this.contentEl.createEl("p");
    const updateConfigured = (): void => {
      configuredEl.setText(this.harness.isConfigured() ? "Credential configured" : "Credential not configured");
    };
    updateConfigured();

    let tokenInput: TextComponent;
    new Setting(this.contentEl)
      .setName("Temporary Yandex OAuth token")
      .setDesc("Saved only through Obsidian SecretStorage. The value is never displayed again.")
      .addText((text) => {
        tokenInput = text;
        text.inputEl.type = "password";
        text.setPlaceholder("Paste token").onChange((value) => {
          this.credential = value;
        });
      });

    new Setting(this.contentEl)
      .setName("Credential actions")
      .addButton((button) => button
        .setButtonText("Save or replace")
        .setCta()
        .onClick(() => {
          if (this.credential.trim() === "") {
            new Notice("Enter a token before saving.");
            return;
          }
          this.harness.saveCredential(this.credential);
          this.credential = "";
          tokenInput.setValue("");
          updateConfigured();
          new Notice("Credential saved to SecretStorage.");
        }))
      .addButton((button) => button
        .setButtonText("Clear")
        .onClick(() => {
          this.harness.clearCredential();
          this.credential = "";
          tokenInput.setValue("");
          updateConfigured();
          new Notice("Credential cleared with an empty SecretStorage value.");
        }));

    const resultEl = this.contentEl.createEl("pre", { text: "No compatibility check run yet." });
    new Setting(this.contentEl)
      .setName("Package compatibility")
      .setDesc("Calls profile, library, and account quotes and reports only sanitized counts and status data.")
      .addButton((button) => button
        .setButtonText("Run check")
        .onClick(async () => {
          const requestGeneration = ++this.requestGeneration;
          button.setDisabled(true);
          resultEl.setText("Running compatibility check...");
          try {
            const result = await this.harness.run();
            if (!this.opened || this.requestGeneration !== requestGeneration) return;
            resultEl.setText(resultText(result));
            new Notice(result.ok ? "Compatibility check completed." : `Compatibility check failed at ${result.stage}.`);
          } finally {
            if (this.opened && this.requestGeneration === requestGeneration) button.setDisabled(false);
          }
        }));
  }

  override onClose(): void {
    this.opened = false;
    this.requestGeneration += 1;
    this.credential = "";
    this.contentEl.empty();
    this.onClosed?.();
  }
}
