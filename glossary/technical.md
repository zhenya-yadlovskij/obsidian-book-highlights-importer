| Term | Definition | Use When | Avoid |
| --- | --- | --- | --- |
| Provider Adapter | A built-in module that translates a Reading Provider API or client library into the plugin's provider-neutral contracts. | Referring to Yandex, LitRes, or future integration implementations. | Reading Provider, when referring to integration code rather than the external platform. |
| Managed Section | A marker-delimited region of a Managed Book Note that the plugin may replace during re-import. | Describing generated Markdown ownership and safe updates. | Managed Book Note, which refers to the whole destination file. |
| Provider Credential | Secret configuration used by a Provider Adapter to authenticate with a Reading Provider. | Describing token storage, validation, replacement, or removal. | Plugin settings, which also contain non-secret preferences. |
