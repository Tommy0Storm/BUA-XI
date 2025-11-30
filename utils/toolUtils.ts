export interface FunctionResponsePayload {
  result?: any;
  errors?: string[];
  [k: string]: any;
}

export interface FunctionResponse {
  id: string;
  name: string;
  response: FunctionResponsePayload;
}

export function makeToolResponse(id: string, name: string, payload: FunctionResponsePayload): { functionResponses: FunctionResponse[] } {
  return { functionResponses: [{ id, name, response: payload }] };
}

export function successResponse(id: string, name: string, result: any = 'ok') {
  return makeToolResponse(id, name, { result });
}

export function errorResponse(id: string, name: string, errors: string[]) {
  return makeToolResponse(id, name, { result: 'error', errors });
}
