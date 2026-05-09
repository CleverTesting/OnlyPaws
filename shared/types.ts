export type StreamCategory = "katzen" | "hunde" | "kleintiere" | "aquarium" | "bauernhof";
export type StreamFormat = "creator-led" | "watch-cam" | "play-training" | "care-routine";

export interface Stream {
  id: string;
  creatorId?: string;
  title: string;
  category: StreamCategory;
  format?: StreamFormat;
  audience: string;
  description: string;
  theme: string;
}

export interface LiveStreamSession {
  id: string;
  streamId: string;
  creatorId: string;
  title: string;
  category: StreamCategory;
  format: StreamFormat;
  audience: string;
  startedAt: string;
  status: "live" | "ended";
}

export interface ChannelSettings {
  creatorId: string;
  channelName: string;
  description: string;
  tags: string[];
  quietHours: string;
  moderationMode: "standard" | "strict";
  chatMode: "all" | "followers" | "subscribers";
  allowPlaySessions: boolean;
  allowDonations: boolean;
  maxPlaySessionsPerHour: number;
}

export interface Clip {
  id: string;
  creatorId: string;
  streamId?: string;
  userId?: string;
  title: string;
  duration: string;
  createdAt: string;
  views: string;
  channelName?: string;
  meta?: string;
}

export interface Follow {
  id: string;
  userId: string;
  channelId: string;
  creatorId: string;
  createdAt: string;
}

export interface ModerationRule {
  id: string;
  creatorId: string;
  phrase: string;
  action: "hold" | "block";
  reason: string;
}

export interface SupportEvent {
  id: string;
  creatorId: string;
  type: "donation" | "subscription" | "play-session";
  label: string;
  amount?: string;
  supporter: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  streamId?: string;
  userId?: string;
  author: string;
  message: string;
  system?: boolean;
  createdAt?: string;
}

export interface QueueItem {
  id: string;
  time: string;
  title: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  price: string;
  description: string;
  featured?: boolean;
}

export interface CreatorToy {
  id: string;
  creatorId: string;
  label: string;
  sessionPrice: string;
  description: string;
  available: boolean;
}

export type PlaySessionStatus = "active" | "paid" | "pending" | "completed" | "refunded";

export interface PlaySession {
  id: string;
  creatorId: string;
  toyId: string;
  toyLabel: string;
  price: string;
  status: PlaySessionStatus;
  position: number;
  viewerName: string;
  viewerUserId?: string;
  streamId?: string;
  createdAt: string;
}

export type RegistrationRole = "fan" | "creator";

export interface UserAccount {
  id: string;
  role: RegistrationRole;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface AuthSession {
  id: string;
  userId: string;
  token: string;
  createdAt: string;
  expiresAt: string;
}

export interface AuthUser {
  id: string;
  role: RegistrationRole;
  name: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface CreatorProfile {
  id: string;
  userId: string;
  displayName: string;
  creatorType: "privat" | "tierheim" | "trainer" | "hof";
  description: string;
  createdAt: string;
}

export type RealtimeEvent =
  | { type: "chat"; streamId: string; message: ChatMessage }
  | { type: "reaction"; streamId: string; label: string; symbol: string; userName: string }
  | { type: "play-session"; creatorId: string; session: PlaySession }
  | { type: "live-stream"; stream: LiveStreamSession };

export interface RegistrationPayload {
  role: RegistrationRole;
  name: string;
  email: string;
  password: string;
  favoriteCategory?: StreamCategory | "alle";
  notificationPreference?: "daily" | "weekly" | "highlights";
  fanGoal?: string;
  petName: string;
  petType: string;
  creatorType?: "privat" | "tierheim" | "trainer" | "hof";
  streamFrequency?: "taeglich" | "mehrmals-pro-woche" | "woechentlich" | "gelegentlich";
  streamGoal: string;
  hasStreamingSetup?: boolean;
  acceptedTerms: boolean;
}
