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
    if (data.servers?.[0]?.url) {
      const serverUrl = new URL(data.servers[0].url, hostUrl || "http://localhost");
      hostUrl = serverUrl.origin; // Parte base (host)
    }

    const pathName = new URL(data.servers?.[0]?.url || "", hostUrl || "http://localhost").pathname || "";
    const paths = data.paths || {};
    const info = data.info || {};
    const baseUrl = hostUrl || "";

    return { baseUrl, pathName, paths, info };
  }


  throw new Error("Unsupported Swagger/OpenAPI version. Supported versions: 2.0 or 3.0");
}
