import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { MongoClient, type Collection, type Db } from "mongodb";
import type {
  ChannelSettings,
  AuthSession,
  ChatMessage,
  Clip,
  CreatorToy,
  CreatorProfile,
  Follow,
  LiveStreamSession,
  ModerationRule,
  PlaySession,
  Stream,
  SupportEvent,
  UserAccount,
} from "../../../shared/types";

const mongoUri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/onlypaws";
const dbName = process.env.MONGODB_DB ?? "onlypaws";
const localDbPath = resolve(process.cwd(), ".data/mongodb");

let client: MongoClient | null = null;
let db: Db | null = null;
let localMongoProcess: ChildProcessWithoutNullStreams | null = null;
let localStartAttempted = false;
let connectionAttempt: Promise<Db | null> | null = null;

export interface MongoCollections {
  users: Collection<UserAccount>;
  sessions: Collection<AuthSession>;
  creators: Collection<CreatorProfile>;
  follows: Collection<Follow>;
  toys: Collection<CreatorToy>;
  playSessions: Collection<PlaySession>;
  chatMessages: Collection<ChatMessage>;
  channelSettings: Collection<ChannelSettings>;
  clips: Collection<Clip>;
  creatorStreams: Collection<Stream>;
  liveStreams: Collection<LiveStreamSession>;
  moderationRules: Collection<ModerationRule>;
  supportEvents: Collection<SupportEvent>;
}

export async function getDb(): Promise<Db | null> {
  if (db) {
    return db;
  }

  connectionAttempt ??= connectWithLocalFallback();
  return connectionAttempt;
}

export async function getCollections(): Promise<MongoCollections | null> {
  const database = await getDb();

  if (!database) {
    return null;
  }

  return {
    users: database.collection<UserAccount>("users"),
    sessions: database.collection<AuthSession>("sessions"),
    creators: database.collection<CreatorProfile>("creators"),
    follows: database.collection<Follow>("follows"),
    toys: database.collection<CreatorToy>("creator_toys"),
    playSessions: database.collection<PlaySession>("play_sessions"),
    chatMessages: database.collection<ChatMessage>("chat_messages"),
    channelSettings: database.collection<ChannelSettings>("channel_settings"),
    clips: database.collection<Clip>("clips"),
    creatorStreams: database.collection<Stream>("creator_streams"),
    liveStreams: database.collection<LiveStreamSession>("live_streams"),
    moderationRules: database.collection<ModerationRule>("moderation_rules"),
    supportEvents: database.collection<SupportEvent>("support_events"),
  };
}

export async function getMongoStatus() {
  const database = await getDb();

  return {
    connected: Boolean(database),
    uri: sanitizeMongoUri(mongoUri),
    localStartAttempted,
  };
}

async function connectWithLocalFallback(): Promise<Db | null> {
  const firstAttempt = await connect();

  if (firstAttempt) {
    await seedMongo(firstAttempt);
    return firstAttempt;
  }

  if (!isLocalMongoUri(mongoUri)) {
    return null;
  }

  await startLocalMongo();
  const secondAttempt = await connect(12, 500);

  if (secondAttempt) {
    await seedMongo(secondAttempt);
  }

  return secondAttempt;
}

async function connect(retries = 1, delayMs = 0): Promise<Db | null> {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      client = new MongoClient(mongoUri, {
        serverSelectionTimeoutMS: 700,
      });
      await client.connect();
      db = client.db(dbName);
      return db;
    } catch {
      await client?.close().catch(() => undefined);
      client = null;

      if (delayMs > 0) {
        await delay(delayMs);
      }
    }
  }

  return null;
}

async function startLocalMongo() {
  localStartAttempted = true;
  await mkdir(localDbPath, { recursive: true });

  try {
    localMongoProcess = spawn("mongod", [
      "--dbpath",
      localDbPath,
      "--bind_ip",
      "127.0.0.1",
      "--port",
      "27017",
      "--quiet",
    ]);
    localMongoProcess.on("exit", () => {
      localMongoProcess = null;
      db = null;
      client = null;
      connectionAttempt = null;
    });
    localMongoProcess.on("error", () => {
      localMongoProcess = null;
    });
  } catch {
    localMongoProcess = null;
  }
}

async function seedMongo(database: Db) {
  await database.collection<UserAccount>("users").createIndex({ email: 1 }, { unique: true });
  await database.collection<AuthSession>("sessions").createIndex({ token: 1 }, { unique: true });
  await database.collection<AuthSession>("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await database.collection<Follow>("follows").createIndex({ userId: 1, channelId: 1 }, { unique: true });
  await database.collection<ChatMessage>("chat_messages").createIndex({ streamId: 1, createdAt: -1 });
  const toys = database.collection<CreatorToy>("creator_toys");
  const playSessions = database.collection<PlaySession>("play_sessions");
  const creatorStreams = database.collection<Stream>("creator_streams");
  const liveStreams = database.collection<LiveStreamSession>("live_streams");

  if ((await creatorStreams.countDocuments({ creatorId: "momo-pixel" })) === 0) {
    await creatorStreams.insertMany([
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
    ]);
  }

  if ((await creatorStreams.countDocuments({ creatorId: "tierheim-brummer" })) === 0) {
    await creatorStreams.insertMany([
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
    ]);
  }

  await creatorStreams.deleteOne({ id: "brummer-quarantaene" });

  if ((await liveStreams.countDocuments({ creatorId: "tierheim-brummer", status: "live" })) === 0) {
    await liveStreams.insertMany([
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
    ]);
  }

  if ((await toys.countDocuments({ creatorId: "momo-pixel" })) === 0) {
    await toys.insertMany([
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
    ]);
  }

  if ((await playSessions.countDocuments({ creatorId: "momo-pixel" })) === 0) {
    await playSessions.insertMany([
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
    ]);
  }
}

function isLocalMongoUri(uri: string) {
  return uri.includes("127.0.0.1") || uri.includes("localhost");
}

function sanitizeMongoUri(uri: string) {
  return uri.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@");
}

function delay(ms: number) {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, ms);
  });
}
