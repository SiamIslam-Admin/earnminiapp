/**
 * Universal Response & Array Extractor for Admin Endpoints
 * Supports single arrays, envelope objects (res.data?.data?.[key], res.data?.[key], res.data?.list),
 * and normalizes dual camelCase and snake_case properties transparently.
 */

export const extractAdminList = <T = any>(res: any, key?: string): T[] => {
  if (!res) return [];
  if (Array.isArray(res)) return res;

  // 1. Direct res.data checks
  if (Array.isArray(res.data)) return res.data;
  if (key && Array.isArray(res.data?.[key])) return res.data[key];
  if (key && Array.isArray(res?.[key])) return res[key];

  // 2. Nested data envelope (res.data.data)
  if (Array.isArray(res.data?.data)) return res.data.data;
  if (key && Array.isArray(res.data?.data?.[key])) return res.data.data[key];
  if (Array.isArray(res.data?.data?.list)) return res.data.data.list;

  // 3. Fallback generic list / items
  if (Array.isArray(res.data?.list)) return res.data.list;
  if (Array.isArray(res.data?.items)) return res.data.items;
  if (Array.isArray(res.list)) return res.list;
  if (Array.isArray(res.items)) return res.items;

  return [];
};

/**
 * Universal safe number parser
 */
export const parseNum = (val: any, fallback: number = 0): number => {
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  if (typeof val === 'string') {
    const p = parseFloat(val);
    return isNaN(p) ? fallback : p;
  }
  return fallback;
};

/**
 * Universal safe string parser
 */
export const parseStr = (val: any, fallback: string = ''): string => {
  if (val === null || val === undefined) return fallback;
  return String(val);
};
