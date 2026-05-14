const arenaDefaultBaseUrl = "https://api.are.na/v3";
const arenaDefaultPerPage = 100;
const arenaDefaultSort = "position_desc";
const arenaMaxRetries = 3;
const arenaUserAgent = "CommonplaceOS/0.1 (+https://localhost)";

function createArenaApiClient(options) {
  const config = options || {};
  const baseUrl = normalizeBaseUrl(config.baseUrl || arenaDefaultBaseUrl);
  const apiKey = stringValue(config.apiKey);
  const send = config.send || defaultPocketBaseSend;
  const sleeper = config.sleep || defaultSleep;
  const maxRetries = Number.isInteger(config.maxRetries) ? Math.max(0, config.maxRetries) : arenaMaxRetries;

  return {
    getChannel(idOrSlug) {
      return requestJson({
        baseUrl,
        path: "/channels/" + encodeURIComponent(requiredString(idOrSlug, "channel")),
        apiKey,
        send,
        sleeper,
        maxRetries,
      });
    },

    getChannelContentsPage(idOrSlug, pageOptions) {
      const pagination = pageOptions || {};
      const page = positiveInteger(pagination.page, 1);
      const per = clampPositiveInteger(pagination.per, arenaDefaultPerPage, 1, arenaDefaultPerPage);
      const sort = stringValue(pagination.sort) || arenaDefaultSort;
      const query = queryString({
        page,
        per,
        sort,
      });

      return requestJson({
        baseUrl,
        path: "/channels/" + encodeURIComponent(requiredString(idOrSlug, "channel")) + "/contents" + query,
        apiKey,
        send,
        sleeper,
        maxRetries,
      });
    },

    getChannelContents(idOrSlug, pageOptions) {
      const pagination = pageOptions || {};
      const per = clampPositiveInteger(pagination.per, arenaDefaultPerPage, 1, arenaDefaultPerPage);
      const sort = stringValue(pagination.sort) || arenaDefaultSort;
      const contents = [];
      let page = positiveInteger(pagination.page, 1);

      for (;;) {
        const response = this.getChannelContentsPage(idOrSlug, { page, per, sort });
        const rows = Array.isArray(response.data) ? response.data : [];
        for (let index = 0; index < rows.length; index += 1) {
          contents.push(rows[index]);
        }

        const meta = response.meta || {};
        if (!meta.has_more_pages || !meta.next_page) {
          break;
        }

        page = positiveInteger(meta.next_page, page + 1);
      }

      return contents;
    },
  };
}

function requestJson({ apiKey, baseUrl, maxRetries, path, send, sleeper }) {
  const url = baseUrl + path;
  let attempt = 0;

  for (;;) {
    const response = send({
      method: "GET",
      url,
      timeout: 30,
      headers: arenaHeaders(apiKey),
    });

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return parseResponseJson(response);
    }

    const retryable = response.statusCode === 429 || response.statusCode === 408 || response.statusCode >= 500;
    if (!retryable || attempt >= maxRetries) {
      throw arenaHttpError(response, url);
    }

    sleeper(retryDelayMs(response, attempt));
    attempt += 1;
  }
}

function arenaHeaders(apiKey) {
  const headers = {
    Accept: "application/json",
    "User-Agent": arenaUserAgent,
  };

  if (apiKey) {
    headers.Authorization = "Bearer " + apiKey;
  }

  return headers;
}

function retryDelayMs(response, attempt) {
  const retryAfter = headerValue(response.headers, "Retry-After");
  if (retryAfter) {
    const retryAfterSeconds = Number(retryAfter);
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
      return Math.min(60000, Math.round(retryAfterSeconds * 1000));
    }

    const retryAfterDate = Date.parse(retryAfter);
    if (Number.isFinite(retryAfterDate)) {
      return Math.min(60000, Math.max(0, retryAfterDate - Date.now()));
    }
  }

  const resetHeader = headerValue(response.headers, "X-RateLimit-Reset");
  const resetSeconds = Number(resetHeader);
  if (Number.isFinite(resetSeconds) && resetSeconds > 0) {
    return Math.min(60000, Math.max(0, resetSeconds * 1000 - Date.now()));
  }

  return Math.min(8000, 500 * Math.pow(2, attempt));
}

function defaultPocketBaseSend(config) {
  if (typeof $http === "undefined" || !$http || typeof $http.send !== "function") {
    throw new Error("PocketBase $http.send transport is unavailable");
  }

  return $http.send(config);
}

function defaultSleep(milliseconds) {
  if (typeof sleep === "function") {
    sleep(milliseconds);
  }
}

function parseResponseJson(response) {
  if (response && response.json !== undefined && response.json !== null) {
    return response.json;
  }

  const body = response ? response.body : "";
  const text = typeof toString === "function" ? toString(body || []) : bodyToString(body);
  return text ? JSON.parse(text) : null;
}

function arenaHttpError(response, url) {
  const bodyText = typeof toString === "function" ? toString(response.body || [], 4000) : bodyToString(response.body).slice(0, 4000);
  const message = "Are.na API request failed with HTTP " + response.statusCode + " for " + url;
  const error = new Error(bodyText ? message + ": " + bodyText : message);
  error.statusCode = response.statusCode;
  error.url = url;
  return error;
}

function normalizeBaseUrl(value) {
  return String(value || arenaDefaultBaseUrl).replace(/\/+$/, "");
}

function requiredString(value, label) {
  const text = stringValue(value);
  if (!text) {
    throw new Error(label + " is required");
  }

  return text;
}

function stringValue(value) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function clampPositiveInteger(value, fallback, min, max) {
  const parsed = positiveInteger(value, fallback);
  return Math.max(min, Math.min(max, parsed));
}

function queryString(params) {
  const pairs = [];
  Object.keys(params).forEach((key) => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== "") {
      pairs.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(params[key])));
    }
  });

  return pairs.length ? "?" + pairs.join("&") : "";
}

function headerValue(headers, name) {
  const lowerName = String(name || "").toLowerCase();
  const source = headers || {};

  for (const key in source) {
    if (String(key).toLowerCase() === lowerName) {
      const value = source[key];
      return Array.isArray(value) ? String(value[0] || "") : String(value || "");
    }
  }

  return "";
}

function bodyToString(body) {
  if (!body) {
    return "";
  }

  if (typeof body === "string") {
    return body;
  }

  if (typeof body.length === "number") {
    let text = "";
    for (let index = 0; index < body.length; index += 1) {
      text += String.fromCharCode(Number(body[index]) & 255);
    }
    return text;
  }

  return String(body);
}

module.exports = {
  createArenaApiClient,
};
