import type { FastifyInstance } from 'fastify';
import { CATALOG } from '@pdl/shared';
import type { GameService } from '../services/game.service';
import {
  AdBody,
  AvatarSchema,
  BuyBody,
  CreateNoteBody,
  CreatePlayerBody,
  FurnitureBody,
  HireBody,
  LeaderboardQuery,
  LearnBody,
  NoteParams,
  PlayerParams,
  ReceiveBody,
  ServeBody,
  StaffParams,
  UpdateNoteBody,
  UpgradeBody,
} from './schemas';

export async function registerRoutes(app: FastifyInstance, game: GameService) {
  app.get('/api/health', async () => ({ ok: true }));

  app.get('/api/catalog', async (_req, reply) => {
    reply.header('Cache-Control', 'public, max-age=300');
    return CATALOG;
  });

  app.get('/api/leaderboard', async (req) => {
    const { limit } = LeaderboardQuery.parse(req.query);
    return game.leaderboard(limit);
  });

  app.post('/api/players', async (req, reply) => {
    const body = CreatePlayerBody.parse(req.body);
    reply.code(201);
    return game.createPlayer({ ...body, userId: req.user?.id ?? null });
  });

  app.get('/api/players/:id', async (req) => {
    const { id } = PlayerParams.parse(req.params);
    return game.getPlayer(id);
  });

  app.get('/api/players/:id/market', async (req) => {
    const { id } = PlayerParams.parse(req.params);
    return game.getMarket(id);
  });

  app.post('/api/players/:id/buy', async (req) => {
    const { id } = PlayerParams.parse(req.params);
    const { items, mode } = BuyBody.parse(req.body);
    return game.buy(id, items, mode);
  });

  app.post('/api/players/:id/receive', async (req) => {
    const { id } = PlayerParams.parse(req.params);
    return game.receive(id, ReceiveBody.parse(req.body));
  });

  app.post('/api/players/:id/avatar', async (req) => {
    const { id } = PlayerParams.parse(req.params);
    return game.setAvatar(id, AvatarSchema.parse(req.body));
  });

  app.post('/api/players/:id/serve', async (req) => {
    const { id } = PlayerParams.parse(req.params);
    return game.serve(id, ServeBody.parse(req.body));
  });

  app.post('/api/players/:id/miss', async (req) => {
    const { id } = PlayerParams.parse(req.params);
    return game.miss(id);
  });

  app.post('/api/players/:id/end-day', async (req) => {
    const { id } = PlayerParams.parse(req.params);
    return game.endDay(id);
  });

  app.post('/api/players/:id/learn', async (req) => {
    const { id } = PlayerParams.parse(req.params);
    const { recipeId } = LearnBody.parse(req.body);
    return game.learn(id, recipeId);
  });

  app.post('/api/players/:id/upgrade', async (req) => {
    const { id } = PlayerParams.parse(req.params);
    const { type } = UpgradeBody.parse(req.body);
    return game.upgrade(id, type);
  });

  app.post('/api/players/:id/furniture', async (req) => {
    const { id } = PlayerParams.parse(req.params);
    const { itemId } = FurnitureBody.parse(req.body);
    return game.buyFurniture(id, itemId);
  });

  app.post('/api/players/:id/ad', async (req) => {
    const { id } = PlayerParams.parse(req.params);
    const { planId } = AdBody.parse(req.body);
    return game.buyAd(id, planId);
  });

  // ----- Sổ ghi chú -----
  app.get('/api/players/:id/notes', async (req) => {
    const { id } = PlayerParams.parse(req.params);
    return game.listNotes(id);
  });

  app.post('/api/players/:id/notes', async (req, reply) => {
    const { id } = PlayerParams.parse(req.params);
    reply.code(201);
    return game.createNote(id, CreateNoteBody.parse(req.body));
  });

  app.patch('/api/players/:id/notes/:noteId', async (req) => {
    const { id, noteId } = NoteParams.parse(req.params);
    return game.updateNote(id, noteId, UpdateNoteBody.parse(req.body));
  });

  app.delete('/api/players/:id/notes/:noteId', async (req) => {
    const { id, noteId } = NoteParams.parse(req.params);
    return game.deleteNote(id, noteId);
  });

  // ----- Nhân viên -----
  app.post('/api/players/:id/staff', async (req) => {
    const { id } = PlayerParams.parse(req.params);
    const { role } = HireBody.parse(req.body);
    return game.hireStaff(id, role);
  });

  app.delete('/api/players/:id/staff/:staffId', async (req) => {
    const { id, staffId } = StaffParams.parse(req.params);
    return game.fireStaff(id, staffId);
  });
}
