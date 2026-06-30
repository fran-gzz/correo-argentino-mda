export interface InvgateApiResponse<T> {
  data: T;
  status: number;
  ok: true;
}

export interface InvgateApiError {
  message: string;
  status: number;
  ok: false;
}

export type InvgateResult<T> = InvgateApiResponse<T> | InvgateApiError;
