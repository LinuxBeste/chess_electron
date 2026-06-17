import { z } from 'zod';

export const usernameSchema = z
  .string()
  .trim()
  .min(2, 'Username must be at least 2 characters')
  .max(30, 'Username must be at most 30 characters');

export const passwordSchema = z
  .string()
  .trim()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters');

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'Display name is required')
  .max(50, 'Display name must be at most 50 characters');

export const squareSchema = z
  .string()
  .trim()
  .regex(/^[a-h][1-8]$/i, 'Invalid square format');

export const promotionSchema = z.enum(['queen', 'rook', 'bishop', 'knight']).optional();

export const tournamentNameSchema = z
  .string()
  .trim()
  .min(2, 'Tournament name must be at least 2 characters')
  .max(100, 'Tournament name must be at most 100 characters');

export const ipSchema = z
  .string()
  .trim()
  .regex(/^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-f:]+$/i, 'Invalid IP address format');

export function pageSchema(defaultVal = 1) {
  return z
    .string()
    .optional()
    .default(String(defaultVal))
    .transform((v) => Math.max(1, parseInt(v, 10) || defaultVal));
}

export function limitSchema(defaultVal = 20, maxVal = 100) {
  return z
    .string()
    .optional()
    .default(String(defaultVal))
    .transform((v) => Math.min(maxVal, Math.max(1, parseInt(v, 10) || defaultVal)));
}

export const statsValueSchema = z
  .number()
  .int('Stats must be integers')
  .nonnegative('Stats cannot be negative');

export const friendRequestUsernameSchema = z
  .string()
  .trim()
  .min(2, 'Username must be between 2 and 30 characters')
  .max(30, 'Username must be between 2 and 30 characters');

export const joinCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, 'Join code is required')
  .max(20, 'Invalid join code');

export const broadcastMessageSchema = z
  .string()
  .trim()
  .min(1, 'Message is required')
  .max(5000, 'Message must be at most 5000 characters');
