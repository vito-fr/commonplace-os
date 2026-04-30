type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type CampaignRole = "primary" | "supporting" | "reference";

export type RightsWarningState = "none" | "advisory" | "blocking";

export type CampaignOption = {
  id: string;
  title: string | null;
  status: string;
  phase: string | null;
  alreadyAttached: boolean;
};

export type CampaignOptionsQuery = {
  workspaceId: string;
  itemId?: string;
};

export type ItemCampaignAttach = {
  workspaceId: string;
  itemId: string;
  campaignId: string;
  role: CampaignRole;
  rightsOverrideNote?: string;
  actor?: string;
};

export type ItemCampaignAttachResult = {
  attachment: {
    id: string;
    workspaceId: string;
    itemId: string;
    campaignId: string;
    role: CampaignRole;
    campaignTitle: string | null;
    phase: string | null;
    rightsWarningState: RightsWarningState;
    createdAt: string;
  };
  events: Array<{
    id: string;
    itemId: string;
    eventType: "campaign_attached";
    createdAt: string;
  }>;
};

export type ItemCampaignClient = {
  listCampaignOptions(query: CampaignOptionsQuery): Promise<CampaignOption[]>;
  attachCampaign(change: ItemCampaignAttach): Promise<ItemCampaignAttachResult>;
};

export type PocketBaseItemCampaignClientOptions = {
  baseUrl: string;
  optionsEndpointPath?: string;
  attachEndpointPath?: string;
  fetcher?: Fetcher;
};

type CampaignOptionsResponse = {
  campaigns: CampaignOption[];
};

export function createPocketBaseItemCampaignClient({
  baseUrl,
  optionsEndpointPath = "/api/vita/campaign-options",
  attachEndpointPath = "/api/vita/item-campaign",
  fetcher = globalThis.fetch,
}: PocketBaseItemCampaignClientOptions): ItemCampaignClient {
  return {
    async listCampaignOptions(query) {
      const response = await fetcher(buildCampaignOptionsUrl(baseUrl, optionsEndpointPath, query), {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`PocketBase campaign options read failed with HTTP ${response.status}`);
      }

      const payload = (await response.json()) as CampaignOptionsResponse;
      if (!Array.isArray(payload.campaigns)) {
        throw new Error("PocketBase campaign options response must include { campaigns }");
      }

      return payload.campaigns;
    },

    async attachCampaign(change) {
      const response = await fetcher(buildCampaignAttachUrl(baseUrl, attachEndpointPath), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspace_id: change.workspaceId,
          item_id: change.itemId,
          campaign_id: change.campaignId,
          role: change.role,
          rights_override_note: change.rightsOverrideNote,
          actor: change.actor,
        }),
      });

      if (!response.ok) {
        throw new Error(`PocketBase campaign attach failed with HTTP ${response.status}`);
      }

      const payload = (await response.json()) as ItemCampaignAttachResult;
      if (!payload.attachment || !Array.isArray(payload.events)) {
        throw new Error("PocketBase campaign attach response must include { attachment, events }");
      }

      return payload;
    },
  };
}

function buildCampaignOptionsUrl(
  baseUrl: string,
  endpointPath: string,
  query: CampaignOptionsQuery,
) {
  const url = new URL(endpointPath, normalizeBaseUrl(baseUrl));
  url.searchParams.set("workspace_id", query.workspaceId);
  if (query.itemId) {
    url.searchParams.set("item_id", query.itemId);
  }
  return url;
}

function buildCampaignAttachUrl(baseUrl: string, endpointPath: string) {
  return new URL(endpointPath, normalizeBaseUrl(baseUrl));
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}
