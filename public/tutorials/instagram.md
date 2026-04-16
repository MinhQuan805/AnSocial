# Instagram Request Builder Tutorial

## 1) Connect integrations

1. Connect Notion workspace.
2. Connect Facebook Business.
3. Select an Instagram account from the account selector.

## 2) Build request

- Endpoint: choose one of `Account Insights`, `Account Media`, or `Tagged Media`.
- Metrics: select one or multiple metrics.
- Period and Date Range: set the analysis time window.
- Breakdown: optional dimension breakdown.

## 3) Run analysis

1. Click **Run**.
2. Inspect table output and recommendation tab.
3. Use **Raw JSON** tab when you need full payload.

## 4) Save to Notion

- Choose one or many Notion pages in `Notion Pages`.
- Enable **Save to Notion simultaneously**.
- Click **Save Data**.

## 5) Export n8n workflow

- Click **Export n8n JSON**.
- Import the JSON to n8n.
- If Auto Schedule is enabled, workflow trigger is generated automatically.

## Notes

- Access tokens are encrypted at rest.
- If token is expired, reconnect integration to refresh credentials.
