import { prisma } from '../prisma/client.js';
import { nyigTdClient } from './nyigTdClient.js';
import type { CreatePlayerInput, UpdatePlayerInput } from '../utils/validation.js';

export class PlayerService {
  async create(data: CreatePlayerInput) {
    // Validate rank via external API
    const validation = await nyigTdClient.validateRanks([data.rank]);
    if (!validation.all_valid) {
      throw new Error(`Invalid rank: ${data.rank}`);
    }

    // Normalize rank
    const normalizedRank = validation.results[0].normalized || data.rank;

    return prisma.player.create({
      data: {
        name: data.name,
        rank: normalizedRank.toLowerCase(),
        club: data.club,
        agaId: data.agaId,
        rating: data.rating,
        email: data.email,
      },
    });
  }

  async get(id: string) {
    return prisma.player.findUnique({
      where: { id },
    });
  }

  async list(filters: { search?: string; limit?: number; skip?: number } = {}) {
    const { search, limit = 50, skip = 0 } = filters;

    return prisma.player.findMany({
      where: search
        ? {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          }
        : undefined,
      orderBy: { name: 'asc' },
      take: limit,
      skip,
    });
  }

  async update(id: string, updates: UpdatePlayerInput) {
    // Validate rank if provided
    if (updates.rank) {
      const validation = await nyigTdClient.validateRanks([updates.rank]);
      if (!validation.all_valid) {
        throw new Error(`Invalid rank: ${updates.rank}`);
      }
      updates.rank = (validation.results[0].normalized || updates.rank).toLowerCase();
    }

    return prisma.player.update({
      where: { id },
      data: updates,
    });
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.player.delete({
        where: { id },
      });
      return true;
    } catch {
      return false;
    }
  }
}

export const playerService = new PlayerService();
