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

export const tournamentNameSchema = z
  .string()
  .trim()
  .min(2, 'Tournament name must be at least 2 characters')
  .max(100, 'Tournament name must be at most 100 characters');

export const chatMessageSchema = z
  .string()
  .trim()
  .min(1, 'Message cannot be empty')
  .max(500, 'Message must be at most 500 characters');

export const serverUrlSchema = z
  .string()
  .url('Invalid server URL')
  .refine((v) => /^https?:\/\//.test(v), 'Server URL must start with http:// or https://');

export const joinCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, 'Join code is required')
  .max(20, 'Invalid join code');
