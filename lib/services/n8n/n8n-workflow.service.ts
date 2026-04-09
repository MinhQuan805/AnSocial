import type { N8nExportInput } from "@/lib/core/domain";

export class N8nWorkflowService {
  public createWorkflow(input: N8nExportInput): Record<string, unknown> {
    const generatedAt = new Date().toISOString();

    return {
      name: `IG Insight Flow ${generatedAt}`,
      active: false,
      settings: {
        executionOrder: "v1",
      },
      tags: ["ana-social", "facebook", "notion", "marketing-insight"],
      nodes: [
        {
          id: "1",
          name: "Manual Trigger",
          type: "n8n-nodes-base.manualTrigger",
          typeVersion: 1,
          position: [120, 260],
          parameters: {},
        },
        {
          id: "2",
          name: "Fetch Graph Insights",
          type: "n8n-nodes-base.httpRequest",
          typeVersion: 4.2,
          position: [400, 260],
          parameters: {
            method: "GET",
            url: input.graphUrl,
            authentication: "predefinedCredentialType",
            nodeCredentialType: "facebookGraphApi",
            sendQuery: false,
          },
          credentials: {
            facebookGraphApi: {
              name: "facebookGraphApi",
            },
          },
        },
        {
          id: "3",
          name: "Transform for Notion",
          type: "n8n-nodes-base.code",
          typeVersion: 2,
          position: [680, 260],
          parameters: {
            mode: "runOnceForAllItems",
            language: "javaScript",
            jsCode:
              "const rows = $input.first().json?.data ?? [];\nreturn [{ json: {\n  generatedAt: new Date().toISOString(),\n  period: \"" +
              input.period +
              "\",\n  rangeDays: " +
              input.rangeDays +
              ",\n  metrics: \"" +
              input.metrics.join(",") +
              "\",\n  rowCount: rows.length,\n  payload: JSON.stringify(rows).slice(0, 1800)\n} }];",
          },
        },
        {
          id: "4",
          name: "Write to Notion",
          type: "n8n-nodes-base.notion",
          typeVersion: 2,
          position: [980, 260],
          parameters: {
            resource: "databasePage",
            operation: "create",
            databaseId: input.pageId,
            propertiesUi: {
              propertyValues: [
                {
                  key: "Name|title",
                  titleValue: "IG Insight {{$json.generatedAt}}",
                },
                {
                  key: "Summary|rich_text",
                  richTextValue: "Metrics: {{$json.metrics}} | Rows: {{$json.rowCount}}",
                },
              ],
            },
          },
          credentials: {
            notionApi: {
              name: "notionApi",
            },
          },
        },
      ],
      connections: {
        "Manual Trigger": {
          main: [[{ node: "Fetch Graph Insights", type: "main", index: 0 }]],
        },
        "Fetch Graph Insights": {
          main: [[{ node: "Transform for Notion", type: "main", index: 0 }]],
        },
        "Transform for Notion": {
          main: [[{ node: "Write to Notion", type: "main", index: 0 }]],
        },
      },
      pinData: {},
      staticData: null,
      versionId: "1",
    };
  }
}
