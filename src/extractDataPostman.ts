// Helper function to process Postman data
export function extractPostmanData(data: any): { baseUrl: string; pathName: string; paths: any; info: any; } {
  const baseUrlFull = data.variable?.find((variable: any) => variable.key === 'baseUrl')?.value || '';
  const baseUrl = baseUrlFull ? new URL(baseUrlFull).origin : '';
  const pathName = baseUrlFull ? new URL(baseUrlFull).pathname : '';
  const paths: Record<string, Record<string, any>> = {};
  const info = data.info || {};

  function collectionProcessItems(items: any[], currentPath: string = '', currentTag: string = 'Untagged') {
    items?.forEach(item => {
      if (item.item) {
        const folderName = item.name || currentTag;
        collectionProcessItems(item.item, currentPath, folderName);
      } else if (item.request) {
        const pathSegments = item.request.url.path || [];
        const path = `/${pathSegments.join('/')}`;
        paths[path] = paths[path] || {};

        const method = item.request.method.toLowerCase();
        const parameters = (item.request.url.query || []).map((query: any) => ({
          name: query.key,
          value: query.value || '',
        }));

        paths[path][method] = {
          ...item.request,
          tags: [currentTag], // Add tags for better categorization
          parameters,
        };
      }
    });
  }

  collectionProcessItems(data.item || []);
  return { baseUrl, pathName, paths, info };
}
