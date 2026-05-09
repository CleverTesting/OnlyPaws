import { Router } from "express";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import type {
  AuthResponse,
  AuthUser,
  ChannelSettings,
  ChatMessage,
  Clip,
  CreatorProfile,
  CreatorToy,
  Follow,
  LiveStreamSession,
  ModerationRule,
  PlaySession,
  RegistrationPayload,
  Stream,
  StreamCategory,
  StreamFormat,
  SupportEvent,
  UserAccount,
  RealtimeEvent,
} from "../../../shared/types";
import {
  channelSettings,
  chatMessages,
  clips,
  moderationRules,
  pricingPlans,
  queueItems,
  streams,
  supportEvents,
} from "../data/mockData";
import { getCollections, getMongoStatus } from "../db/mongo";

export const apiRouter = Router();

const fallbackUsers: UserAccount[] = [];
const fallbackAuthSessions: Array<{ token: string; userId: string; expiresAt: string }> = [];
const fallbackCreators: CreatorProfile[] = [];
const fallbackFollows: Follow[] = [];
const fallbackSavedClips: Clip[] = [];
const fallbackStreamChats: ChatMessage[] = [];
const sseClients = new Set<Response>();

function publishEvent(event: RealtimeEvent) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;

  for (const client of sseClients) {
    client.write(payload);
  }
}

interface AuthedRequest extends Request {
  user?: AuthUser;
}

function toAuthUser(user: UserAccount): AuthUser {
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
  };
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, passwordHash: string) {
  const [salt, storedHash] = passwordHash.split(":");

  if (!salt || !storedHash) {
    return false;
  }

  const hash = scryptSync(password, salt, 64);
  const stored = Buffer.from(storedHash, "hex");
  return stored.length === hash.length && timingSafeEqual(stored, hash);
}

function createToken() {
  return randomBytes(32).toString("hex");
}

function getBearerToken(request: Request) {
  const header = request.header("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
}

async function createAuthResponse(user: UserAccount): Promise<AuthResponse> {
  const token = createToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
  const collections = await getCollections();

  if (!collections) {
    fallbackAuthSessions.push({ token, userId: user.id, expiresAt });
    return { token, user: toAuthUser(user) };
  }

  await collections.sessions.insertOne({
    id: randomUUID(),
    userId: user.id,
    token,
    createdAt: new Date().toISOString(),
    expiresAt,
  });
  return { token, user: toAuthUser(user) };
}

async function canManageCreator(user: AuthUser | undefined, creatorId: string) {
  if (!user || user.role !== "creator") {
    return false;
  }

  if (creatorId === user.id) {
    return true;
  }

  const collections = await getCollections();

  if (!collections) {
    const profile = fallbackCreators.find((creator) => creator.id === creatorId);
    return profile ? profile.userId === user.id : false;
  }

  const profile = await collections.creators.findOne({ id: creatorId });
  return Boolean(profile && profile.userId === user.id);
}

async function resolveAuthUser(request: Request): Promise<AuthUser | null> {
  const token = getBearerToken(request);

  if (!token) {
    return null;
  }

  const collections = await getCollections();

  if (!collections) {
    const session = fallbackAuthSessions.find((item) => item.token === token && Date.parse(item.expiresAt) > Date.now());
    const user = session ? fallbackUsers.find((item) => item.id === session.userId) : null;
    return user ? toAuthUser(user) : null;
  }

  const session = await collections.sessions.findOne({ token, expiresAt: { $gt: new Date().toISOString() } });
  const user = session ? await collections.users.findOne({ id: session.userId }) : null;
  return user ? toAuthUser(user) : null;
}

async function requireAuth(request: AuthedRequest, response: Response, next: NextFunction) {
  const user = await resolveAuthUser(request);

  if (!user) {
    response.status(401).json({ message: "Anmeldung erforderlich." });
    return;
  }

  request.user = user;
  next();
}

function requireCreator(request: AuthedRequest, response: Response, next: NextFunction) {
  if (request.user?.role !== "creator") {
    response.status(403).json({ message: "Creator-Konto erforderlich." });
    return;
  }

  next();
}

const fallbackToys: CreatorToy[] = [
  {
    id: "katzenangel",
    creatorId: "momo-pixel",
    label: "Katzenangel",
    sessionPrice: "3 EUR",
    description: "Vom Creator freigegeben für kurze, aktive Spielrunden.",
    available: true,
  },
  {
    id: "schnueffelmatte",
    creatorId: "momo-pixel",
    label: "Schnüffelmatte",
    sessionPrice: "4 EUR",
    description: "Ruhige Suchrunde, wenn die Tiere gerade entspannt sind.",
    available: true,
  },
  {
    id: "quietschball",
    creatorId: "momo-pixel",
    label: "Quietschball",
    sessionPrice: "5 EUR",
    description: "Nur verfügbar, wenn genug Energie für eine aktive Runde da ist.",
    available: true,
  },
];

const fallbackSessions: PlaySession[] = [
  {
    id: "session-active",
    creatorId: "momo-pixel",
    toyId: "katzenangel",
    toyLabel: "Katzenangel",
    price: "3 EUR",
    status: "active",
    position: 1,
    viewerName: "Lina",
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
  {
    id: "session-paid-1",
    creatorId: "momo-pixel",
    toyId: "schnueffelmatte",
    toyLabel: "Schnüffelmatte",
    price: "4 EUR",
    status: "paid",
    position: 2,
    viewerName: "Ben",
    createdAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
  },
];

const fallbackLiveStreams: LiveStreamSession[] = [
  {
    id: "brummer-live-1",
    streamId: "brummer-hundewiese",
    creatorId: "tierheim-brummer",
    title: "Hundewiese",
    category: "hunde",
    format: "creator-led",
    audience: "2.8k Zuschauer",
    startedAt: new Date(Date.now() - 1000 * 60 * 34).toISOString(),
    status: "live",
  },
  {
    id: "brummer-live-2",
    streamId: "brummer-katzenzimmer",
    creatorId: "tierheim-brummer",
    title: "Katzenzimmer",
    category: "katzen",
    format: "watch-cam",
    audience: "4.1k Zuschauer",
    startedAt: new Date(Date.now() - 1000 * 60 * 52).toISOString(),
    status: "live",
  },
  {
    id: "brummer-live-3",
    streamId: "brummer-kleintierhaus",
    creatorId: "tierheim-brummer",
    title: "Kleintierhaus",
    category: "kleintiere",
    format: "care-routine",
    audience: "1.6k Zuschauer",
    startedAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    status: "live",
  },
];

const fallbackCreatorStreams: Stream[] = [
  {
    id: "box-conference",
    creatorId: "momo-pixel",
    title: "Studio-Snackrunde",
    category: "katzen",
    format: "creator-led",
    audience: "18.4k Zuschauer",
    description: "Katzenzimmer mit Spielsessions, Snackpausen und ruhigem Chat",
    theme: "cat-two",
  },
  {
    id: "hofstall-pferde",
    creatorId: "momo-pixel",
    title: "Stallcam",
    category: "bauernhof",
    format: "watch-cam",
    audience: "Offline",
    description: "Ruhige Stallkamera mit Fütterungsfenstern und Weideblick",
    theme: "farm-one",
  },
  {
    id: "tierheim-hundewiese",
    creatorId: "momo-pixel",
    title: "Hundewiese",
    category: "hunde",
    format: "creator-led",
    audience: "Offline",
    description: "Begleitete Spiel- und Trainingsfenster auf der Hundewiese",
    theme: "dog-one",
  },
  {
    id: "kleintierhaus-ruhecam",
    creatorId: "momo-pixel",
    title: "Ruhecam",
    category: "kleintiere",
    format: "watch-cam",
    audience: "Offline",
    description: "Gehegebeobachtung ohne direkte Interaktion",
    theme: "rabbit-one",
  },
  {
    id: "brummer-hundewiese",
    creatorId: "tierheim-brummer",
    title: "Hundewiese",
    category: "hunde",
    format: "creator-led",
    audience: "2.8k Zuschauer",
    description: "Begleitete Spielzeit mit vermittelbaren Hunden",
    theme: "dog-one",
  },
  {
    id: "brummer-katzenzimmer",
    creatorId: "tierheim-brummer",
    title: "Katzenzimmer",
    category: "katzen",
    format: "watch-cam",
    audience: "4.1k Zuschauer",
    description: "Ruhige Katzenzimmer-Cam mit Schlafplaetzen und Fensterbank",
    theme: "cat-one",
  },
  {
    id: "brummer-kleintierhaus",
    creatorId: "tierheim-brummer",
    title: "Kleintierhaus",
    category: "kleintiere",
    format: "care-routine",
    audience: "1.6k Zuschauer",
    description: "Futterrunde, Pflege und Gehegecheck im Kleintierhaus",
    theme: "rabbit-one",
  },
];

apiRouter.get("/health", async (_request, response) => {
  response.json({ ok: true, service: "onlypaws-api", mongo: await getMongoStatus() });
});

apiRouter.get("/events", (request, response) => {
  response.setHeader("Content-Type", "text/event-stream");
  response.setHeader("Cache-Control", "no-cache");
  response.setHeader("Connection", "keep-alive");
  response.flushHeaders?.();
  response.write("retry: 3000\n\n");
  sseClients.add(response);

  request.on("close", () => {
    sseClients.delete(response);
  });
});

apiRouter.get("/auth/me", requireAuth, (request: AuthedRequest, response) => {
  response.json({ user: request.user });
});

apiRouter.post("/auth/login", async (request, response) => {
  const { email, password } = request.body as { email?: string; password?: string };

  if (!email || !password) {
    response.status(400).json({ message: "E-Mail und Passwort sind erforderlich." });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const collections = await getCollections();
  const user = collections
    ? await collections.users.findOne({ email: normalizedEmail })
    : fallbackUsers.find((item) => item.email === normalizedEmail);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    response.status(401).json({ message: "E-Mail oder Passwort stimmt nicht." });
    return;
  }

  response.json(await createAuthResponse(user));
});

apiRouter.post("/auth/logout", requireAuth, async (request, response) => {
  const token = getBearerToken(request);
  const collections = await getCollections();

  if (!collections) {
    const index = fallbackAuthSessions.findIndex((session) => session.token === token);
    if (index >= 0) {
      fallbackAuthSessions.splice(index, 1);
    }
    response.json({ ok: true });
    return;
  }

  await collections.sessions.deleteOne({ token });
  response.json({ ok: true });
});

apiRouter.get("/me/follows", requireAuth, async (request: AuthedRequest, response) => {
  const userId = request.user?.id ?? "";
  const collections = await getCollections();

  if (!collections) {
    response.json(fallbackFollows.filter((follow) => follow.userId === userId));
    return;
  }

  response.json(await collections.follows.find({ userId }).sort({ createdAt: -1 }).toArray());
});

apiRouter.post("/me/follows", requireAuth, async (request: AuthedRequest, response) => {
  const { channelId, creatorId } = request.body as { channelId?: string; creatorId?: string };
  const userId = request.user?.id ?? "";

  if (!channelId || !creatorId) {
    response.status(400).json({ message: "Kanal und Creator sind erforderlich." });
    return;
  }

  const follow: Follow = {
    id: randomUUID(),
    userId,
    channelId,
    creatorId,
    createdAt: new Date().toISOString(),
  };
  const collections = await getCollections();

  if (!collections) {
    const existing = fallbackFollows.find((item) => item.userId === userId && item.channelId === channelId);
    if (!existing) {
      fallbackFollows.push(follow);
    }
    response.status(201).json(existing ?? follow);
    return;
  }

  await collections.follows.updateOne(
    { userId, channelId },
    { $setOnInsert: follow },
    { upsert: true },
  );
  response.status(201).json((await collections.follows.findOne({ userId, channelId })) ?? follow);
});

apiRouter.delete("/me/follows/:channelId", requireAuth, async (request: AuthedRequest, response) => {
  const userId = request.user?.id ?? "";
  const collections = await getCollections();

  if (!collections) {
    const index = fallbackFollows.findIndex(
      (follow) => follow.userId === userId && follow.channelId === request.params.channelId,
    );
    if (index >= 0) {
      fallbackFollows.splice(index, 1);
    }
    response.json({ ok: true });
    return;
  }

  await collections.follows.deleteOne({ userId, channelId: request.params.channelId });
  response.json({ ok: true });
});

apiRouter.get("/me/clips", requireAuth, async (request: AuthedRequest, response) => {
  const userId = request.user?.id ?? "";
  const collections = await getCollections();

  if (!collections) {
    response.json(fallbackSavedClips.filter((clip) => clip.userId === userId));
    return;
  }

  response.json(await collections.clips.find({ userId }).sort({ createdAt: -1 }).toArray());
});

apiRouter.get("/streams", (_request, response) => {
  response.json(streams);
});

apiRouter.get("/creator/:creatorId/streams", async (request, response) => {
  const collections = await getCollections();

  if (!collections) {
    response.json(fallbackCreatorStreams.filter((stream) => stream.creatorId === request.params.creatorId));
    return;
  }

  const creatorStreams = await collections.creatorStreams
    .find({ creatorId: request.params.creatorId })
    .sort({ title: 1 })
    .toArray();
  response.json(
    creatorStreams.length
      ? creatorStreams
      : fallbackCreatorStreams.filter((stream) => stream.creatorId === request.params.creatorId),
  );
});

apiRouter.post("/creator/:creatorId/streams", requireAuth, requireCreator, async (request: AuthedRequest, response) => {
  if (!(await canManageCreator(request.user, request.params.creatorId))) {
    response.status(403).json({ message: "Du kannst nur eigene Streams verwalten." });
    return;
  }

  const payload = request.body as Partial<Stream>;
  const title = payload.title?.trim();

  if (!title || !payload.category) {
    response.status(400).json({ message: "Titel und Tierbereich sind erforderlich." });
    return;
  }

  const stream: Stream = {
    id: `${request.params.creatorId}-${randomUUID().slice(0, 8)}`,
    creatorId: request.params.creatorId,
    title,
    category: payload.category,
    format: payload.format ?? "creator-led",
    audience: "Offline",
    description: payload.description?.trim() || "Neuer Stream",
    theme: payload.theme ?? "cat-one",
  };
  const collections = await getCollections();

  if (!collections) {
    fallbackCreatorStreams.push(stream);
    response.status(201).json(stream);
    return;
  }

  await collections.creatorStreams.insertOne(stream);
  response.status(201).json(stream);
});

apiRouter.get("/live-streams", async (_request, response) => {
  const collections = await getCollections();

  if (!collections) {
    response.json(fallbackLiveStreams.filter((stream) => stream.status === "live"));
    return;
  }

  response.json(await collections.liveStreams.find({ status: "live" }).sort({ startedAt: -1 }).toArray());
});

apiRouter.post("/streams/:streamId/start", requireAuth, requireCreator, async (request: AuthedRequest, response) => {
  const payload = request.body as {
    creatorId?: string;
    title?: string;
    category?: StreamCategory;
    format?: StreamFormat;
    audience?: string;
  };
  const collections = await getCollections();
  const storedStream = collections
    ? await collections.creatorStreams.findOne({ id: request.params.streamId })
    : fallbackCreatorStreams.find((stream) => stream.id === request.params.streamId);
  const baseStream =
    storedStream ??
    streams.find((stream) => stream.id === request.params.streamId) ??
    fallbackCreatorStreams.find((stream) => stream.id === request.params.streamId);
  const ownerCreatorId = payload.creatorId?.trim() || baseStream?.creatorId || request.params.streamId;

  if (!(await canManageCreator(request.user, ownerCreatorId))) {
    response.status(403).json({ message: "Du kannst nur eigene Streams starten." });
    return;
  }

  const session: LiveStreamSession = {
    id: randomUUID(),
    streamId: request.params.streamId,
    creatorId: ownerCreatorId,
    title: payload.title?.trim() || baseStream?.title || "OnlyPaws Live",
    category: payload.category ?? baseStream?.category ?? "katzen",
    format: payload.format ?? baseStream?.format ?? "creator-led",
    audience: payload.audience?.trim() || "1 Zuschauer",
    startedAt: new Date().toISOString(),
    status: "live",
  };
  if (!collections) {
    const existingIndex = fallbackLiveStreams.findIndex(
      (stream) => stream.streamId === session.streamId && stream.status === "live",
    );

    if (existingIndex >= 0) {
      fallbackLiveStreams[existingIndex] = session;
    } else {
      fallbackLiveStreams.push(session);
    }

    response.status(201).json(session);
    return;
  }

  await collections.liveStreams.updateMany({ streamId: session.streamId, status: "live" }, { $set: { status: "ended" } });
  await collections.liveStreams.insertOne(session);
  publishEvent({ type: "live-stream", stream: session });
  response.status(201).json(session);
});

apiRouter.post("/streams/:streamId/stop", requireAuth, requireCreator, async (request: AuthedRequest, response) => {
  const collections = await getCollections();
  const stream =
    collections
      ? await collections.creatorStreams.findOne({ id: request.params.streamId })
      : fallbackCreatorStreams.find((item) => item.id === request.params.streamId);
  const creatorId = stream?.creatorId ?? request.user?.id ?? request.params.streamId;

  if (!(await canManageCreator(request.user, creatorId))) {
    response.status(403).json({ message: "Du kannst nur eigene Streams beenden." });
    return;
  }

  if (!collections) {
    for (const stream of fallbackLiveStreams) {
      if (stream.streamId === request.params.streamId && stream.status === "live") {
        stream.status = "ended";
      }
    }

    response.json({ streamId: request.params.streamId, status: "ended" });
    return;
  }

  await collections.liveStreams.updateMany(
    { streamId: request.params.streamId, status: "live" },
    { $set: { status: "ended" } },
  );
  response.json({ streamId: request.params.streamId, status: "ended" });
});

apiRouter.get("/chat", (_request, response) => {
  response.json(chatMessages);
});

apiRouter.get("/channel/:streamId/chat", async (request, response) => {
  const collections = await getCollections();

  if (!collections) {
    response.json(fallbackStreamChats.filter((message) => message.streamId === request.params.streamId).slice(-80));
    return;
  }

  const messages = await collections.chatMessages
    .find({ streamId: request.params.streamId })
    .sort({ createdAt: -1 })
    .limit(80)
    .toArray();
  response.json(messages.reverse());
});

apiRouter.post("/channel/:streamId/chat", requireAuth, async (request: AuthedRequest, response) => {
  const { message } = request.body as { message?: string };
  const text = message?.trim();

  if (!text) {
    response.status(400).json({ message: "Nachricht ist erforderlich." });
    return;
  }

  const chatMessage: ChatMessage = {
    id: randomUUID(),
    streamId: request.params.streamId,
    userId: request.user?.id,
    author: request.user?.name ?? "Fan",
    message: text.slice(0, 280),
    createdAt: new Date().toISOString(),
  };
  const collections = await getCollections();

  if (!collections) {
    fallbackStreamChats.push(chatMessage);
  } else {
    await collections.chatMessages.insertOne(chatMessage);
  }

  publishEvent({ type: "chat", streamId: request.params.streamId, message: chatMessage });
  response.status(201).json(chatMessage);
});

apiRouter.post("/streams/:streamId/reactions", requireAuth, (request: AuthedRequest, response) => {
  const { label, symbol } = request.body as { label?: string; symbol?: string };

  if (!label || !symbol) {
    response.status(400).json({ message: "Reaction ist erforderlich." });
    return;
  }

  publishEvent({
    type: "reaction",
    streamId: request.params.streamId,
    label,
    symbol,
    userName: request.user?.name ?? "Fan",
  });
  response.status(201).json({ ok: true });
});

apiRouter.get("/queue", (_request, response) => {
  response.json(queueItems);
});

apiRouter.get("/pricing", (_request, response) => {
  response.json(pricingPlans);
});

apiRouter.get("/channel/:creatorId/toys", async (request, response) => {
  const collections = await getCollections();

  if (!collections) {
    response.json(fallbackToys.filter((toy) => toy.creatorId === request.params.creatorId));
    return;
  }

  const toys = await collections.toys
    .find({ creatorId: request.params.creatorId, available: true })
    .sort({ label: 1 })
    .toArray();
  response.json(toys);
});

apiRouter.get("/channel/:creatorId/play-sessions", async (request, response) => {
  const collections = await getCollections();

  if (!collections) {
    response.json(fallbackSessions.filter((session) => session.creatorId === request.params.creatorId));
    return;
  }

  const sessions = await collections.playSessions
    .find({ creatorId: request.params.creatorId, status: { $in: ["active", "paid", "pending"] } })
    .sort({ position: 1, createdAt: 1 })
    .toArray();
  response.json(sessions);
});

apiRouter.get("/channel/:creatorId/settings", async (request, response) => {
  const collections = await getCollections();

  if (!collections) {
    response.json(channelSettings.find((settings) => settings.creatorId === request.params.creatorId) ?? null);
    return;
  }

  response.json(await collections.channelSettings.findOne({ creatorId: request.params.creatorId }));
});

apiRouter.put("/channel/:creatorId/settings", async (request, response) => {
  const payload = request.body as Partial<ChannelSettings>;
  const settings: ChannelSettings = {
    creatorId: request.params.creatorId,
    channelName: payload.channelName?.trim() || "OnlyPaws Kanal",
    description: payload.description?.trim() || "",
    tags: payload.tags ?? [],
    quietHours: payload.quietHours?.trim() || "",
    moderationMode: payload.moderationMode ?? "standard",
    chatMode: payload.chatMode ?? "all",
    allowPlaySessions: Boolean(payload.allowPlaySessions),
    allowDonations: Boolean(payload.allowDonations),
    maxPlaySessionsPerHour: Number(payload.maxPlaySessionsPerHour ?? 0),
  };
  const collections = await getCollections();

  if (!collections) {
    const index = channelSettings.findIndex((item) => item.creatorId === settings.creatorId);
    if (index >= 0) {
      channelSettings[index] = settings;
    } else {
      channelSettings.push(settings);
    }
    response.json(settings);
    return;
  }

  await collections.channelSettings.updateOne({ creatorId: settings.creatorId }, { $set: settings }, { upsert: true });
  response.json(settings);
});

apiRouter.get("/channel/:creatorId/clips", async (request, response) => {
  const collections = await getCollections();

  if (!collections) {
    response.json(clips.filter((clip) => clip.creatorId === request.params.creatorId));
    return;
  }

  response.json(await collections.clips.find({ creatorId: request.params.creatorId }).sort({ createdAt: -1 }).toArray());
});

apiRouter.get("/channel/:creatorId/moderation-rules", async (request, response) => {
  const collections = await getCollections();

  if (!collections) {
    response.json(moderationRules.filter((rule) => rule.creatorId === request.params.creatorId));
    return;
  }

  response.json(await collections.moderationRules.find({ creatorId: request.params.creatorId }).toArray());
});

apiRouter.post("/channel/:creatorId/moderation-rules", async (request, response) => {
  const { phrase, action, reason } = request.body as Partial<ModerationRule>;

  if (!phrase || !action) {
    response.status(400).json({ message: "Phrase und Aktion sind erforderlich." });
    return;
  }

  const rule: ModerationRule = {
    id: randomUUID(),
    creatorId: request.params.creatorId,
    phrase,
    action,
    reason: reason ?? "Creator-Regel",
  };
  const collections = await getCollections();

  if (!collections) {
    moderationRules.push(rule);
    response.status(201).json(rule);
    return;
  }

  await collections.moderationRules.insertOne(rule);
  response.status(201).json(rule);
});

apiRouter.get("/channel/:creatorId/support-events", async (request, response) => {
  const collections = await getCollections();

  if (!collections) {
    response.json(supportEvents.filter((event) => event.creatorId === request.params.creatorId));
    return;
  }

  response.json(await collections.supportEvents.find({ creatorId: request.params.creatorId }).sort({ createdAt: -1 }).toArray());
});

apiRouter.post("/channel/:creatorId/support-events", async (request, response) => {
  const { type, label, amount, supporter } = request.body as Partial<SupportEvent>;

  if (!type || !label) {
    response.status(400).json({ message: "Typ und Label sind erforderlich." });
    return;
  }

  const event: SupportEvent = {
    id: randomUUID(),
    creatorId: request.params.creatorId,
    type,
    label,
    amount,
    supporter: supporter?.trim() || "Gast",
    createdAt: new Date().toISOString(),
  };
  const collections = await getCollections();

  if (!collections) {
    supportEvents.push(event);
    response.status(201).json(event);
    return;
  }

  await collections.supportEvents.insertOne(event);
  response.status(201).json(event);
});

apiRouter.post("/channel/:creatorId/play-sessions", requireAuth, async (request: AuthedRequest, response) => {
  const { toyId, viewerName } = request.body as { toyId?: string; viewerName?: string };

  if (!toyId) {
    response.status(400).json({ message: "Spielzeug ist erforderlich." });
    return;
  }

  const collections = await getCollections();

  if (!collections) {
    const toy = fallbackToys.find(
      (item) => item.creatorId === request.params.creatorId && item.id === toyId,
    );

    if (!toy) {
      response.status(404).json({ message: "Spielzeug wurde nicht gefunden." });
      return;
    }

    const fallbackSession: PlaySession = {
      id: randomUUID(),
      creatorId: request.params.creatorId,
      toyId: toy.id,
      toyLabel: toy.label,
      price: toy.sessionPrice,
      status: "paid",
      position: fallbackSessions.length + 1,
      viewerName: viewerName?.trim() || request.user?.name || "Fan",
      viewerUserId: request.user?.id,
      createdAt: new Date().toISOString(),
    };
    fallbackSessions.push(fallbackSession);
    publishEvent({ type: "play-session", creatorId: request.params.creatorId, session: fallbackSession });
    response.status(201).json(fallbackSession);
    return;
  }

  const toy = await collections.toys.findOne({
    creatorId: request.params.creatorId,
    id: toyId,
    available: true,
  });

  if (!toy) {
    response.status(404).json({ message: "Spielzeug wurde nicht gefunden." });
    return;
  }

  const currentCount = await collections.playSessions.countDocuments({
    creatorId: request.params.creatorId,
    status: { $in: ["active", "paid", "pending"] },
  });
  const session: PlaySession = {
    id: randomUUID(),
    creatorId: request.params.creatorId,
    toyId: toy.id,
    toyLabel: toy.label,
    price: toy.sessionPrice,
    status: "paid",
    position: currentCount + 1,
    viewerName: viewerName?.trim() || request.user?.name || "Fan",
    viewerUserId: request.user?.id,
    createdAt: new Date().toISOString(),
  };

  await collections.playSessions.insertOne(session);
  publishEvent({ type: "play-session", creatorId: request.params.creatorId, session });
  response.status(201).json(session);
});

apiRouter.post("/play-sessions/:sessionId/complete", requireAuth, requireCreator, async (request, response) => {
  const collections = await getCollections();

  if (!collections) {
    const session = fallbackSessions.find((item) => item.id === request.params.sessionId);

    if (!session) {
      response.status(404).json({ message: "Spielsession wurde nicht gefunden." });
      return;
    }

    if (session.status === "completed" || session.status === "refunded") {
      response.status(409).json({ message: "Spielsession ist bereits abgeschlossen." });
      return;
    }

    session.status = "completed";
    const clip: Clip | null = session.viewerUserId
      ? {
          id: randomUUID(),
          creatorId: session.creatorId,
          streamId: session.streamId,
          userId: session.viewerUserId,
          title: `${session.toyLabel}-Spielsession`,
          duration: "0:30",
          createdAt: new Date().toISOString(),
          views: "neu",
          channelName: session.creatorId,
          meta: `Auto-Clip · durchgeführt · ${session.price}`,
        }
      : null;

    if (clip) {
      fallbackSavedClips.unshift(clip);
    }

    publishEvent({ type: "play-session", creatorId: session.creatorId, session });
    response.json({ session, clip });
    return;
  }

  const session = await collections.playSessions.findOne({ id: request.params.sessionId });

  if (!session) {
    response.status(404).json({ message: "Spielsession wurde nicht gefunden." });
    return;
  }

  if (session.status === "completed" || session.status === "refunded") {
    response.status(409).json({ message: "Spielsession ist bereits abgeschlossen." });
    return;
  }

  await collections.playSessions.updateOne({ id: session.id }, { $set: { status: "completed" } });
  const completedSession: PlaySession = { ...session, status: "completed" };
  const clip: Clip | null = session.viewerUserId
    ? {
        id: randomUUID(),
        creatorId: session.creatorId,
        streamId: session.streamId,
        userId: session.viewerUserId,
        title: `${session.toyLabel}-Spielsession`,
        duration: "0:30",
        createdAt: new Date().toISOString(),
        views: "neu",
        channelName: session.creatorId,
        meta: `Auto-Clip · durchgeführt · ${session.price}`,
      }
    : null;

  if (clip) {
    await collections.clips.insertOne(clip);
  }

  publishEvent({ type: "play-session", creatorId: completedSession.creatorId, session: completedSession });
  response.json({ session: completedSession, clip });
});

apiRouter.post("/play-sessions/:sessionId/reject", requireAuth, requireCreator, async (request, response) => {
  const collections = await getCollections();

  if (!collections) {
    const session = fallbackSessions.find((item) => item.id === request.params.sessionId);

    if (!session) {
      response.status(404).json({ message: "Spielsession wurde nicht gefunden." });
      return;
    }

    if (session.status === "completed" || session.status === "refunded") {
      response.status(409).json({ message: "Spielsession ist bereits abgeschlossen." });
      return;
    }

    session.status = "refunded";
    publishEvent({ type: "play-session", creatorId: session.creatorId, session });
    response.json({ session });
    return;
  }

  const session = await collections.playSessions.findOne({ id: request.params.sessionId });

  if (!session) {
    response.status(404).json({ message: "Spielsession wurde nicht gefunden." });
    return;
  }

  if (session.status === "completed" || session.status === "refunded") {
    response.status(409).json({ message: "Spielsession ist bereits abgeschlossen." });
    return;
  }

  await collections.playSessions.updateOne({ id: session.id }, { $set: { status: "refunded" } });
  const rejectedSession: PlaySession = { ...session, status: "refunded" };
  publishEvent({ type: "play-session", creatorId: rejectedSession.creatorId, session: rejectedSession });
  response.json({ session: rejectedSession });
});

apiRouter.post("/registrations", async (request, response) => {
  const payload = request.body as Partial<RegistrationPayload>;

  if (!payload.name || !payload.email || !payload.password || !payload.acceptedTerms) {
    response.status(400).json({
      message: "Name, E-Mail, Passwort und Zustimmung sind erforderlich.",
    });
    return;
  }

  const normalizedEmail = payload.email.trim().toLowerCase();
  const collections = await getCollections();
  const existingUser = collections
    ? await collections.users.findOne({ email: normalizedEmail })
    : fallbackUsers.find((user) => user.email === normalizedEmail);

  if (existingUser) {
    response.status(409).json({ message: "Es gibt bereits ein Konto mit dieser E-Mail." });
    return;
  }

  const user: UserAccount = {
    id: randomUUID(),
    role: payload.role ?? "fan",
    name: payload.name.trim(),
    email: normalizedEmail,
    passwordHash: hashPassword(payload.password),
    createdAt: new Date().toISOString(),
  };

  if (!collections) {
    fallbackUsers.push(user);
    if (user.role === "creator") {
      fallbackCreators.push({
        id: randomUUID(),
        userId: user.id,
        displayName: payload.petName?.trim() || user.name,
        creatorType: payload.creatorType ?? "privat",
        description: payload.streamGoal?.trim() || "",
        createdAt: new Date().toISOString(),
      });
    }
    response.status(201).json(await createAuthResponse(user));
    return;
  }

  await collections.users.insertOne(user);

  if (user.role === "creator") {
    await collections.creators.insertOne({
      id: randomUUID(),
      userId: user.id,
      displayName: payload.petName?.trim() || user.name,
      creatorType: payload.creatorType ?? "privat",
      description: payload.streamGoal?.trim() || "",
      createdAt: new Date().toISOString(),
    });
  }

  response.status(201).json(await createAuthResponse(user));
});
