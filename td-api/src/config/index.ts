import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.DATABASE_URL || 'mongodb://localhost:27017/nyig-tournament',
  nyigTdApiUrl: process.env.NYIG_TD_API_URL || 'http://localhost:8000',
  nodeEnv: process.env.NODE_ENV || 'development',
} as const;
