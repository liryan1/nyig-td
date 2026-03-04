import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AxiosError } from 'axios';
import { Prisma } from '@prisma/client';

export interface ErrorResponse {
  error: string;
  details?: unknown;
  path?: string;
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('Error:', err);

  const response: ErrorResponse = {
    error: 'Internal server error',
    path: req.path,
  };

  // Zod validation errors
  if (err instanceof ZodError) {
    response.error = 'Validation error';
    response.details = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    res.status(400).json(response);
    return;
  }

  // Axios errors (from pairing-api)
  if (err instanceof AxiosError) {
    const status = err.response?.status || 500;
    response.error = 'External service error';
    response.details = err.response?.data?.detail || err.message;
    res.status(status).json(response);
    return;
  }

  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        response.error = 'Duplicate entry';
        response.details = err.meta?.target;
        res.status(409).json(response);
        return;
      case 'P2023':
        response.error = 'Invalid ID format';
        res.status(400).json(response);
        return;
      case 'P2025':
        response.error = 'Record not found';
        res.status(404).json(response);
        return;
      default:
        response.error = 'Database error';
        response.details = err.message;
        res.status(400).json(response);
        return;
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    response.error = 'Invalid data';
    response.details = err.message;
    res.status(400).json(response);
    return;
  }

  // Invalid ObjectId format (non-Prisma sources)
  if (err.message.includes('Invalid ObjectId') || err.message.includes('Malformed ObjectId')) {
    response.error = 'Invalid ID format';
    res.status(400).json(response);
    return;
  }

  // Not found errors
  if (err.message.toLowerCase().includes('not found')) {
    response.error = err.message;
    res.status(404).json(response);
    return;
  }

  // Invalid rank errors
  if (err.message.includes('Invalid rank')) {
    response.error = err.message;
    res.status(400).json(response);
    return;
  }

  // Generic error
  if (process.env.NODE_ENV === 'development') {
    response.details = err.message;
  }
  res.status(500).json(response);
}
