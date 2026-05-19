export type ApiResponse<T> = {
  data: T;
  requestId: string;
};

export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId: string;
};

export type Page<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};
