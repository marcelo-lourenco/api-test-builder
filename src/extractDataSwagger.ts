// Helper function to process Swagger/OpenAPI data based on version
export function extractSwaggerData(data: any): { baseUrl: string; pathName: string; paths: any; info: any; } {

  // Swagger 2.0
  if (data.swagger && data.swagger.startsWith("2.")) {
    const determineProtocol = (schemes: string[] = []): string =>
      schemes.includes("https") ? "https://" : schemes.includes("http") ? "http://" : "https://";

    const ensureProtocol = (url: string, protocol: string): string =>
      url.startsWith("http://") || url.startsWith("https://") ? url : `${protocol}${url}`;

    const protocol = determineProtocol(data.schemes);
    const hostUrl = data.host ? ensureProtocol(data.host, protocol) : `${protocol}localhost`;

    const parsedUrl = new URL(hostUrl);
    const baseUrl = parsedUrl.origin;
    const pathName = data.basePath || parsedUrl.pathname;

    const { paths, info } = data;
    return { baseUrl, pathName, paths, info };
  }

  // OpenAPI 3.0
  if (data.openapi && data.openapi.startsWith("3.")) {
    let hostUrl = "";

    // Pattern 1: Host can be at externalDocs.url or tags.externalDocs.url
    if (data.externalDocs?.url) {
      hostUrl = data.externalDocs.url;
    } else if (data.tags?.[0]?.externalDocs?.url) {
      hostUrl = data.tags[0].externalDocs.url;
    }

    // Pattern 2: host and pathName together in servers.url
    let serverUrl = data.servers?.[0]?.url || "";

    // Handle servers.variables
    const variables = data.servers?.[0]?.variables || {};
    for (const [key, variable] of Object.entries(variables) as [string, { default?: string; enum?: string[] }][]) {
      const value = variable.default ?? variable.enum?.[0];
      if (value) {
        serverUrl = serverUrl.replace(`{${key}}`, value);
      }
    }

    const parsedServerUrl = new URL(serverUrl, hostUrl || "http://localhost");
    hostUrl = parsedServerUrl.origin;
    const pathName = parsedServerUrl.pathname;
    const paths = data.paths || {};
    const info = data.info || {};
    const baseUrl = hostUrl || "";

    return { baseUrl, pathName, paths, info };
  }

  throw new Error("Unsupported Swagger/OpenAPI version. Supported versions: 2.0 or 3.0");
}
