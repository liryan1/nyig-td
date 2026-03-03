import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodIssueCode } from 'zod';
import { AxiosError } from 'axios';
import { Prisma } from '@prisma/client';
import { errorHandler } from '../../src/middleware/errorHandler.js';

describe('Error Handler Middleware', () => {
  const mockRequest = (): Request => {
    return {
      path: '/api/test',
    } as Request;
  };

  const mockResponse = (): Response => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    return res as unknown as Response;
  };

  const nextFn: NextFunction = jest.fn() as unknown as NextFunction;

  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
    // Suppress console.error during tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
  });

  // ==================== ZodError ====================

  describe('ZodError handling', () => {
    it('should handle ZodError with 400', () => {
      const req = mockRequest();
      const res = mockResponse();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const zodError = new ZodError([
        {
          code: ZodIssueCode.invalid_type,
          expected: 'string',
          path: ['name'],
          message: 'Required',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      ]);

      errorHandler(zodError, req, res, nextFn);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation error',
          path: '/api/test',
        })
      );
    });

    it('should include field paths in ZodError details', () => {
      const req = mockRequest();
      const res = mockResponse();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const zodError = new ZodError([
        {
          code: ZodIssueCode.invalid_type,
          expected: 'string',
          path: ['settings', 'numRounds'],
          message: 'Expected number',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      ]);

      errorHandler(zodError, req, res, nextFn);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.arrayContaining([
            expect.objectContaining({ path: 'settings.numRounds' }),
          ]),
        })
      );
    });
  });

  // ==================== AxiosError ====================

  describe('AxiosError handling', () => {
    it('should handle AxiosError with response status', () => {
      const req = mockRequest();
      const res = mockResponse();
      const axiosError = new AxiosError('Request failed');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (axiosError as any).response = {
        status: 503,
        data: { detail: 'Service unavailable' },
      };

      errorHandler(axiosError, req, res, nextFn);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'External service error',
          details: 'Service unavailable',
        })
      );
    });

    it('should handle AxiosError without response (network error)', () => {
      const req = mockRequest();
      const res = mockResponse();
      const axiosError = new AxiosError('Network Error');

      errorHandler(axiosError, req, res, nextFn);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'External service error',
          details: 'Network Error',
        })
      );
    });

    it('should handle AxiosError with 404 from external API', () => {
      const req = mockRequest();
      const res = mockResponse();
      const axiosError = new AxiosError('Not Found');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (axiosError as any).response = {
        status: 404,
        data: { detail: 'Resource not found' },
      };

      errorHandler(axiosError, req, res, nextFn);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should handle AxiosError with 400 from external API', () => {
      const req = mockRequest();
      const res = mockResponse();
      const axiosError = new AxiosError('Bad Request');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (axiosError as any).response = {
        status: 400,
        data: { detail: 'Invalid input' },
      };

      errorHandler(axiosError, req, res, nextFn);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: 'Invalid input',
        })
      );
    });
  });

  // ==================== Prisma Errors ====================

  describe('Prisma error handling', () => {
    it('should handle P2002 (duplicate) with 409', () => {
      const req = mockRequest();
      const res = mockResponse();
      const prismaError = new Prisma.PrismaClientKnownRequestError('Duplicate', {
        code: 'P2002',
        clientVersion: '6.0.0',
        meta: { target: ['email'] },
      });

      errorHandler(prismaError, req, res, nextFn);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Duplicate entry',
          details: ['email'],
        })
      );
    });

    it('should handle P2025 (not found) with 404', () => {
      const req = mockRequest();
      const res = mockResponse();
      const prismaError = new Prisma.PrismaClientKnownRequestError('Not found', {
        code: 'P2025',
        clientVersion: '6.0.0',
      });

      errorHandler(prismaError, req, res, nextFn);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Record not found',
        })
      );
    });

    it('should handle other Prisma known errors with 400', () => {
      const req = mockRequest();
      const res = mockResponse();
      const prismaError = new Prisma.PrismaClientKnownRequestError('Invalid query', {
        code: 'P2001',
        clientVersion: '6.0.0',
      });

      errorHandler(prismaError, req, res, nextFn);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Database error',
        })
      );
    });

    it('should handle PrismaClientValidationError with 400', () => {
      const req = mockRequest();
      const res = mockResponse();
      const prismaError = new Prisma.PrismaClientValidationError('Validation failed', {
        clientVersion: '6.0.0',
      });

      errorHandler(prismaError, req, res, nextFn);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid data',
        })
      );
    });
  });

  // ==================== Invalid ObjectId ====================

  describe('Invalid ObjectId handling', () => {
    it('should handle Invalid ObjectId error with 400', () => {
      const req = mockRequest();
      const res = mockResponse();
      const error = new Error('Invalid ObjectId: xyz');

      errorHandler(error, req, res, nextFn);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid ID format',
        })
      );
    });

    it('should handle Malformed ObjectId error with 400', () => {
      const req = mockRequest();
      const res = mockResponse();
      const error = new Error('Malformed ObjectId');

      errorHandler(error, req, res, nextFn);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid ID format',
        })
      );
    });
  });

  // ==================== Not Found Errors ====================

  describe('Not found error handling', () => {
    it('should handle "not found" message with 404', () => {
      const req = mockRequest();
      const res = mockResponse();
      const error = new Error('Tournament not found');

      errorHandler(error, req, res, nextFn);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Tournament not found',
        })
      );
    });

    it('should handle "Player not found" with 404', () => {
      const req = mockRequest();
      const res = mockResponse();
      const error = new Error('Player not found');

      errorHandler(error, req, res, nextFn);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should handle "Round 5 not found" with 404', () => {
      const req = mockRequest();
      const res = mockResponse();
      const error = new Error('Round 5 not found');

      errorHandler(error, req, res, nextFn);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // ==================== Invalid Rank Errors ====================

  describe('Invalid rank error handling', () => {
    it('should handle invalid rank errors with 400', () => {
      const req = mockRequest();
      const res = mockResponse();
      const error = new Error('Invalid rank: xyz');

      errorHandler(error, req, res, nextFn);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid rank: xyz',
        })
      );
    });

    it('should handle Invalid rank format error', () => {
      const req = mockRequest();
      const res = mockResponse();
      const error = new Error('Invalid rank format');

      errorHandler(error, req, res, nextFn);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ==================== Generic Errors ====================

  describe('Generic error handling', () => {
    it('should handle generic errors with 500 in production', () => {
      const req = mockRequest();
      const res = mockResponse();
      const error = new Error('Something went wrong');

      process.env.NODE_ENV = 'production';

      errorHandler(error, req, res, nextFn);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        path: '/api/test',
      });
    });

    it('should include error details in development', () => {
      const req = mockRequest();
      const res = mockResponse();
      const error = new Error('Something went wrong');

      process.env.NODE_ENV = 'development';

      errorHandler(error, req, res, nextFn);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Internal server error',
          details: 'Something went wrong',
          path: '/api/test',
        })
      );
    });

    it('should include path in all error responses', () => {
      const req = { path: '/api/tournaments/123' } as Request;
      const res = mockResponse();
      const error = new Error('Test error');

      process.env.NODE_ENV = 'development';

      errorHandler(error, req, res, nextFn);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/api/tournaments/123',
        })
      );
    });
  });
});
