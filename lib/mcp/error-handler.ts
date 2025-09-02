import { NextResponse } from 'next/server';
import { MCPToolResponse } from './types';

export interface MCPError {
  code: string;
  message: string;
  details?: string;
  retryable?: boolean;
  suggestion?: string;
}

export class MCPServerError extends Error {
  public code: string;
  public details?: string;
  public retryable: boolean;
  public suggestion?: string;

  constructor(
    code: string,
    message: string,
    details?: string,
    retryable: boolean = false,
    suggestion?: string
  ) {
    super(message);
    this.name = 'MCPServerError';
    this.code = code;
    this.details = details;
    this.retryable = retryable;
    this.suggestion = suggestion;
  }
}

export function createErrorResponse<T>(
  error: Error | MCPServerError | string,
  sessionId: string = 'unknown',
  agentId: string = 'unknown',
  processingTime: number = 0,
  defaultData: T
): MCPToolResponse<T> {
  let mcpError: MCPError;

  if (error instanceof MCPServerError) {
    mcpError = {
      code: error.code,
      message: error.message,
      details: error.details,
      retryable: error.retryable,
      suggestion: error.suggestion
    };
  } else if (error instanceof Error) {
    mcpError = {
      code: 'INTERNAL_ERROR',
      message: error.message,
      details: error.stack?.split('\n').slice(0, 3).join('\n'),
      retryable: true,
      suggestion: 'Please retry the operation or contact support if the issue persists'
    };
  } else {
    mcpError = {
      code: 'UNKNOWN_ERROR',
      message: typeof error === 'string' ? error : 'An unknown error occurred',
      retryable: true,
      suggestion: 'Please retry the operation'
    };
  }

  return {
    success: false,
    data: defaultData,
    context: {
      session_id: sessionId,
      agent_id: agentId,
      processing_time_ms: processingTime
    },
    error: mcpError,
    metadata: {
      can_fulfill_percentage: 0,
      estimated_satisfaction: 0,
      next_actions: generateErrorActions(mcpError)
    }
  };
}

export function createHttpErrorResponse(
  error: Error | MCPServerError | string,
  status: number = 500
): NextResponse {
  let mcpError: MCPError;

  if (error instanceof MCPServerError) {
    mcpError = {
      code: error.code,
      message: error.message,
      details: error.details,
      retryable: error.retryable,
      suggestion: error.suggestion
    };
  } else if (error instanceof Error) {
    mcpError = {
      code: getErrorCodeFromStatus(status),
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      retryable: status >= 500,
      suggestion: getSuggestionForStatus(status)
    };
  } else {
    mcpError = {
      code: getErrorCodeFromStatus(status),
      message: typeof error === 'string' ? error : 'An error occurred',
      retryable: status >= 500,
      suggestion: getSuggestionForStatus(status)
    };
  }

  return NextResponse.json({
    success: false,
    error: mcpError
  }, { status });
}

function getErrorCodeFromStatus(status: number): string {
  switch (status) {
    case 400: return 'BAD_REQUEST';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 409: return 'CONFLICT';
    case 422: return 'UNPROCESSABLE_ENTITY';
    case 429: return 'RATE_LIMITED';
    case 500: return 'INTERNAL_SERVER_ERROR';
    case 502: return 'BAD_GATEWAY';
    case 503: return 'SERVICE_UNAVAILABLE';
    case 504: return 'GATEWAY_TIMEOUT';
    default: return 'HTTP_ERROR';
  }
}

function getSuggestionForStatus(status: number): string {
  switch (status) {
    case 400:
      return 'Check your request parameters and try again';
    case 401:
      return 'Verify your API key and authentication headers';
    case 403:
      return 'Contact support to verify your permissions';
    case 404:
      return 'Check the endpoint URL and resource ID';
    case 409:
      return 'Resolve the conflict and retry the operation';
    case 422:
      return 'Validate your input data format and requirements';
    case 429:
      return 'Wait before retrying - you have exceeded rate limits';
    case 500:
      return 'Retry the operation or contact support if the issue persists';
    case 502:
    case 503:
    case 504:
      return 'Service temporarily unavailable - please retry shortly';
    default:
      return 'Please retry the operation or contact support';
  }
}

function generateErrorActions(error: MCPError): string[] {
  const actions: string[] = [];

  if (error.retryable) {
    actions.push('Retry the operation');
  }

  switch (error.code) {
    case 'UNAUTHORIZED':
      actions.push('Check API key');
      actions.push('Verify authentication headers');
      break;
      
    case 'BAD_REQUEST':
      actions.push('Validate request parameters');
      actions.push('Check required fields');
      break;
      
    case 'NOT_FOUND':
      actions.push('Verify resource exists');
      actions.push('Check endpoint URL');
      break;
      
    case 'RATE_LIMITED':
      actions.push('Wait before retrying');
      actions.push('Reduce request frequency');
      break;
      
    case 'INTERNAL_ERROR':
    case 'INTERNAL_SERVER_ERROR':
      actions.push('Contact support');
      actions.push('Check system status');
      break;
      
    default:
      actions.push('Check system logs');
      actions.push('Contact support if issue persists');
  }

  if (error.suggestion && !actions.some(action => 
    action.toLowerCase().includes(error.suggestion!.toLowerCase().slice(0, 10))
  )) {
    actions.unshift(error.suggestion);
  }

  return actions;
}

// Common error factories
export const AuthenticationError = (details?: string) => 
  new MCPServerError(
    'AUTHENTICATION_FAILED',
    'Agent authentication failed',
    details,
    false,
    'Check your API key and ensure it is valid and active'
  );

export const ValidationError = (field: string, details?: string) =>
  new MCPServerError(
    'VALIDATION_ERROR',
    `Invalid ${field}`,
    details,
    false,
    `Ensure ${field} meets the required format and constraints`
  );

export const ResourceNotFoundError = (resource: string, id?: string) =>
  new MCPServerError(
    'RESOURCE_NOT_FOUND',
    `${resource} not found${id ? ` (ID: ${id})` : ''}`,
    undefined,
    false,
    `Verify the ${resource.toLowerCase()} exists and you have access to it`
  );

export const RateLimitError = (limit: number, resetTime?: Date) =>
  new MCPServerError(
    'RATE_LIMIT_EXCEEDED',
    'Rate limit exceeded',
    `Limit: ${limit} requests${resetTime ? `, resets at ${resetTime.toISOString()}` : ''}`,
    true,
    'Wait before making additional requests to stay within rate limits'
  );

export const ServiceUnavailableError = (service?: string) =>
  new MCPServerError(
    'SERVICE_UNAVAILABLE',
    `${service || 'Service'} temporarily unavailable`,
    undefined,
    true,
    'Please retry in a few moments'
  );

export const DatabaseError = (operation?: string) =>
  new MCPServerError(
    'DATABASE_ERROR',
    `Database operation failed${operation ? `: ${operation}` : ''}`,
    undefined,
    true,
    'Please retry the operation'
  );

export const PaymentError = (details?: string) =>
  new MCPServerError(
    'PAYMENT_ERROR',
    'Payment processing failed',
    details,
    false,
    'Verify payment information and try again, or use an alternative payment method'
  );

export const ShippingError = (details?: string) =>
  new MCPServerError(
    'SHIPPING_ERROR',
    'Shipping calculation failed',
    details,
    true,
    'Check shipping address and cart contents, then retry'
  );

export const ProductError = (details?: string) =>
  new MCPServerError(
    'PRODUCT_ERROR',
    'Product operation failed',
    details,
    true,
    'Verify product ID and try again'
  );