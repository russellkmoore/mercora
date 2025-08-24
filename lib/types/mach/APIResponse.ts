export interface MACHApiResponse<T> {
  data: T;
  meta: {
    total?: number;
    limit?: number;
    offset?: number;
    schema: string;
  };
  links?: {
    self?: string;
    first?: string;
    next?: string;
    prev?: string;
    last?: string;
  };
}
