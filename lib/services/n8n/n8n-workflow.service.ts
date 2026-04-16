import type { N8nExportInput } from "@/lib/core/domain";

export class N8nWorkflowService {
  public createWorkflow(input: N8nExportInput): Record<string, unknown> {
    const generatedAt = new Date().toISOString();
    const scheduleFrequency = input.autoSchedule?.frequency ?? "daily";
    const scheduleTime = input.autoSchedule?.time ?? "09:00";
    const triggerNode = input.autoSchedule?.enabled
      ? {
          id: "1",
          name: "Schedule Trigger",
          type: "n8n-nodes-base.cron",
          typeVersion: 1,
          position: [120, 260],
          parameters: {
            triggerTimes: {
              item: [
                {
                  mode: "custom",
                  cronExpression: this.buildCronExpression(
                    scheduleFrequency,
                    scheduleTime,
                  ),
                },
              ],
            },
          },
        }
      : {
          id: "1",
          name: "Manual Trigger",
          type: "n8n-nodes-base.manualTrigger",
          typeVersion: 1,
          position: [120, 260],
          parameters: {},
        };

    const triggerNodeName = triggerNode.name;

    return {
      name: `IG Insight Flow ${generatedAt}`,
      active: false,
      settings: {
        executionOrder: "v1",
      },
      tags: ["ana-social", "facebook", "notion", "marketing-insight"],
      nodes: [
        triggerNode,
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
              JSON.stringify(input.rangeDays) +
              ",\n  metrics: \"" +
              input.metrics.join(",") +
              "\",\n  rowCount: rows.length,\n  targetPageIds: " +
              JSON.stringify(input.pageIds) +
              ",\n  payload: JSON.stringify(rows).slice(0, 1800)\n} }];",
          },
        },
        {
          id: "4",
          name: "Expand Target Pages",
          type: "n8n-nodes-base.code",
          typeVersion: 2,
          position: [920, 260],
          parameters: {
            mode: "runOnceForAllItems",
            language: "javaScript",
            jsCode:
              "const base = $input.first().json ?? {};\nconst pageIds = Array.isArray(base.targetPageIds) ? base.targetPageIds : [];\nreturn pageIds.map((pageId) => ({ json: { ...base, pageId } }));",
          },
        },
        {
          id: "5",
          name: "Write to Notion",
          type: "n8n-nodes-base.notion",
          typeVersion: 2,
          position: [1160, 260],
          parameters: {
            resource: "databasePage",
            operation: "create",
            databaseId: "={{$json.pageId}}",
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
        [triggerNodeName]: {
          main: [[{ node: "Fetch Graph Insights", type: "main", index: 0 }]],
        },
        "Fetch Graph Insights": {
          main: [[{ node: "Transform for Notion", type: "main", index: 0 }]],
        },
        "Transform for Notion": {
          main: [[{ node: "Expand Target Pages", type: "main", index: 0 }]],
        },
        "Expand Target Pages": {
          main: [[{ node: "Write to Notion", type: "main", index: 0 }]],
        },
      },
      pinData: {},
      staticData: null,
      versionId: "1",
    };
  }

  private buildCronExpression(
    frequency: "daily" | "weekly" | "monthly",
    time: string,
  ): string {
    const [hourRaw, minuteRaw] = time.split(":");
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);

    const safeHour = Number.isFinite(hour) ? Math.min(23, Math.max(0, hour)) : 9;
    const safeMinute = Number.isFinite(minute) ? Math.min(59, Math.max(0, minute)) : 0;

    if (frequency === "weekly") {
      return `${safeMinute} ${safeHour} * * 1`;
    }

    if (frequency === "monthly") {
      return `${safeMinute} ${safeHour} 1 * *`;
    }

    return `${safeMinute} ${safeHour} * * *`;
  }
}
