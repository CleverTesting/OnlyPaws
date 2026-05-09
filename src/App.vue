<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import type {
  AuthResponse,
  AuthUser,
  ChatMessage,
  Clip,
  CreatorToy,
  Follow,
  LiveStreamSession,
  PlaySession,
  PricingPlan,
  QueueItem,
  RealtimeEvent,
  RegistrationPayload,
  Stream,
  StreamCategory,
  StreamFormat,
} from "@shared/types";

type CategoryFilter = StreamCategory | "all";
type BrowseSort = "recommended" | "viewers-desc" | "viewers-asc" | "title-asc" | "format-asc";
type AudienceFilter = "all" | "under-5k" | "5k-10k" | "10k-plus";
type AppRoute = "home" | "browse" | "about" | "signup" | "channel" | "profile";
type SubPageRoute = Exclude<AppRoute, "home" | "browse" | "signup" | "channel" | "profile">;
type AuthMode = "login" | "register";

const reactionActions = [
  { label: "Spenden", symbol: "+", icon: "+" },
];

const donationAmounts = [2, 5, 10, 20];

const chatReactions = [
  { label: "Liebe", symbol: "♥" },
  { label: "Applaus", symbol: "👏" },
  { label: "Lachen", symbol: "☺" },
  { label: "Wow", symbol: "!" },
];

const creatorStudioRules = [
  "Keine Interaktion in Ruhezeiten",
  "Nur freigegebene Spielzeuge im Stream",
  "Begriffe wie erschrecken oder wecken werden moderiert",
];

const channelClips: Record<string, Array<{ title: string; meta: string }>> = {
  "box-conference": [
    { title: "Pixel blinzelt direkt in die Kamera", meta: "0:18 · 12.4k Aufrufe" },
    { title: "Momo gewinnt die Kartonrunde", meta: "0:31 · 8.1k Aufrufe" },
  ],
  "bruno-walk": [
    { title: "Bruno entdeckt die Lieblingswiese", meta: "0:24 · 6.7k Aufrufe" },
    { title: "Sitzpause mit Parkblick", meta: "0:15 · 3.2k Aufrufe" },
  ],
  "aquarium-zen": [
    { title: "Mondlicht im Aquarium", meta: "0:42 · 14.9k Aufrufe" },
    { title: "Fütterung im ruhigen Wasser", meta: "0:28 · 9.3k Aufrufe" },
  ],
};

const categories: Array<{ label: string; value: CategoryFilter }> = [
  { label: "Alle", value: "all" },
  { label: "Katzen", value: "katzen" },
  { label: "Hunde", value: "hunde" },
  { label: "Kleintiere", value: "kleintiere" },
  { label: "Aquarium", value: "aquarium" },
  { label: "Bauernhof", value: "bauernhof" },
];

const streamFormats: Array<{ label: string; value: StreamFormat; description: string }> = [
  { label: "Interaktiv", value: "creator-led", description: "Creator interagieren live mit ihrem Tier" },
  { label: "24/7 Cam", value: "watch-cam", description: "Feste Kamera ohne direkte Mensch-Tier-Interaktion" },
  { label: "Spiel & Training", value: "play-training", description: "Aktive Sessions, Übungen und Spielmomente" },
  { label: "Pflege & Alltag", value: "care-routine", description: "Fütterung, Pflege, Stallrunde oder Routine" },
];

const navItems: Array<{ label: string; route: SubPageRoute }> = [
  { label: "So funktioniert's", route: "about" },
];

const subPages: Array<{
  route: SubPageRoute;
  eyebrow: string;
  title: string;
  copy: string;
  highlights: string[];
}> = [
  {
    route: "about",
    eyebrow: "Was ist OnlyPaws?",
    title: "Süße Tiere live sehen und direkt unterstützen.",
    copy: "OnlyPaws ist ein Livestream-Portal für Tiermomente: Fans schauen süßen Tieren live zu und unterstützen sie über Spenden, Abos und Spielsessions. Creator streamen mit klaren Regeln für Ruhe, Sicherheit und Tierwohl.",
    highlights: ["Süße Tiere live", "Spenden & Abos", "Tierwohl zuerst"],
  },
];

const fallbackStreams: Stream[] = [
  {
    id: "nala-rain",
    title: "Nala beobachtet Regentropfen",
    category: "katzen",
    format: "watch-cam",
    audience: "12.8k Zuschauer",
    description: "ruhiger Katzen-Stream",
    theme: "cat-one",
  },
  {
    id: "bruno-walk",
    title: "Brunos Parkrunde",
    category: "hunde",
    format: "creator-led",
    audience: "9.4k Zuschauer",
    description: "Outdoor Walkcam",
    theme: "dog-one",
  },
  {
    id: "flocke-hay",
    title: "Flocke sortiert Heu",
    category: "kleintiere",
    format: "watch-cam",
    audience: "4.2k Zuschauer",
    description: "Kaninchenzimmer",
    theme: "rabbit-one",
  },
  {
    id: "aquarium-zen",
    title: "Aquarium Zen",
    category: "aquarium",
    format: "watch-cam",
    audience: "21.1k Zuschauer",
    description: "entspannte Wasserwelt",
    theme: "fish-one",
  },
  {
    id: "farm-morning",
    title: "Morgenrunde im Stall",
    category: "bauernhof",
    format: "care-routine",
    audience: "7.6k Zuschauer",
    description: "Hofleben live",
    theme: "farm-one",
  },
  {
    id: "box-conference",
    title: "Karton-Konferenz",
    category: "katzen",
    format: "play-training",
    audience: "15.3k Zuschauer",
    description: "Katzenchaos mit Stil",
    theme: "cat-two",
  },
  {
    id: "luna-clicker",
    title: "Lunas Clicker-Minuten",
    category: "hunde",
    format: "creator-led",
    audience: "8.1k Zuschauer",
    description: "Creator begleitet ruhiges Tricktraining",
    theme: "dog-one",
  },
  {
    id: "mila-balcony",
    title: "Mila auf dem Balkon",
    category: "katzen",
    format: "creator-led",
    audience: "6.7k Zuschauer",
    description: "moderierte Katzenrunde mit Fragen aus dem Chat",
    theme: "cat-one",
  },
  {
    id: "otto-sniff",
    title: "Ottos Schnueffelrunde",
    category: "hunde",
    format: "creator-led",
    audience: "5.9k Zuschauer",
    description: "Live-Walk mit ruhigen Pausen",
    theme: "dog-one",
  },
  {
    id: "peanut-desk",
    title: "Peanut am Schreibtisch",
    category: "kleintiere",
    format: "creator-led",
    audience: "3.8k Zuschauer",
    description: "Hamster-Setup mit Creator-Kommentar",
    theme: "rabbit-one",
  },
  {
    id: "bella-garden",
    title: "Bellas Gartenzeit",
    category: "hunde",
    format: "creator-led",
    audience: "7.2k Zuschauer",
    description: "Sommerstream mit Halterin und Spielpausen",
    theme: "dog-one",
  },
  {
    id: "simba-window",
    title: "Simba am Fensterplatz",
    category: "katzen",
    format: "creator-led",
    audience: "10.4k Zuschauer",
    description: "Creator beantwortet Chatfragen zur Katzenroutine",
    theme: "cat-two",
  },
  {
    id: "nori-feeding",
    title: "Nori bekommt Besuch",
    category: "aquarium",
    format: "creator-led",
    audience: "4.9k Zuschauer",
    description: "Aquarium-Talk mit kurzer Fuetterung",
    theme: "fish-one",
  },
  {
    id: "emma-stable",
    title: "Emmas Stallrunde",
    category: "bauernhof",
    format: "creator-led",
    audience: "6.1k Zuschauer",
    description: "Creator zeigt die Abendroutine im Stall",
    theme: "farm-one",
  },
  {
    id: "keks-training",
    title: "Keks lernt High Five",
    category: "hunde",
    format: "creator-led",
    audience: "8.8k Zuschauer",
    description: "kurze interaktive Trainingsrunde",
    theme: "dog-one",
  },
  {
    id: "meadow-cam",
    title: "Wiesen-Cam am Morgen",
    category: "bauernhof",
    format: "watch-cam",
    audience: "11.2k Zuschauer",
    description: "feste Kamera auf der Weide",
    theme: "farm-one",
  },
  {
    id: "parrot-perch",
    title: "Papageien-Sitzplatz",
    category: "kleintiere",
    format: "watch-cam",
    audience: "5.5k Zuschauer",
    description: "Beobachtungscam im Vogelzimmer",
    theme: "rabbit-one",
  },
  {
    id: "night-pond",
    title: "Teich bei Nacht",
    category: "aquarium",
    format: "watch-cam",
    audience: "13.6k Zuschauer",
    description: "24/7 Wasserblick mit Nachtlicht",
    theme: "fish-one",
  },
  {
    id: "shelter-nap",
    title: "Tierheim-Nap-Cam",
    category: "katzen",
    format: "watch-cam",
    audience: "9.8k Zuschauer",
    description: "ruhiger Schlafraum ohne direkte Interaktion",
    theme: "cat-one",
  },
  {
    id: "barn-door",
    title: "Stalltuer Live",
    category: "bauernhof",
    format: "watch-cam",
    audience: "7.9k Zuschauer",
    description: "24/7 Hofblick am Eingang",
    theme: "farm-one",
  },
  {
    id: "puppy-room",
    title: "Welpenzimmer Cam",
    category: "hunde",
    format: "watch-cam",
    audience: "18.2k Zuschauer",
    description: "feste Kamera im Ruhebereich",
    theme: "dog-one",
  },
  {
    id: "terrarium-sun",
    title: "Terrarium Sonnenplatz",
    category: "kleintiere",
    format: "watch-cam",
    audience: "4.4k Zuschauer",
    description: "Beobachtungscam mit Waermelampe",
    theme: "rabbit-one",
  },
  {
    id: "rope-pull",
    title: "Zerrseil-Challenge",
    category: "hunde",
    format: "play-training",
    audience: "6.6k Zuschauer",
    description: "Spielrunde mit klaren Pausen",
    theme: "dog-one",
  },
  {
    id: "tunnel-time",
    title: "Tunnelzeit im Spielzimmer",
    category: "kleintiere",
    format: "play-training",
    audience: "3.6k Zuschauer",
    description: "Kaninchen erkunden neue Tunnel",
    theme: "rabbit-one",
  },
  {
    id: "wand-session",
    title: "Federangel-Session",
    category: "katzen",
    format: "play-training",
    audience: "12.1k Zuschauer",
    description: "aktive Spielrunde mit Creator-Spielzeug",
    theme: "cat-two",
  },
  {
    id: "snuffle-mat-live",
    title: "Schnueffelmatte Live",
    category: "hunde",
    format: "play-training",
    audience: "7.4k Zuschauer",
    description: "ruhige Suchsession mit Zuschauerwahl",
    theme: "dog-one",
  },
  {
    id: "agility-mini",
    title: "Mini-Agility",
    category: "hunde",
    format: "play-training",
    audience: "9.1k Zuschauer",
    description: "kurzer Parcours ohne Druck",
    theme: "dog-one",
  },
  {
    id: "cat-puzzle",
    title: "Puzzlebrett fuer Katzen",
    category: "katzen",
    format: "play-training",
    audience: "10.7k Zuschauer",
    description: "Snackpuzzle mit moderiertem Chat",
    theme: "cat-one",
  },
  {
    id: "goat-toys",
    title: "Ziegen testen Spielzeug",
    category: "bauernhof",
    format: "play-training",
    audience: "5.8k Zuschauer",
    description: "Hofspielzeug mit kurzer Session",
    theme: "farm-one",
  },
  {
    id: "fish-target",
    title: "Target-Training im Aquarium",
    category: "aquarium",
    format: "play-training",
    audience: "6.3k Zuschauer",
    description: "kurze, ruhige Trainingssequenz",
    theme: "fish-one",
  },
  {
    id: "hide-seek",
    title: "Suchspiel im Wohnzimmer",
    category: "katzen",
    format: "play-training",
    audience: "8.9k Zuschauer",
    description: "Spielsession mit wechselnden Verstecken",
    theme: "cat-two",
  },
  {
    id: "breakfast-bowls",
    title: "Fruehstueck am Napf",
    category: "katzen",
    format: "care-routine",
    audience: "7.7k Zuschauer",
    description: "ruhige Fuetterungsroutine",
    theme: "cat-one",
  },
  {
    id: "grooming-hour",
    title: "Fellpflege-Stunde",
    category: "hunde",
    format: "care-routine",
    audience: "5.2k Zuschauer",
    description: "sanfte Pflege mit Pausen",
    theme: "dog-one",
  },
  {
    id: "hay-refill",
    title: "Heu auffuellen",
    category: "kleintiere",
    format: "care-routine",
    audience: "4.6k Zuschauer",
    description: "Gehegepflege und frisches Heu",
    theme: "rabbit-one",
  },
  {
    id: "tank-clean",
    title: "Aquarium Pflegefenster",
    category: "aquarium",
    format: "care-routine",
    audience: "8.4k Zuschauer",
    description: "Wassercheck und Pflanzenpflege",
    theme: "fish-one",
  },
  {
    id: "evening-stable",
    title: "Abendrunde im Stall",
    category: "bauernhof",
    format: "care-routine",
    audience: "6.9k Zuschauer",
    description: "Futter, Wasser und ruhige Kontrolle",
    theme: "farm-one",
  },
  {
    id: "medicine-calm",
    title: "Ruhige Medikamentenroutine",
    category: "hunde",
    format: "care-routine",
    audience: "3.9k Zuschauer",
    description: "stressarme Pflege mit Erklaerung",
    theme: "dog-one",
  },
  {
    id: "litter-reset",
    title: "Katzenzimmer Reset",
    category: "katzen",
    format: "care-routine",
    audience: "5.6k Zuschauer",
    description: "sauberes Zimmer und neue Decken",
    theme: "cat-one",
  },
  {
    id: "coop-check",
    title: "Hennenstall Check",
    category: "bauernhof",
    format: "care-routine",
    audience: "4.8k Zuschauer",
    description: "Morgenkontrolle im Hennenstall",
    theme: "farm-one",
  },
  {
    id: "bunny-brush",
    title: "Buerstenpause bei Flocke",
    category: "kleintiere",
    format: "care-routine",
    audience: "3.4k Zuschauer",
    description: "sanfte Fellpflege im Kaninchenzimmer",
    theme: "rabbit-one",
  },
];

const offlineChannels: Stream[] = [
  {
    id: "mika-milo",
    title: "Mika & Milo",
    category: "katzen",
    format: "creator-led",
    audience: "Offline",
    description: "Katzen-Duo mit abendlichen Spielsessions",
    theme: "cat-two",
  },
  {
    id: "toni-tricks",
    title: "Toni Tricks",
    category: "hunde",
    format: "play-training",
    audience: "Offline",
    description: "ruhiges Tricktraining mit Terrier Toni",
    theme: "dog-one",
  },
  {
    id: "lotte-loft",
    title: "Lottes Loft",
    category: "kleintiere",
    format: "watch-cam",
    audience: "Offline",
    description: "Meerschweinchen-Gehege mit festen Cam-Zeiten",
    theme: "rabbit-one",
  },
  {
    id: "reef-sunday",
    title: "Riff am Sonntag",
    category: "aquarium",
    format: "care-routine",
    audience: "Offline",
    description: "Meerwasserbecken, Pflege und ruhige Beobachtung",
    theme: "fish-one",
  },
  {
    id: "pony-paddock",
    title: "Pony Paddock",
    category: "bauernhof",
    format: "watch-cam",
    audience: "Offline",
    description: "Ponyhof-Kamera mit geplanten Fütterungsfenstern",
    theme: "farm-one",
  },
  {
    id: "oskar-nap",
    title: "Oskars Napclub",
    category: "hunde",
    format: "watch-cam",
    audience: "Offline",
    description: "Seniorhund Oskar streamt seine gemütlichen Ruhezeiten",
    theme: "dog-one",
  },
  {
    id: "minou-mornings",
    title: "Minou Mornings",
    category: "katzen",
    format: "care-routine",
    audience: "Offline",
    description: "Morgenroutine, Fütterung und Fensterplatz",
    theme: "cat-one",
  },
  {
    id: "ferret-fun",
    title: "Frettchenbande",
    category: "kleintiere",
    format: "play-training",
    audience: "Offline",
    description: "verspielte Tunnel- und Suchsessions",
    theme: "rabbit-one",
  },
  {
    id: "koi-corner",
    title: "Koi Corner",
    category: "aquarium",
    format: "watch-cam",
    audience: "Offline",
    description: "Teichblick mit geplanten Fütterungsstreams",
    theme: "fish-one",
  },
  {
    id: "hof-hummel",
    title: "Hof Hummel",
    category: "bauernhof",
    format: "creator-led",
    audience: "Offline",
    description: "kleiner Hofkanal mit Ziegen, Hühnern und Stallrunden",
    theme: "farm-one",
  },
];

const exampleLiveStreams: Stream[] = [
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

const defaultCreatorStreams: Stream[] = [
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
];

const fallbackChat: ChatMessage[] = [
  {
    id: "chat-1",
    author: "Lina",
    message: "Pixel hat gerade direkt in die Kamera geblinzelt.",
  },
  {
    id: "chat-2",
    author: "Ben",
    message: "Momo ist eindeutig Team Keks.",
  },
  {
    id: "chat-3",
    author: "Aylin",
    message: "Dieser Stream macht meinen Feierabend besser.",
  },
];

const fallbackChannelChats: Record<string, ChatMessage[]> = {
  "box-conference": fallbackChat,
  "nala-rain": [
    { id: "nala-chat-1", author: "Mara", message: "Der Regen passt perfekt zu Nalas Fensterplatz." },
    { id: "nala-chat-2", author: "Jules", message: "So ruhig hier, direkt abonniert." },
  ],
  "bruno-walk": [
    { id: "bruno-chat-1", author: "Nico", message: "Bruno hat die beste Parkroute." },
    { id: "bruno-chat-2", author: "Lea", message: "Bitte gleich nochmal an der Wiese vorbei." },
  ],
  "aquarium-zen": [
    { id: "aqua-chat-1", author: "Sam", message: "Dieser Stream läuft bei mir beim Arbeiten." },
    { id: "aqua-chat-2", author: "Mina", message: "Die Lichtstimmung ist heute richtig schön." },
  ],
};

const channelDescriptions: Record<string, string> = {
  "box-conference":
    "Momo & Pixel streamen ruhige Katzenmomente, kurze Spielsessions und Snackcam-Pausen mit festen Ruhezeiten. Der Creator legt vor jedem Stream fest, welche Spielzeuge verfügbar sind und wann die beiden genug Pause brauchen.",
  "nala-rain":
    "Nala liebt Fensterplätze, Regentage und sehr leise Chats. Auf diesem Kanal gibt es entspannte Beobachtungscams, gelegentliche Fütterungsfenster und Updates zu Nalas Lieblingsplätzen.",
  "bruno-walk":
    "Bruno nimmt seine Community mit auf ruhige Parkrunden. Der Kanal achtet auf Pausen, kurze Interaktionen und sichere Wege, damit Spaziergänge entspannt bleiben.",
  "aquarium-zen":
    "Aquarium Zen ist ein ruhiger Wasserwelt-Kanal mit festen Lichtzeiten, Pflegefenstern und Beobachtungscams. Ideal für alle, die einen leisen Stream im Hintergrund mögen.",
  "farm-morning":
    "Hofmorgen zeigt Stallrunden, Fütterung und ruhige Hofmomente. Der Creator erklärt Abläufe, beantwortet Fragen und plant Interaktionen immer rund um die Tiere.",
  "mika-milo":
    "Mika & Milo sind ein eingespieltes Katzen-Duo mit Abendstreams, Kartonpausen und spielerischen Sessions. Neue Streams werden vorab angekündigt.",
  "toni-tricks":
    "Toni Tricks dreht sich um ruhiges Training, kleine Erfolgsmomente und Spielpausen. Der Creator zeigt Übungen ohne Druck und mit viel Belohnung.",
  "lotte-loft":
    "Lottes Loft ist ein Gehegekanal für entspannte Kleintiermomente. Beobachtung, Fütterung und Setup-Updates wechseln sich ab.",
  "reef-sunday":
    "Riff am Sonntag zeigt Aquarienpflege, Korallenblicke und ruhige Fütterungszeiten. Der Kanal ist bewusst langsam und detailverliebt.",
  "pony-paddock":
    "Pony Paddock begleitet Hofalltag, Weidezeiten und kurze Pflegeroutinen. Livezeiten richten sich nach Wetter, Ruhephasen und Stallablauf.",
  "brummer-hundewiese":
    "Tierheim Brummer zeigt hier betreute Spielzeiten mit vermittelbaren Hunden. Interaktionen werden vom Team gesteuert und nur gemacht, wenn die Tiere entspannt sind.",
  "brummer-katzenzimmer":
    "Das Katzenzimmer von Tierheim Brummer ist eine ruhige Beobachtungscam mit Fensterbank, Kratzbaum und Schlafplaetzen. Spenden helfen direkt bei Futter und Versorgung.",
  "brummer-kleintierhaus":
    "Im Kleintierhaus begleitet Tierheim Brummer Futterrunden, Pflege und Gehegechecks. Der Stream bleibt bewusst ruhig und alltagsnah.",
};

const fallbackQueue: QueueItem[] = [
  { id: "queue-1", time: "19:30", title: "Katzenangel-Session im Wohnzimmer" },
  { id: "queue-2", time: "20:00", title: "Bruno testet neue Schnüffelmatte" },
  { id: "queue-3", time: "21:15", title: "Aquarium Zen bei Mondlicht" },
];

const fallbackPlans: PricingPlan[] = [
  {
    id: "free-paw",
    name: "Free Paw",
    price: "0 EUR",
    description: "Live schauen, chatten und Lieblingsstreams speichern.",
  },
  {
    id: "superfan",
    name: "Superfan",
    price: "6 EUR",
    description: "Exklusive Kameras, Reaktionen, Badge und monatlicher Spenden-Boost.",
    featured: true,
  },
  {
    id: "shelter-boost",
    name: "Shelter Boost",
    price: "12 EUR",
    description: "Mehr Drops, Spendenanteil und früher Zugang zu Tierheim-Streams.",
  },
];

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

const fallbackPlaySessions: PlaySession[] = [
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

const authReturnStorageKey = "onlypaws-auth-return-route";
const authTokenStorageKey = "onlypaws-auth-token";
const streams = ref<Stream[]>(fallbackStreams);
const creatorManagedStreams = ref<Stream[]>(defaultCreatorStreams);
const creatorLiveStreams = ref<Record<string, Stream>>({});
const stoppedStreamIds = ref<string[]>([]);
const channelChats = ref<Record<string, ChatMessage[]>>({ ...fallbackChannelChats });
const queueItems = ref<QueueItem[]>(fallbackQueue);
const pricingPlans = ref<PricingPlan[]>(fallbackPlans);
const creatorToys = ref<CreatorToy[]>(fallbackToys);
const playSessions = ref<PlaySession[]>(fallbackPlaySessions);
const generatedChannelClips = ref<Record<string, Array<{ title: string; meta: string }>>>({});
const fanSessionClips = ref<Clip[]>([]);
const selectedToyId = ref(fallbackToys[0].id);
const isPlaySessionMenuOpen = ref(false);
const isDonationMenuOpen = ref(false);
const selectedDonationAmount = ref(donationAmounts[1]);
const interactionHint = ref("");
const playSessionStatus = ref<"idle" | "submitting" | "success" | "error">("idle");
const selectedSupportMode = ref<"donation" | "subscription" | "session">("donation");
const streamControlStatus = ref<"idle" | "submitting" | "success" | "error">("idle");
const streamStartedAt = ref<Record<string, string>>({});
const newStreamTitle = ref("");
const newStreamDescription = ref("");
const newStreamCategory = ref<StreamCategory>("katzen");
const newStreamFormat = ref<StreamFormat>("creator-led");
const newStreamStatus = ref<"idle" | "submitting" | "success" | "error">("idle");
const isSearchOpen = ref(false);
const isProfileMenuOpen = ref(false);
const searchQuery = ref("");
const browseQuery = ref("");
const browseCategory = ref<CategoryFilter>("all");
const browseFormat = ref<StreamFormat | "all">("all");
const browseAudience = ref<AudienceFilter>("all");
const browseSort = ref<BrowseSort>("recommended");
const chatInput = ref("");
const chatListElement = ref<HTMLElement | null>(null);
const videoElement = ref<HTMLElement | null>(null);
const currentRoute = ref(window.location.hash || "#/");
const authReturnRoute = ref<string | null>(window.sessionStorage.getItem(authReturnStorageKey));
const authToken = ref(window.localStorage.getItem(authTokenStorageKey) ?? "");
const currentUser = ref<AuthUser | null>(null);
const watchingStreamId = ref<string | null>(null);
const authMode = ref<AuthMode>("login");
const loginEmail = ref("");
const loginPassword = ref("");
const isLoggedIn = ref(false);
const followedChannelIds = ref<string[]>([]);
const isMuted = ref(false);
const isFullscreen = ref(false);
const isTheaterMode = ref(false);
const volume = ref(68);
const viewers = ref(18492);
const treats = ref(0);
const reactions = ref<Array<{ id: number; symbol: string; right: number }>>([]);
const registration = ref<RegistrationPayload>({
  role: "fan",
  name: "",
  email: "",
  password: "",
  favoriteCategory: "alle",
  notificationPreference: "highlights",
  fanGoal: "",
  petName: "",
  petType: "Katze",
  creatorType: "privat",
  streamFrequency: "woechentlich",
  streamGoal: "",
  hasStreamingSetup: false,
  acceptedTerms: false,
});
const registrationStatus = ref<"idle" | "submitting" | "success" | "error">("idle");
const registrationMessage = ref("");
let viewerTimer: number | undefined;
let realtimeEvents: EventSource | undefined;

const mergedStreams = computed(() => {
  const merged = new Map<string, Stream>();

  for (const stream of fallbackStreams) {
    if (!stoppedStreamIds.value.includes(stream.id)) {
      merged.set(stream.id, stream);
    }
  }

  for (const stream of exampleLiveStreams) {
    if (!stoppedStreamIds.value.includes(stream.id)) {
      merged.set(stream.id, stream);
    }
  }

  for (const stream of streams.value) {
    if (stoppedStreamIds.value.includes(stream.id)) {
      continue;
    }

    const fallback = fallbackStreams.find((fallbackStream) => fallbackStream.id === stream.id);
    merged.set(stream.id, {
      ...stream,
      format: stream.format ?? fallback?.format,
    });
  }

  for (const stream of Object.values(creatorLiveStreams.value)) {
    merged.set(stream.id, stream);
  }

  return [...merged.values()];
});
const livePreviewStreams = computed(() => {
  const creators = new Map<string, Stream>();

  for (const stream of mergedStreams.value) {
    const creatorId = getCreatorId(stream);

    if (!creators.has(creatorId)) {
      creators.set(creatorId, stream);
    }
  }

  return [...creators.values()].slice(0, 6);
});
const liveChannelIds = computed(() => new Set(mergedStreams.value.map((stream) => stream.id)));
const allChannels = computed(() => {
  const channels = new Map<string, Stream>();

  for (const stream of mergedStreams.value) {
    channels.set(stream.id, stream);
  }

  for (const channel of offlineChannels) {
    if (!channels.has(channel.id)) {
      channels.set(channel.id, channel);
    }
  }

  return [...channels.values()];
});
const formatShelves = computed(() =>
  streamFormats.map((format) => ({
    ...format,
    streams: mergedStreams.value.filter((stream) => getStreamFormat(stream) === format.value),
  })),
);
const nextItems = computed(() => [
  ...playSessions.value.map((session) => ({
    id: session.id,
    time: session.status === "active" ? "Jetzt" : `#${session.position}`,
    title: session.toyLabel,
    meta: `${session.status === "active" ? "läuft" : "gespendet"} von ${session.viewerName}`,
  })),
  {
    id: "session-next-1",
    time: "19:45",
    title: "Katzenangel-Session",
    meta: "gespendet von Lina",
  },
  {
    id: "session-next-2",
    time: "20:20",
    title: "Schnüffelmatte",
    meta: "gespendet von Ben",
  },
]);
const searchResults = computed(() => {
  const query = normalizeSearchText(searchQuery.value);

  if (!query) {
    return [];
  }

  return allChannels.value.filter((stream) => {
    return getSearchableText(stream).includes(query);
  });
});
const browseResults = computed(() => {
  const query = normalizeSearchText(browseQuery.value);

  const filtered = allChannels.value.filter((stream) => {
    const audience = parseAudience(stream.audience);
    const matchesQuery =
      !query ||
      getSearchableText(stream).includes(query);
    const matchesCategory = browseCategory.value === "all" || stream.category === browseCategory.value;
    const matchesFormat = browseFormat.value === "all" || getStreamFormat(stream) === browseFormat.value;
    const matchesAudience =
      browseAudience.value === "all" ||
      (browseAudience.value === "under-5k" && audience < 5000) ||
      (browseAudience.value === "5k-10k" && audience >= 5000 && audience < 10000) ||
      (browseAudience.value === "10k-plus" && audience >= 10000);

    return matchesQuery && matchesCategory && matchesFormat && matchesAudience;
  });

  return [...filtered].sort((a, b) => {
    const liveDifference = Number(isChannelLive(b)) - Number(isChannelLive(a));
    const creatorLiveDifference = Number(isCreatorLive(b)) - Number(isCreatorLive(a));

    if (liveDifference !== 0) {
      return liveDifference;
    }

    if (creatorLiveDifference !== 0) {
      return creatorLiveDifference;
    }

    switch (browseSort.value) {
      case "viewers-desc":
        return parseAudience(b.audience) - parseAudience(a.audience);
      case "viewers-asc":
        return parseAudience(a.audience) - parseAudience(b.audience);
      case "title-asc":
        return a.title.localeCompare(b.title, "de");
      case "format-asc":
        return getStreamFormatLabel(getStreamFormat(a)).localeCompare(
          getStreamFormatLabel(getStreamFormat(b)),
          "de",
        );
      default:
        return 0;
    }
  });
});
const activeBrowseFilterChips = computed(() => {
  const chips: Array<{ id: string; label: string }> = [];
  const query = browseQuery.value.trim();

  if (query) {
    chips.push({ id: "query", label: `Suche: ${query}` });
  }

  if (browseCategory.value !== "all") {
    chips.push({ id: "category", label: `Tierart: ${getCategoryLabel(browseCategory.value)}` });
  }

  if (browseFormat.value !== "all") {
    chips.push({ id: "format", label: `Stream-Art: ${getStreamFormatLabel(browseFormat.value)}` });
  }

  if (browseAudience.value !== "all") {
    const audienceLabels: Record<Exclude<AudienceFilter, "all">, string> = {
      "under-5k": "unter 5k",
      "5k-10k": "5k bis 10k",
      "10k-plus": "10k+",
    };
    chips.push({ id: "audience", label: `Zuschauer: ${audienceLabels[browseAudience.value]}` });
  }

  if (browseSort.value !== "recommended") {
    const sortLabels: Record<Exclude<BrowseSort, "recommended">, string> = {
      "viewers-desc": "Zuschauer absteigend",
      "viewers-asc": "Zuschauer aufsteigend",
      "title-asc": "Name A-Z",
      "format-asc": "Stream-Art A-Z",
    };
    chips.push({ id: "sort", label: `Sortierung: ${sortLabels[browseSort.value]}` });
  }

  return chips;
});

const formattedViewers = computed(() => `${viewers.value.toLocaleString("de-DE")} schauen zu`);
const currentPage = computed<AppRoute>(() => {
  switch (currentRoute.value) {
    case "#/stoebern":
      return "browse";
    case "#/so-funktionierts":
      return "about";
    case "#/anmelden":
      return "signup";
    case "#/profil":
      return "profile";
    default:
      if (currentRoute.value.startsWith("#/channel/")) {
        return "channel";
      }

      return "home";
  }
});
const isHomePage = computed(() => currentPage.value === "home");
const isBrowsePage = computed(() => currentPage.value === "browse");
const isSignupPage = computed(() => currentPage.value === "signup");
const isChannelPage = computed(() => currentPage.value === "channel");
const isProfilePage = computed(() => currentPage.value === "profile");
const isCreatorRegistration = computed(() => registration.value.role === "creator");
const currentCreatorId = computed(() => (currentUser.value?.role === "creator" ? currentUser.value.id : "momo-pixel"));
const canManageStreams = computed(() => isLoggedIn.value && currentUser.value?.role === "creator");
const canManageActiveStream = computed(
  () => canManageStreams.value && getCreatorId(activeChannelStream.value) === currentCreatorId.value,
);
const streamCategoryOptions = computed(() =>
  categories.filter((category): category is { label: string; value: StreamCategory } => category.value !== "all"),
);
const signupImageUrl = computed(() =>
  isCreatorRegistration.value ? "/assets/signup-creator.png" : "/assets/signup-fan.png",
);
const selectedToy = computed(
  () => creatorToys.value.find((toy) => toy.id === selectedToyId.value) ?? creatorToys.value[0],
);
const activeSubPage = computed(
  () => subPages.find((page) => page.route === currentPage.value) ?? subPages[0],
);
const activeChannelStream = computed(() => {
  const streamId = currentRoute.value.replace("#/channel/", "");
  return (
    allChannels.value.find((stream) => stream.id === streamId) ??
    allChannels.value.find((stream) => stream.id === "box-conference") ??
    fallbackStreams[0]
  );
});
const activeChannelName = computed(() => getChannelName(activeChannelStream.value));
const activeCreatorId = computed(() => getCreatorId(activeChannelStream.value));
const activeCreatorStreams = computed(() =>
  allChannels.value.filter((stream) => getCreatorId(stream) === activeCreatorId.value),
);
const activeCreatorLiveStreams = computed(() =>
  activeCreatorStreams.value.filter((stream) => isChannelLive(stream)),
);
const activeCreatorOtherLiveStreams = computed(() =>
  activeCreatorLiveStreams.value.filter((stream) => stream.id !== activeChannelStream.value.id),
);
const activeCreatorOtherStreams = computed(() => activeCreatorOtherLiveStreams.value);
const activeCreatorIsLive = computed(() => activeCreatorLiveStreams.value.length > 0);
const activeCreatorStatusLabel = computed(() => {
  if (!activeCreatorIsLive.value) {
    return `${activeChannelName.value} ist offline`;
  }

  const liveCount = activeCreatorLiveStreams.value.length;
  return liveCount > 1
    ? `${activeChannelName.value} ist live · ${liveCount} Streams aktiv`
    : `${activeChannelName.value} ist live`;
});
const activeChannelDescription = computed(() => getChannelDescription(activeChannelStream.value));
const activeChatMessages = computed(() => getChannelChat(activeChannelStream.value));
const activeChannelTags = computed(() => getChannelTags(activeChannelStream.value));
const activeChannelClips = computed(() => getChannelClips(activeChannelStream.value));
const isFollowing = computed(() => followedChannelIds.value.includes(activeCreatorId.value));
const isActiveChannelLive = computed(() => isChannelLive(activeChannelStream.value));
const watchingStream = computed(() =>
  watchingStreamId.value ? allChannels.value.find((stream) => stream.id === watchingStreamId.value) ?? null : null,
);
const isActiveChannelWatching = computed(() => watchingStreamId.value === activeChannelStream.value.id);
const activeLiveSinceLabel = computed(() => getLiveSinceLabel(activeChannelStream.value));
const showMiniPlayer = computed(
  () => Boolean(watchingStream.value) && (!isChannelPage.value || !isActiveChannelWatching.value),
);
const followedChannels = computed(() =>
  followedChannelIds.value
    .map((channelId) => getRepresentativeCreatorChannel(channelId))
    .filter((stream): stream is Stream => Boolean(stream)),
);
const creatorManagedStreamsWithLiveState = computed(() =>
  creatorManagedStreams.value.map((stream) => allChannels.value.find((channel) => channel.id === stream.id) ?? stream),
);

onMounted(() => {
  loadInitialData();
  restoreSession();
  connectRealtime();
  window.addEventListener("hashchange", syncRoute);
  document.addEventListener("click", closeProfileMenu);
  document.addEventListener("fullscreenchange", syncFullscreenState);
  syncRoute();

  viewerTimer = window.setInterval(() => {
    viewers.value = Math.max(12000, viewers.value + Math.floor(Math.random() * 21) - 7);
  }, 2600);
});

onUnmounted(() => {
  window.clearInterval(viewerTimer);
  window.removeEventListener("hashchange", syncRoute);
  document.removeEventListener("click", closeProfileMenu);
  document.removeEventListener("fullscreenchange", syncFullscreenState);
  realtimeEvents?.close();
});

function syncRoute() {
  currentRoute.value = window.location.hash || "#/";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function navigateTo(target: AppRoute) {
  const routeByPage: Record<AppRoute, string> = {
    home: "#/",
    browse: "#/stoebern",
    about: "#/so-funktionierts",
    signup: "#/anmelden",
    channel: "#/channel/momo-pixel",
    profile: "#/profil",
  };

  currentRoute.value = routeByPage[target];
  isProfileMenuOpen.value = false;
  isSearchOpen.value = false;
  isDonationMenuOpen.value = false;
  isPlaySessionMenuOpen.value = false;
  window.history.pushState(null, "", currentRoute.value);
  await nextTick();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openSignup(mode: AuthMode, role?: RegistrationPayload["role"], returnToCurrentRoute = true) {
  isProfileMenuOpen.value = false;
  const isSwitchingInsideAuth = currentPage.value === "signup";
  const returnRoute = returnToCurrentRoute
    ? currentRoute.value
    : isSwitchingInsideAuth
      ? authReturnRoute.value
      : null;

  authReturnRoute.value = returnRoute;

  if (returnRoute) {
    window.sessionStorage.setItem(authReturnStorageKey, returnRoute);
  } else {
    window.sessionStorage.removeItem(authReturnStorageKey);
  }

  if (mode === "register") {
    registration.value.role = role ?? "fan";
  }
  authMode.value = mode;
  navigateTo("signup");
}

function openCreatorSignup() {
  openSignup("register", "creator");
}

async function returnAfterAuth() {
  const targetRoute = authReturnRoute.value ?? window.sessionStorage.getItem(authReturnStorageKey);
  authReturnRoute.value = null;
  window.sessionStorage.removeItem(authReturnStorageKey);

  if (targetRoute) {
    currentRoute.value = targetRoute;
    window.history.pushState(null, "", targetRoute);
    await nextTick();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  navigateTo("profile");
}

function openBrowseFormat(format: StreamFormat) {
  browseFormat.value = format;
  browseCategory.value = "all";
  browseAudience.value = "all";
  browseSort.value = "viewers-desc";
  browseQuery.value = "";
  navigateTo("browse");
}

function openBrowseCategory(category: StreamCategory) {
  browseFormat.value = "all";
  browseCategory.value = category;
  browseAudience.value = "all";
  browseSort.value = "viewers-desc";
  browseQuery.value = "";
  navigateTo("browse");
}

function clearBrowseFilter(filterId: string) {
  switch (filterId) {
    case "query":
      browseQuery.value = "";
      break;
    case "category":
      browseCategory.value = "all";
      break;
    case "format":
      browseFormat.value = "all";
      break;
    case "audience":
      browseAudience.value = "all";
      break;
    case "sort":
      browseSort.value = "recommended";
      break;
  }
}

function clearAllBrowseFilters() {
  browseQuery.value = "";
  browseCategory.value = "all";
  browseFormat.value = "all";
  browseAudience.value = "all";
  browseSort.value = "recommended";
}

function handleChannelTagClick(tag: { label: string; type: "format" | "category" | "support"; value: string }) {
  if (tag.type === "format") {
    openBrowseFormat(tag.value as StreamFormat);
    return;
  }

  if (tag.type === "category") {
    openBrowseCategory(tag.value as StreamCategory);
    return;
  }

  browseFormat.value = "all";
  browseCategory.value = "all";
  browseAudience.value = "all";
  browseSort.value = "viewers-desc";
  browseQuery.value = tag.label;
  navigateTo("browse");
}

function getStreamFormat(stream: Stream): StreamFormat {
  return (
    stream.format ??
    fallbackStreams.find((fallbackStream) => fallbackStream.id === stream.id)?.format ??
    inferStreamFormat(stream)
  );
}

function getStreamFormatLabel(format: StreamFormat) {
  return streamFormats.find((item) => item.value === format)?.label ?? "Interaktiv";
}

function getStreamCategoryLabel(category: StreamCategory) {
  return categories.find((item) => item.value === category)?.label ?? "Tierstream";
}

function getStreamFormatDescription(format: StreamFormat) {
  return streamFormats.find((item) => item.value === format)?.description ?? "";
}

function getCategoryLabel(categoryValue: StreamCategory) {
  return categories.find((category) => category.value === categoryValue)?.label ?? categoryValue;
}

function getCreatorId(stream: Stream) {
  return stream.creatorId ?? stream.id;
}

function getFollowId(stream: Stream) {
  return getCreatorId(stream);
}

function getFollowStorageIdsForCreator(creatorId: string) {
  return [
    creatorId,
    ...allChannels.value
      .filter((stream) => getCreatorId(stream) === creatorId)
      .map((stream) => stream.id),
  ];
}

function normalizeFollowId(follow: Follow) {
  const matchedStream = allChannels.value.find((stream) => stream.id === follow.channelId);
  return matchedStream ? getFollowId(matchedStream) : follow.creatorId || follow.channelId;
}

function getRepresentativeCreatorChannel(creatorId: string) {
  const creatorStreams = allChannels.value.filter((stream) => getCreatorId(stream) === creatorId);
  return creatorStreams.find((stream) => isChannelLive(stream)) ?? creatorStreams[0] ?? null;
}

function getCreatorLiveCount(stream: Stream) {
  const creatorId = getCreatorId(stream);
  return allChannels.value.filter((channel) => getCreatorId(channel) === creatorId && isChannelLive(channel)).length;
}

function isCreatorLive(stream: Stream) {
  return getCreatorLiveCount(stream) > 0;
}

function getDiscoveryStatusLabel(stream: Stream) {
  if (isChannelLive(stream)) {
    return "LIVE";
  }

  return isCreatorLive(stream) ? "KANAL LIVE" : "KANAL OFFLINE";
}

function getDiscoveryMetaLabel(stream: Stream) {
  return isChannelLive(stream) ? "Vorschau" : "Kanal";
}

function normalizeSearchText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .trim();
}

function getSearchableText(stream: Stream) {
  const categoryLabel = getCategoryLabel(stream.category);
  const format = getStreamFormat(stream);
  const categorySynonyms: Record<StreamCategory, string> = {
    katzen: "katze katzen kater kitten",
    hunde: "hund hunde welpe welpen",
    kleintiere: "kleintier kleintiere kaninchen hamster meerschweinchen frettchen vogel voegel",
    aquarium: "aquarium aquarien fisch fische wasser teich koi riff korallen",
    bauernhof: "bauernhof hof stall pony ziege ziegen huhn huehner hennen",
  };
  const searchParts = [
    getChannelName(stream),
    getStreamTitle(stream),
    stream.title,
    stream.description,
    stream.category,
    categoryLabel,
    categorySynonyms[stream.category],
    categoryLabel.replace(/e$/i, ""),
    getStreamFormatLabel(format),
    getStreamFormatDescription(format),
    isCreatorLive(stream) ? "live livestream online" : "offline",
    isChannelLive(stream) ? "spenden aktiv" : "benachrichtigung aktiv",
  ];

  return normalizeSearchText(searchParts.join(" "));
}

function getChannelTags(stream: Stream) {
  const format = getStreamFormat(stream);

  return [
    { label: getStreamFormatLabel(format), type: "format" as const, value: format },
    { label: getCategoryLabel(stream.category), type: "category" as const, value: stream.category },
    {
      label: isChannelLive(stream) ? "Spenden aktiv" : "Benachrichtigung aktiv",
      type: "support" as const,
      value: isChannelLive(stream) ? "donation" : "notify",
    },
  ];
}

function getChannelName(stream: Stream) {
  const names: Record<string, string> = {
    "box-conference": "Momo & Pixel",
    "nala-rain": "Nala",
    "bruno-walk": "Bruno unterwegs",
    "aquarium-zen": "Aquarium Zen",
    "farm-morning": "Hofmorgen",
    "mika-milo": "Mika & Milo",
    "toni-tricks": "Toni Tricks",
    "lotte-loft": "Lottes Loft",
    "reef-sunday": "Riff am Sonntag",
    "pony-paddock": "Pony Paddock",
    "oskar-nap": "Oskars Napclub",
    "minou-mornings": "Minou Mornings",
    "ferret-fun": "Frettchenbande",
    "koi-corner": "Koi Corner",
    "hof-hummel": "Hof Hummel",
    "brummer-hundewiese": "Tierheim Brummer",
    "brummer-katzenzimmer": "Tierheim Brummer",
    "brummer-kleintierhaus": "Tierheim Brummer",
  };

  if (names[stream.id]) {
    return names[stream.id];
  }

  const firstWord = stream.title.split(" ")[0]?.replace(/s$/, "") || "OnlyPaws";
  return `${firstWord} Kanal`;
}

function getStreamTitle(stream: Stream) {
  const channelName = getChannelName(stream);
  const channelPrefix = `${channelName}: `;

  return stream.title.startsWith(channelPrefix) ? stream.title.slice(channelPrefix.length) : stream.title;
}

function getChannelInitials(name: string) {
  return name
    .split(/[\s&]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getChannelDescription(stream: Stream) {
  return (
    channelDescriptions[stream.id] ??
    `${getChannelName(stream)} beschreibt hier den eigenen Kanal, die Tiere, typische Streamzeiten und welche Interaktionen fuer Fans moeglich sind.`
  );
}

function getChannelClips(stream: Stream) {
  const generatedClips = generatedChannelClips.value[stream.id] ?? [];
  const baseClips =
    channelClips[stream.id] ?? [
      { title: `${getChannelName(stream)}: Lieblingsmoment`, meta: "0:22 · neue Clips" },
      { title: `${getStreamTitle(stream)} als Highlight`, meta: "0:35 · Kanalclip" },
    ];

  return [...generatedClips, ...baseClips];
}

function createPlaySessionClip(session: PlaySession) {
  const streamId = activeChannelStream.value.id;
  const channelName = getChannelName(activeChannelStream.value);
  const clip = {
    title: `${session.toyLabel}-Spielsession mit ${channelName}`,
    meta: `Auto-Clip · durchgeführt · ${session.price}`,
  };

  generatedChannelClips.value = {
    ...generatedChannelClips.value,
    [streamId]: [clip, ...(generatedChannelClips.value[streamId] ?? [])],
  };

  if (session.viewerUserId === currentUser.value?.id || session.viewerName === currentUser.value?.name || session.viewerName === "Du") {
    fanSessionClips.value = [
      {
        id: crypto.randomUUID(),
        creatorId: session.creatorId,
        streamId,
        userId: currentUser.value?.id,
        duration: "0:30",
        createdAt: new Date().toISOString(),
        views: "neu",
        title: clip.title,
        meta: clip.meta,
        channelName,
      },
      ...fanSessionClips.value,
    ];
  }
}

function createDefaultChannelChat(stream: Stream): ChatMessage[] {
  const channelName = getChannelName(stream);

  return [
    {
      id: `${stream.id}-chat-welcome`,
      author: "OnlyPaws",
      message: `Willkommen im Chat von ${channelName}.`,
      system: true,
    },
    {
      id: `${stream.id}-chat-1`,
      author: "Mira",
      message: isChannelLive(stream) ? "Bin gerade reingekommen, was habe ich verpasst?" : "Freue mich auf den nächsten Stream.",
    },
  ];
}

function getChannelChat(stream: Stream) {
  return channelChats.value[stream.id] ?? createDefaultChannelChat(stream);
}

function updateChannelChat(streamId: string, updater: (messages: ChatMessage[]) => ChatMessage[]) {
  const stream = allChannels.value.find((channel) => channel.id === streamId) ?? activeChannelStream.value;
  channelChats.value = {
    ...channelChats.value,
    [streamId]: updater(getChannelChat(stream)),
  };
}

function isChannelLive(stream: Stream) {
  return liveChannelIds.value.has(stream.id);
}

function getLiveSinceLabel(stream: Stream) {
  if (!isChannelLive(stream)) {
    return "Gerade offline";
  }

  const startedAt = streamStartedAt.value[stream.id];

  if (!startedAt) {
    return "Live";
  }

  const minutes = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000));

  if (minutes < 1) {
    return "Live seit gerade eben";
  }

  return `Live seit ${minutes} Minuten`;
}

function parseAudience(audience: string) {
  const match = audience.match(/([\d.,]+)\s*k/i);

  if (match) {
    return Number.parseFloat(match[1].replace(",", ".")) * 1000;
  }

  return Number.parseInt(audience.replace(/\D/g, ""), 10) || 0;
}

function scrollToFormat(format: StreamFormat) {
  document.getElementById(`format-${format}`)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function scrollToLiveChannels() {
  document.getElementById("live-kanaele")?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function scrollToCreatorStreams() {
  document.getElementById("creator-stream-switcher")?.scrollIntoView({
    behavior: "smooth",
    block: "nearest",
  });
}

function toggleMute() {
  isMuted.value = !isMuted.value;
}

function toggleTheaterMode() {
  isTheaterMode.value = !isTheaterMode.value;
}

async function toggleFullscreen() {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }

  await videoElement.value?.requestFullscreen();
}

function syncFullscreenState() {
  isFullscreen.value = document.fullscreenElement === videoElement.value;
}

function inferStreamFormat(stream: Stream): StreamFormat {
  const text = `${getStreamTitle(stream)} ${stream.description}`.toLowerCase();

  if (text.includes("aquarium") || text.includes("beobachtet") || text.includes("zen")) {
    return "watch-cam";
  }

  if (text.includes("training") || text.includes("spiel") || text.includes("karton")) {
    return "play-training";
  }

  if (text.includes("stall") || text.includes("pflege") || text.includes("fütter")) {
    return "care-routine";
  }

  return "creator-led";
}

function buildLiveStreamFromSession(session: LiveStreamSession): Stream {
  const baseStream =
    streams.value.find((stream) => stream.id === session.streamId) ??
    fallbackStreams.find((stream) => stream.id === session.streamId) ??
    exampleLiveStreams.find((stream) => stream.id === session.streamId) ??
    offlineChannels.find((stream) => stream.id === session.streamId);

  return {
    id: session.streamId,
    creatorId: session.creatorId,
    title: session.title,
    category: session.category,
    format: session.format,
    audience: session.audience,
    description: baseStream?.description ?? "Live vom Creator gestartet",
    theme: baseStream?.theme ?? "cat-one",
  };
}

function applyLiveSessions(sessions: LiveStreamSession[]) {
  const nextLiveStreams: Record<string, Stream> = {};
  const nextStartedAt: Record<string, string> = {};

  for (const session of sessions) {
    if (session.status !== "live") {
      continue;
    }

    nextLiveStreams[session.streamId] = buildLiveStreamFromSession(session);
    nextStartedAt[session.streamId] = session.startedAt;
  }

  creatorLiveStreams.value = nextLiveStreams;
  streamStartedAt.value = nextStartedAt;
}

async function loadInitialData() {
  const [apiStreams, apiCreatorStreams, apiLiveStreams, apiChat, apiQueue, apiPricing, apiToys, apiSessions] =
    await Promise.all([
    fetchJson<Stream[]>("/api/streams", fallbackStreams),
    fetchJson<Stream[]>(`/api/creator/${currentCreatorId.value}/streams`, defaultCreatorStreams),
    fetchJson<LiveStreamSession[]>("/api/live-streams", []),
    fetchJson<ChatMessage[]>("/api/chat", fallbackChat),
    fetchJson<QueueItem[]>("/api/queue", fallbackQueue),
    fetchJson<PricingPlan[]>("/api/pricing", fallbackPlans),
    fetchJson<CreatorToy[]>("/api/channel/momo-pixel/toys", fallbackToys),
    fetchJson<PlaySession[]>("/api/channel/momo-pixel/play-sessions", fallbackPlaySessions),
  ]);

  streams.value = apiStreams;
  creatorManagedStreams.value = apiCreatorStreams.length ? apiCreatorStreams : defaultCreatorStreams;
  applyLiveSessions(apiLiveStreams);
  channelChats.value = {
    ...fallbackChannelChats,
    "box-conference": apiChat,
  };
  queueItems.value = apiQueue;
  pricingPlans.value = apiPricing;
  creatorToys.value = apiToys;
  playSessions.value = apiSessions;
  selectedToyId.value = apiToys[0]?.id ?? fallbackToys[0].id;
}

async function fetchJson<T>(url: string, fallback: T, headers?: Record<string, string>): Promise<T> {
  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      return fallback;
    }

    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

function connectRealtime() {
  realtimeEvents?.close();
  realtimeEvents = new EventSource("/api/events");
  realtimeEvents.onmessage = (event) => {
    const realtimeEvent = JSON.parse(event.data) as RealtimeEvent;
    handleRealtimeEvent(realtimeEvent);
  };
}

function handleRealtimeEvent(event: RealtimeEvent) {
  if (event.type === "chat") {
    updateChannelChat(event.streamId, (messages) => {
      if (messages.some((message) => message.id === event.message.id)) {
        return messages;
      }

      return [...messages, event.message];
    });
    scrollChatToBottom();
    return;
  }

  if (event.type === "reaction") {
    if (event.streamId === activeChannelStream.value.id) {
      showReaction(event.symbol);
    }
    addReactionMessage(event.streamId, event.userName, event.label, event.symbol);
    return;
  }

  if (event.type === "play-session") {
    playSessions.value = [
      ...playSessions.value.filter((session) => session.id !== event.session.id),
      event.session,
    ].sort((first, second) => first.position - second.position);
    return;
  }

  if (event.type === "live-stream") {
    const liveStream = buildLiveStreamFromSession(event.stream);
    creatorLiveStreams.value = {
      ...creatorLiveStreams.value,
      [event.stream.streamId]: liveStream,
    };
    streamStartedAt.value = {
      ...streamStartedAt.value,
      [event.stream.streamId]: event.stream.startedAt,
    };
  }
}

function getAuthHeaders(): Record<string, string> {
  return authToken.value ? { Authorization: `Bearer ${authToken.value}` } : {};
}

function applyAuth(auth: AuthResponse) {
  authToken.value = auth.token;
  currentUser.value = auth.user;
  isLoggedIn.value = true;
  registration.value.role = auth.user.role;
  registration.value.name = auth.user.name;
  registration.value.email = auth.user.email;
  window.localStorage.setItem(authTokenStorageKey, auth.token);
  void loadAccountData();
}

async function loadAccountData() {
  if (!authToken.value) {
    return;
  }

  const [follows, clips] = await Promise.all([
    fetchJson<Follow[]>("/api/me/follows", [], getAuthHeaders()),
    fetchJson<Clip[]>("/api/me/clips", [], getAuthHeaders()),
  ]);

  followedChannelIds.value = [...new Set(follows.map((follow) => normalizeFollowId(follow)))];
  fanSessionClips.value = clips;

  if (currentUser.value?.role === "creator") {
    const creatorStreams = await fetchJson<Stream[]>(
      `/api/creator/${currentCreatorId.value}/streams`,
      [],
      getAuthHeaders(),
    );
    creatorManagedStreams.value = creatorStreams.length ? creatorStreams : [];
  }
}

async function restoreSession() {
  if (!authToken.value) {
    return;
  }

  try {
    const response = await fetch("/api/auth/me", {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error("session expired");
    }

    const payload = (await response.json()) as { user: AuthUser };
    currentUser.value = payload.user;
    isLoggedIn.value = true;
    registration.value.role = payload.user.role;
    registration.value.name = payload.user.name;
    registration.value.email = payload.user.email;
    await loadAccountData();
  } catch {
    authToken.value = "";
    currentUser.value = null;
    isLoggedIn.value = false;
    window.localStorage.removeItem(authTokenStorageKey);
  }
}

async function toggleFollow() {
  if (!ensureLoggedInForInteraction("Melde dich an, um Kanälen zu folgen.")) {
    return;
  }

  const stream = activeChannelStream.value;
  const followId = getFollowId(stream);
  const isAlreadyFollowing = followedChannelIds.value.includes(followId);

  try {
    if (isAlreadyFollowing) {
      await Promise.all(
        getFollowStorageIdsForCreator(followId).map((storageId) =>
          fetch(`/api/me/follows/${storageId}`, {
            method: "DELETE",
            headers: getAuthHeaders(),
          }),
        ),
      );
      followedChannelIds.value = followedChannelIds.value.filter((channelId) => channelId !== followId);
    } else {
      await fetch("/api/me/follows", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          channelId: followId,
          creatorId: followId,
        }),
      });
      followedChannelIds.value = [...followedChannelIds.value, followId];
    }
  } catch {
    addSystemMessage("Folgen konnte gerade nicht gespeichert werden.");
    return;
  }

  addSystemMessage(
    isAlreadyFollowing
      ? `Du folgst ${getChannelName(stream)} nicht mehr.`
      : `Du folgst ${getChannelName(stream)} jetzt.`,
  );
}

async function unfollowChannel(stream: Stream) {
  const followId = getFollowId(stream);
  await Promise.all(
    getFollowStorageIdsForCreator(followId).map((storageId) =>
      fetch(`/api/me/follows/${storageId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      }),
    ),
  ).catch(() => undefined);
  followedChannelIds.value = followedChannelIds.value.filter((channelId) => channelId !== followId);
  addSystemMessage(`Du folgst ${getChannelName(stream)} nicht mehr.`);
}

async function sendMessage() {
  if (!ensureLoggedInForInteraction("Melde dich an, um im Chat zu schreiben.")) {
    return;
  }

  const message = chatInput.value.trim();

  if (!message) {
    return;
  }

  try {
    const response = await fetch(`/api/channel/${activeChannelStream.value.id}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new Error("chat failed");
    }

    chatInput.value = "";
  } catch {
    addSystemMessage("Nachricht konnte gerade nicht gesendet werden.");
  }
}

function sendReaction(label: string, symbol: string) {
  isPlaySessionMenuOpen.value = false;
  isDonationMenuOpen.value = false;
  isSearchOpen.value = false;
  showReaction(symbol);

  if (label === "Spenden") {
    treats.value += 1;
    addSystemMessage(`Spende #${treats.value} wurde an den Stream gesendet.`);
    return;
  }

  addSystemMessage(`${label} gesendet.`);
}

async function sendChatReaction(label: string, symbol: string) {
  if (!ensureLoggedInForInteraction("Melde dich an, um im Chat zu reagieren.")) {
    return;
  }

  isSearchOpen.value = false;
  await fetch(`/api/streams/${activeChannelStream.value.id}/reactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ label, symbol }),
  }).catch(() => undefined);
}

function reportChannelContent() {
  addSystemMessage("Danke für deinen Hinweis. Moderation prüft den Kanalverlauf.");
}

function openSearchResult(stream: Stream) {
  searchQuery.value = "";
  isSearchOpen.value = false;
  openStreamChannel(stream);
}

function submitGlobalSearch() {
  const query = searchQuery.value.trim();

  if (!query) {
    navigateTo("browse");
    return;
  }

  browseQuery.value = query;
  browseFormat.value = "all";
  browseCategory.value = "all";
  browseAudience.value = "all";
  browseSort.value = "viewers-desc";
  isSearchOpen.value = false;
  navigateTo("browse");
}

async function openStreamChannel(stream: Stream) {
  currentRoute.value = `#/channel/${stream.id}`;
  isDonationMenuOpen.value = false;
  isPlaySessionMenuOpen.value = false;
  window.history.pushState(null, "", currentRoute.value);
  void loadChannelChat(stream.id);
  await nextTick();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function loadChannelChat(streamId: string) {
  const messages = await fetchJson<ChatMessage[]>(`/api/channel/${streamId}/chat`, []);

  if (!messages.length) {
    return;
  }

  channelChats.value = {
    ...channelChats.value,
    [streamId]: messages,
  };
}

async function startCreatorStream(stream = activeChannelStream.value) {
  if (!ensureLoggedInForInteraction("Melde dich an, um einen Stream zu starten.")) {
    return;
  }

  if (currentUser.value?.role !== "creator") {
    addSystemMessage("Nur Creator-Konten können Streams starten.");
    return;
  }

  streamControlStatus.value = "submitting";

  try {
    const response = await fetch(`/api/streams/${stream.id}/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        creatorId: stream.creatorId ?? currentCreatorId.value,
        title: getStreamTitle(stream),
        category: stream.category,
        format: getStreamFormat(stream),
        audience: "1 Zuschauer",
      }),
    });

    if (!response.ok) {
      throw new Error("stream start failed");
    }

    const session = (await response.json()) as LiveStreamSession;
    const liveStream = buildLiveStreamFromSession(session);
    creatorLiveStreams.value = {
      ...creatorLiveStreams.value,
      [session.streamId]: liveStream,
    };
    stoppedStreamIds.value = stoppedStreamIds.value.filter((streamId) => streamId !== session.streamId);
    streamStartedAt.value = {
      ...streamStartedAt.value,
      [session.streamId]: session.startedAt,
    };
    streamControlStatus.value = "success";
    addSystemMessage(`${getChannelName(liveStream)} ist jetzt live.`);
    startWatching(liveStream);
  } catch {
    streamControlStatus.value = "error";
    addSystemMessage("Der Stream konnte gerade nicht gestartet werden.");
  }
}

async function createCreatorStream() {
  if (!ensureLoggedInForInteraction("Melde dich an, um einen Stream anzulegen.")) {
    return;
  }

  if (currentUser.value?.role !== "creator") {
    addSystemMessage("Nur Creator-Konten können neue Streams anlegen.");
    return;
  }

  if (!newStreamTitle.value.trim()) {
    newStreamStatus.value = "error";
    return;
  }

  newStreamStatus.value = "submitting";

  try {
    const response = await fetch(`/api/creator/${currentCreatorId.value}/streams`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        title: newStreamTitle.value.trim(),
        category: newStreamCategory.value,
        format: newStreamFormat.value,
        description: newStreamDescription.value.trim() || "Neuer Stream",
        theme: newStreamCategory.value === "hunde" ? "dog-one" : newStreamCategory.value === "bauernhof" ? "farm-one" : newStreamCategory.value === "aquarium" ? "fish-one" : newStreamCategory.value === "kleintiere" ? "rabbit-one" : "cat-one",
      }),
    });

    if (!response.ok) {
      throw new Error("stream creation failed");
    }

    const stream = (await response.json()) as Stream;
    creatorManagedStreams.value = [...creatorManagedStreams.value, stream];
    newStreamTitle.value = "";
    newStreamDescription.value = "";
    newStreamStatus.value = "success";
    addSystemMessage(`${getStreamTitle(stream)} wurde als neuer Stream angelegt.`);
  } catch {
    newStreamStatus.value = "error";
    addSystemMessage("Der Stream konnte gerade nicht angelegt werden.");
  }
}

async function stopCreatorStream(stream = activeChannelStream.value) {
  if (!canManageStreams.value) {
    return;
  }

  streamControlStatus.value = "submitting";

  try {
    const response = await fetch(`/api/streams/${stream.id}/stop`, {
      method: "POST",
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error("stream stop failed");
    }

    const { [stream.id]: _endedStream, ...remainingLiveStreams } = creatorLiveStreams.value;
    const { [stream.id]: _endedStart, ...remainingStartedAt } = streamStartedAt.value;
    creatorLiveStreams.value = remainingLiveStreams;
    streamStartedAt.value = remainingStartedAt;
    stoppedStreamIds.value = [...new Set([...stoppedStreamIds.value, stream.id])];

    if (watchingStreamId.value === stream.id) {
      stopWatching();
    }

    streamControlStatus.value = "success";
    addSystemMessage(`${getChannelName(stream)} ist nicht mehr live.`);
  } catch {
    streamControlStatus.value = "error";
    addSystemMessage("Der Stream konnte gerade nicht beendet werden.");
  }
}

function startWatching(stream: Stream) {
  watchingStreamId.value = stream.id;
  showReaction("▶");
}

function stopWatching() {
  watchingStreamId.value = null;
}

async function submitLogin() {
  if (!loginEmail.value || !loginPassword.value) {
    return;
  }

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: loginEmail.value,
        password: loginPassword.value,
      }),
    });

    if (!response.ok) {
      throw new Error("login failed");
    }

    applyAuth((await response.json()) as AuthResponse);
    loginPassword.value = "";
    returnAfterAuth();
  } catch {
    registrationStatus.value = "error";
    registrationMessage.value = "Login fehlgeschlagen. Prüfe E-Mail und Passwort.";
  }
}

function togglePlaySessionMenu() {
  if (!ensureLoggedInForInteraction("Melde dich an, um eine Spielsession zu buchen.")) {
    return;
  }

  selectedSupportMode.value = "session";
  isPlaySessionMenuOpen.value = !isPlaySessionMenuOpen.value;
  isDonationMenuOpen.value = false;
}

function toggleDonationMenu() {
  if (!ensureLoggedInForInteraction("Melde dich an, um diesen Kanal zu unterstützen.")) {
    return;
  }

  selectedSupportMode.value = "donation";
  isDonationMenuOpen.value = !isDonationMenuOpen.value;
  isPlaySessionMenuOpen.value = false;
  isSearchOpen.value = false;
}

function selectSubscriptionSupport() {
  if (!ensureLoggedInForInteraction("Melde dich an, um diesen Kanal zu abonnieren.")) {
    return;
  }

  selectedSupportMode.value = "subscription";
  isDonationMenuOpen.value = false;
  isPlaySessionMenuOpen.value = false;
  addSystemMessage("Abo-Auswahl geöffnet. Monatliche Unterstützung wird später mit Zahlungsanbieter verbunden.");
}

function sendDonation(amount = selectedDonationAmount.value) {
  if (!ensureLoggedInForInteraction("Melde dich an, um diesen Kanal zu unterstützen.")) {
    return;
  }

  const donorName = currentUser.value?.name || registration.value.name || "Ein Fan";
  selectedDonationAmount.value = amount;
  isDonationMenuOpen.value = false;
  interactionHint.value = "";
  treats.value += 1;
  showReaction("+");
  addSystemMessage(`${donorName} hat ${amount} EUR an ${activeChannelName.value} gespendet.`);
}

function ensureLoggedInForInteraction(message: string) {
  if (isLoggedIn.value) {
    interactionHint.value = "";
    return true;
  }

  isDonationMenuOpen.value = false;
  isPlaySessionMenuOpen.value = false;
  interactionHint.value = message;
  return false;
}

function toggleProfileMenu() {
  isProfileMenuOpen.value = !isProfileMenuOpen.value;
  isSearchOpen.value = false;
}

function closeProfileMenu() {
  isProfileMenuOpen.value = false;
}

async function logout() {
  if (authToken.value) {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: getAuthHeaders(),
    }).catch(() => undefined);
  }

  isLoggedIn.value = false;
  currentUser.value = null;
  authToken.value = "";
  isProfileMenuOpen.value = false;
  loginEmail.value = "";
  loginPassword.value = "";
  followedChannelIds.value = [];
  fanSessionClips.value = [];
  window.localStorage.removeItem(authTokenStorageKey);
  addSystemMessage("Du wurdest abgemeldet.");
  navigateTo("home");
}

async function bookPlaySession() {
  if (!ensureLoggedInForInteraction("Melde dich an, um eine Spielsession zu buchen.")) {
    return;
  }

  if (!selectedToy.value) {
    return;
  }

  playSessionStatus.value = "submitting";

  try {
    const response = await fetch("/api/channel/momo-pixel/play-sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        toyId: selectedToy.value.id,
        viewerName: currentUser.value?.name ?? "Du",
      }),
    });

    if (!response.ok) {
      throw new Error("session booking failed");
    }

    const session = (await response.json()) as PlaySession;
    playSessions.value = [...playSessions.value, session].sort((first, second) => first.position - second.position);
    isPlaySessionMenuOpen.value = false;
    playSessionStatus.value = "success";
    showReaction("●");
    addSystemMessage(
      `Spielsession mit ${session.toyLabel} gebucht (${session.price}). Du bist auf Position ${session.position}. Der Creator kann sie durchführen, verschieben oder ablehnen.`,
    );
  } catch {
    playSessionStatus.value = "error";
    addSystemMessage("Spielsession konnte gerade nicht gebucht werden.");
  }
}

async function completePlaySession(session: PlaySession) {
  if (session.status === "completed" || session.status === "refunded") {
    return;
  }

  try {
    const response = await fetch(`/api/play-sessions/${session.id}/complete`, {
      method: "POST",
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error("complete failed");
    }

    const payload = (await response.json()) as { session: PlaySession; clip?: Clip | null };
    playSessions.value = playSessions.value.map((item) => (item.id === session.id ? payload.session : item));

    if (payload.clip) {
      fanSessionClips.value = [payload.clip, ...fanSessionClips.value];
      const streamId = payload.clip.streamId ?? activeChannelStream.value.id;
      generatedChannelClips.value = {
        ...generatedChannelClips.value,
        [streamId]: [
          { title: payload.clip.title, meta: payload.clip.meta ?? `Auto-Clip · durchgeführt · ${session.price}` },
          ...(generatedChannelClips.value[streamId] ?? []),
        ],
      };
    } else {
      createPlaySessionClip({ ...session, status: "completed" });
    }

    showReaction("▶");
    addSystemMessage(`Spielsession mit ${session.toyLabel} wurde durchgeführt. Der Clip ist gespeichert.`);
  } catch {
    addSystemMessage("Spielsession konnte gerade nicht abgeschlossen werden.");
  }
}

async function rejectPlaySession(session: PlaySession) {
  if (session.status === "completed" || session.status === "refunded") {
    return;
  }

  try {
    const response = await fetch(`/api/play-sessions/${session.id}/reject`, {
      method: "POST",
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error("reject failed");
    }

    const payload = (await response.json()) as { session: PlaySession };
    playSessions.value = playSessions.value.map((item) => (item.id === session.id ? payload.session : item));
    addSystemMessage(`Spielsession mit ${session.toyLabel} wurde abgelehnt oder verschoben. Es wurde kein Clip erstellt.`);
  } catch {
    addSystemMessage("Spielsession konnte gerade nicht abgelehnt werden.");
  }
}

function showReaction(symbol: string) {
  const id = Date.now() + Math.random();
  reactions.value.push({
    id,
    symbol,
    right: 8 + Math.random() * 18,
  });

  window.setTimeout(() => {
    reactions.value = reactions.value.filter((reaction) => reaction.id !== id);
  }, 1300);
}

function addSystemMessage(message: string) {
  updateChannelChat(activeChannelStream.value.id, (messages) => [
    ...messages,
    {
      id: crypto.randomUUID(),
      author: "OnlyPaws",
      message,
      system: true,
    },
  ]);
  scrollChatToBottom();
}

function addReactionMessage(streamId: string, author: string, label: string, symbol: string) {
  updateChannelChat(streamId, (messages) => [
    ...messages,
    {
      id: crypto.randomUUID(),
      author,
      message: `${symbol} ${label}`,
    },
  ]);

  if (streamId === activeChannelStream.value.id) {
    scrollChatToBottom();
  }
}

async function scrollChatToBottom() {
  await nextTick();

  if (chatListElement.value) {
    chatListElement.value.scrollTop = chatListElement.value.scrollHeight;
  }
}

async function submitRegistration() {
  registrationStatus.value = "submitting";
  registrationMessage.value = "";
  const payload = buildRegistrationPayload();

  try {
    const response = await fetch("/api/registrations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("registration failed");
    }

    applyAuth((await response.json()) as AuthResponse);
    registrationStatus.value = "success";
    registrationMessage.value = isCreatorRegistration.value
      ? "Dein Creator-Konto ist angelegt. Du kannst jetzt Streams verwalten."
      : "Dein Fan-Konto ist angelegt. Du kannst jetzt Kanäle unterstützen und interagieren.";
    registration.value.password = "";
    await nextTick();
    window.setTimeout(() => {
      void returnAfterAuth();
    }, 600);
  } catch {
    registrationStatus.value = "error";
    registrationMessage.value =
      "Die API ist gerade nicht erreichbar. Das Formular ist vorbereitet und kann später direkt an MongoDB angebunden werden.";
  }
}

function buildRegistrationPayload(): RegistrationPayload {
  const base = {
    role: registration.value.role,
    name: registration.value.name,
    email: registration.value.email,
    password: registration.value.password,
    acceptedTerms: registration.value.acceptedTerms,
  };

  if (registration.value.role === "fan") {
    return {
      ...base,
      favoriteCategory: registration.value.favoriteCategory,
      notificationPreference: registration.value.notificationPreference,
      fanGoal: registration.value.fanGoal,
      petName: "",
      petType: "",
      streamGoal: "",
    };
  }

  return {
    ...base,
    petName: registration.value.petName,
    petType: registration.value.petType,
    creatorType: registration.value.creatorType,
    streamFrequency: registration.value.streamFrequency,
    streamGoal: registration.value.streamGoal,
    hasStreamingSetup: registration.value.hasStreamingSetup,
  };
}
</script>

<template>
  <header class="topbar">
    <div class="brand-area">
      <a class="brand" href="#/" aria-label="OnlyPaws Startseite" @click.prevent="navigateTo('home')">
        <img class="brand-mark" src="/assets/onlypaws-logo-v2.svg" alt="" aria-hidden="true" />
        <span class="brand-wordmark">OnlyPaws</span>
      </a>
    </div>

    <div class="nav-center">
      <form class="nav-search" role="search" @submit.prevent="submitGlobalSearch">
        <label class="sr-only" for="siteSearch">Suche</label>
        <input
          id="siteSearch"
          v-model="searchQuery"
          type="search"
          placeholder="Suchen"
          autocomplete="off"
          @focus="isSearchOpen = true"
          @keydown.esc="isSearchOpen = false"
        />
        <button type="submit" aria-label="Suche starten" title="Suche starten">
          ⌕
        </button>
        <div v-if="isSearchOpen && searchQuery" class="search-popover">
          <div class="search-results">
            <button
              v-for="stream in searchResults"
              :key="stream.id"
              type="button"
              @click="openSearchResult(stream)"
            >
              <strong>{{ getStreamTitle(stream) }}</strong>
              <span>
                {{ getChannelName(stream) }} · {{ getDiscoveryStatusLabel(stream) }} · {{ stream.audience }} · {{ getStreamFormatLabel(getStreamFormat(stream)) }} ·
                {{ stream.description }}
              </span>
            </button>
            <p v-if="searchResults.length === 0">Keine passenden Kanäle gefunden.</p>
          </div>
        </div>
      </form>
    </div>

    <div class="actions">
      <nav class="nav" aria-label="Hauptnavigation">
        <a
          href="#/stoebern"
          :class="{ active: currentPage === 'browse' }"
          @click.prevent="navigateTo('browse')"
        >
          Entdecken
        </a>
        <a
          v-for="item in navItems"
          :key="item.route"
          href="#/so-funktionierts"
          :class="{ active: currentPage === item.route }"
          @click.prevent="navigateTo(item.route)"
        >
          {{ item.label }}
        </a>
      </nav>
      <div v-if="isLoggedIn" class="profile-menu" @click.stop>
        <button
          class="profile-trigger"
          type="button"
          aria-label="Profilmenü öffnen"
          :aria-expanded="isProfileMenuOpen"
          aria-haspopup="menu"
          @click="toggleProfileMenu"
        >
          <span class="profile-icon" aria-hidden="true"></span>
        </button>
        <div v-if="isProfileMenuOpen" class="profile-dropdown" role="menu">
          <button type="button" role="menuitem" @click="navigateTo('profile')">
            <strong>Mein Profil</strong>
            <span>Konto, Favoriten und Aktivität</span>
          </button>
          <button type="button" role="menuitem" @click="navigateTo('profile')">
            <strong>Abonnements</strong>
            <span>Aktive Abos und Unterstützung</span>
          </button>
          <button type="button" role="menuitem" @click="navigateTo('profile')">
            <strong>Folge ich (Favoriten)</strong>
            <span>Favoriten und Live-Status</span>
          </button>
          <button type="button" role="menuitem" @click="navigateTo('profile')">
            <strong>Einstellungen</strong>
            <span>Zahlungsmethoden verwalten</span>
          </button>
          <button class="logout-item" type="button" role="menuitem" @click="logout">
            Abmelden
          </button>
        </div>
      </div>
      <a v-else class="primary-button" href="#/anmelden" @click.prevent="openSignup('login')">Anmelden</a>
    </div>
  </header>

  <main v-if="isHomePage">
    <section class="hero" aria-label="OnlyPaws Livestream Portal">
      <img
        src="/assets/onlypaws-hero.png"
        alt="Katze und Hund in einem gemütlichen Streaming-Raum"
      />
      <div class="hero-shade"></div>
      <div class="hero-content">
        <p class="eyebrow">248 Streams jetzt live</p>
        <h1>OnlyPaws</h1>
        <p class="hero-copy">
          Schau süßen Tieren live beim Spielen, Schlafen, Schnüffeln und Quatschmachen zu.
          Unterstütze deine Lieblingskanäle direkt mit Spenden, Abos und gebuchten Spielsessions.
        </p>
        <div class="hero-controls" aria-label="Schnellaktionen">
          <a class="primary-button large" href="#live-kanaele" @click.prevent="scrollToLiveChannels">
            Live-Kanäle ansehen
          </a>
          <a class="ghost-button" href="#/anmelden" @click.prevent="openCreatorSignup">Creator werden</a>
        </div>
        <div class="hero-stats" aria-label="Plattform Statistiken">
          <span><strong>1.8 Mio.</strong> Pfoten-Fans</span>
          <span><strong>92%</strong> Shelter-Drops</span>
          <span><strong>24/7</strong> Moderation</span>
        </div>
      </div>
    </section>

    <section
      class="watch-layout"
      id="streams"
      :class="{ 'theater-mode': isTheaterMode }"
      aria-label="Livestream Bereich"
    >
      <div class="live-stage">
        <div class="stage-header">
          <div>
            <p class="status"><span></span> Live seit 42 Minuten</p>
            <h2>Momo & Pixel: Studio-Snackrunde</h2>
          </div>
          <button class="follow-button" :class="{ 'is-following': isFollowing }" type="button" @click="toggleFollow">
            {{ isFollowing ? "Folge ich" : "Folgen" }}
          </button>
        </div>
        <p v-if="interactionHint" class="interaction-hint">
          {{ interactionHint }}
          <button type="button" @click="openSignup('login', undefined, true)">Anmelden</button>
        </p>

        <div
          ref="videoElement"
          class="video-window video-link"
          role="button"
          tabindex="0"
          aria-label="Zur Kanalseite von Momo und Pixel"
          @click="openStreamChannel(activeChannelStream)"
          @keydown.enter="openStreamChannel(activeChannelStream)"
        >
          <div class="camera-label">Snackcam 02</div>
          <div class="viewer-count">{{ formattedViewers }}</div>
          <div class="pet-scene" aria-hidden="true">
            <div class="cat">
              <span class="ear left"></span>
              <span class="ear right"></span>
              <span class="face">
                <i></i>
                <i></i>
              </span>
            </div>
            <div class="dog">
              <span class="ear left"></span>
              <span class="ear right"></span>
              <span class="face">
                <i></i>
                <i></i>
              </span>
            </div>
            <div class="treat-bowl"></div>
          </div>
          <div class="reaction-float" aria-live="polite">
            <span
              v-for="reaction in reactions"
              :key="reaction.id"
              :style="{ right: `${reaction.right}%` }"
            >
              {{ reaction.symbol }}
            </span>
          </div>
          <div class="player-controls" aria-label="Player-Steuerung" @click.stop>
            <button
              type="button"
              :aria-label="isMuted ? 'Ton einschalten' : 'Ton ausschalten'"
              :title="isMuted ? 'Ton einschalten' : 'Ton ausschalten'"
              @click="toggleMute"
            >
              <span aria-hidden="true">{{ isMuted ? "♪" : "♪" }}</span>
            </button>
            <label class="volume-control" title="Lautstärke">
              <span>{{ isMuted ? 0 : volume }}</span>
              <input
                v-model.number="volume"
                type="range"
                min="0"
                max="100"
                aria-label="Lautstärke"
                @input="isMuted = volume === 0"
              />
            </label>
            <button type="button" aria-label="Theatermodus" title="Theatermodus" @click="toggleTheaterMode">
              <span aria-hidden="true">▭</span>
            </button>
            <button
              type="button"
              :aria-label="isFullscreen ? 'Vollbild schließen' : 'Vollbild öffnen'"
              :title="isFullscreen ? 'Vollbild schließen' : 'Vollbild öffnen'"
              @click="toggleFullscreen"
            >
              <span aria-hidden="true">⛶</span>
            </button>
          </div>
        </div>

        <div class="teaser-support" id="interaktionen" aria-label="Verfügbare Unterstützung">
          <span>Unterstützung</span>
          <small>Spenden · Abos · Spielsessions</small>
        </div>

        <div class="stream-meta" aria-label="Stream-Kategorien">
          <button
            v-for="format in streamFormats"
            :key="`tag-${format.value}`"
            type="button"
            @click="openBrowseFormat(format.value)"
          >
            {{ format.label }}
          </button>
        </div>
      </div>

      <aside class="side-panel" aria-label="Chat Vorschau">
        <section class="chat-panel teaser-chat" aria-label="Chat Vorschau">
          <div class="chat-list" aria-live="polite">
            <p v-for="chat in activeChatMessages.slice(-4)" :key="chat.id" :class="{ 'system-message': chat.system }">
              <strong>{{ chat.author }}:</strong> {{ chat.message }}
            </p>
          </div>
          <div class="chat-reactions" aria-label="Chat Reactions">
            <button
              v-for="reaction in chatReactions"
              :key="`home-chat-${reaction.label}`"
              type="button"
              :aria-label="reaction.label"
              :title="reaction.label"
              @click="openStreamChannel(activeChannelStream)"
            >
              {{ reaction.symbol }}
            </button>
          </div>
          <form class="chat-form" @submit.prevent="openStreamChannel(activeChannelStream)">
            <label class="sr-only" for="chatMessage">Chatnachricht</label>
            <input
              id="chatMessage"
              type="text"
              placeholder="Sag etwas Nettes..."
              autocomplete="off"
              readonly
              @focus="openStreamChannel(activeChannelStream)"
              @click="openStreamChannel(activeChannelStream)"
            />
            <button type="submit" aria-label="Nachricht senden">➜</button>
          </form>
        </section>
      </aside>

      <section class="next-timeline" aria-label="Nächste Highlights">
        <div class="timeline-heading">
          <h2>Als nächstes</h2>
          <span>heute</span>
        </div>
        <ol>
          <li v-for="item in nextItems" :key="item.id">
            <span>{{ item.time }}</span>
            <div>
              <strong>{{ item.title }}</strong>
              <small>{{ item.meta }}</small>
            </div>
          </li>
        </ol>
      </section>
    </section>

    <section id="live-kanaele" class="live-preview-section" aria-label="Live Kanäle Vorschau">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Jetzt Live</p>
          <h2>Kanäle</h2>
        </div>
      </div>
      <div class="live-preview-grid">
        <button
          v-for="stream in livePreviewStreams"
          :key="stream.id"
          class="stream-card preview-card"
          type="button"
          @click="openSearchResult(stream)"
        >
          <div class="thumb" :class="stream.theme">
            <span :class="{ offline: !isCreatorLive(stream) }">{{ isCreatorLive(stream) ? "LIVE" : "OFFLINE" }}</span>
            <em>{{ getCreatorLiveCount(stream) }} {{ getCreatorLiveCount(stream) === 1 ? "Stream" : "Streams" }}</em>
          </div>
          <h3>{{ getChannelName(stream) }}</h3>
          <p>{{ getStreamTitle(stream) }}</p>
          <small>{{ stream.audience }} · {{ getStreamFormatLabel(getStreamFormat(stream)) }}</small>
          <small>{{ stream.description }}</small>
        </button>
      </div>
    </section>

    <section class="category-directory" aria-label="Streams nach Kategorie">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Entdecken</p>
          <h2>Streams nach Kategorie</h2>
        </div>
      </div>

      <div class="category-shelves">
        <section
          v-for="category in formatShelves"
          :id="`format-${category.value}`"
          :key="category.value"
          class="category-shelf"
        >
          <div class="shelf-heading">
            <button type="button" @click="openBrowseFormat(category.value)">
              {{ category.label }}
            </button>
            <span>{{ category.streams.length }} live</span>
          </div>
          <div class="stream-row">
            <button
              v-for="stream in category.streams"
              :key="`shelf-${stream.id}`"
              class="stream-card compact-card"
              type="button"
              @click="openSearchResult(stream)"
            >
              <div class="thumb" :class="stream.theme">
                <span :class="{ offline: !isChannelLive(stream) }">{{ isChannelLive(stream) ? "LIVE" : "OFFLINE" }}</span>
                <em>{{ isChannelLive(stream) ? "Vorschau" : "Kanal" }}</em>
              </div>
              <h3>{{ getStreamTitle(stream) }}</h3>
              <p>{{ getChannelName(stream) }}</p>
              <small>{{ stream.audience }} · {{ getStreamFormatLabel(getStreamFormat(stream)) }}</small>
              <small>{{ stream.description }}</small>
            </button>
            <p v-if="category.streams.length === 0" class="empty-streams row-empty">
              Gerade kein Stream in dieser Kategorie live.
            </p>
          </div>
        </section>
      </div>
    </section>

    <section class="feature-band" aria-label="OnlyPaws Features">
      <div class="feature-lead">
        <div>
          <p class="eyebrow">Warum OnlyPaws</p>
          <h2>Süße Tiere live sehen und sinnvoll unterstützen.</h2>
        </div>
        <p>
          OnlyPaws verbindet entspannte Tier-Livestreams mit direkter Unterstützung:
          Fans helfen per Spende, Abo oder Spielsession, Creator behalten Tierwohl und Kontrolle im Blick.
        </p>
      </div>
      <article>
        <span>01</span>
        <h3>Süße Live-Momente</h3>
        <p>Fans schauen Katzen, Hunden, Kleintieren, Aquarien oder Hofstreams live zu.</p>
      </article>
      <article>
        <span>02</span>
        <h3>Spenden & Abos</h3>
        <p>Lieblingskanäle lassen sich direkt unterstützen, einmalig per Spende oder regelmäßig per Abo.</p>
      </article>
      <article>
        <span>03</span>
        <h3>Tierwohl zuerst</h3>
        <p>Ruhezeiten, Moderation und klare Regeln sind fest in jede Unterstützung eingebaut.</p>
      </article>
    </section>

    <section class="creator-strip" id="creator">
      <div>
        <p class="eyebrow">Für Tiermenschen</p>
        <h2>Starte einen Stream für deine Fellcrew.</h2>
      </div>
      <p>
        Profile, Sendeplan, Moderation, Trinkgeld für Tierheime und sichere Community-Werkzeuge
        sind bereits mitgedacht.
      </p>
      <a class="primary-button" href="#/anmelden" @click.prevent="openCreatorSignup">Creator werden</a>
    </section>

    <section class="pricing-band" id="abo" aria-label="Abo Modelle">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Abo ohne Drama</p>
          <h2>Fan werden, Tiere feiern.</h2>
        </div>
        <p>Monatlich kündbar, klare Regeln, keine lauten Popups.</p>
      </div>
      <div class="pricing-grid">
        <article v-for="plan in pricingPlans" :key="plan.id" :class="{ featured: plan.featured }">
          <h3>{{ plan.name }}</h3>
          <strong>{{ plan.price }}</strong>
          <p>{{ plan.description }}</p>
        </article>
      </div>
    </section>
  </main>

  <main v-else-if="isChannelPage">
    <section class="channel-page" aria-label="Kanalseite Momo und Pixel">
      <div class="channel-layout" :class="{ 'theater-mode': isTheaterMode }">
        <div class="channel-info-bar">
            <section class="stream-summary" aria-label="Aktueller Stream">
              <div>
                <p class="status" :class="{ offline: !isActiveChannelLive }">
                  <span></span> {{ isActiveChannelLive ? activeLiveSinceLabel : "Gerade offline" }}
                </p>
                <h2>{{ getStreamTitle(activeChannelStream) }}</h2>
                <p>{{ activeChannelStream.description }}</p>
                <div class="stream-summary-meta">
                  <small>{{ isActiveChannelLive ? formattedViewers : "Kanal offline" }}</small>
                  <small>{{ getStreamFormatLabel(getStreamFormat(activeChannelStream)) }}</small>
                </div>
                <div class="channel-tags">
                  <button
                    v-for="tag in activeChannelTags"
                    :key="`${tag.type}-${tag.value}`"
                    type="button"
                    @click="handleChannelTagClick(tag)"
                  >
                    {{ tag.label }}
                  </button>
                </div>
              </div>
              <div v-if="canManageActiveStream" class="creator-stream-actions">
                <button v-if="isActiveChannelLive" type="button" @click="stopCreatorStream(activeChannelStream)">
                  Beenden
                </button>
                <button v-else type="button" class="primary" @click="startCreatorStream(activeChannelStream)">
                  Starten
                </button>
              </div>
            </section>
            <section class="creator-summary" aria-label="Creator">
              <div class="channel-avatar">{{ getChannelInitials(activeChannelName) }}</div>
              <div>
                <p class="eyebrow">Creator Kanal</p>
                <h1 class="verified-heading">
                  {{ activeChannelName }}
                  <span class="verified-icon" aria-label="Verifizierter Kanal" title="Verifizierter Kanal">✓</span>
                </h1>
                <button
                  v-if="activeCreatorLiveStreams.length > 1"
                  type="button"
                  class="stream-count-pill"
                  @click="scrollToCreatorStreams"
                >
                  {{ activeCreatorLiveStreams.length }} Streams live
                </button>
                <button class="follow-button" :class="{ 'is-following': isFollowing }" type="button" @click="toggleFollow">
                  {{ isFollowing ? "Folge ich" : "Folgen" }}
                </button>
              </div>
            </section>
        </div>
        <section class="live-stage">
          <div
            ref="videoElement"
            class="video-window channel-video"
            role="button"
            tabindex="0"
            :aria-label="isActiveChannelWatching ? 'Laufender Livestream' : 'Stream starten'"
            @click="startWatching(activeChannelStream)"
            @keydown.enter="startWatching(activeChannelStream)"
          >
            <div v-if="isActiveChannelLive" class="viewer-count">LIVE</div>
            <div v-else class="viewer-count">OFFLINE</div>
            <div class="pet-scene" aria-hidden="true">
              <div class="cat">
                <span class="ear left"></span>
                <span class="ear right"></span>
                <span class="face">
                  <i></i>
                  <i></i>
                </span>
              </div>
              <div class="dog">
                <span class="ear left"></span>
                <span class="ear right"></span>
                <span class="face">
                  <i></i>
                  <i></i>
                </span>
              </div>
              <div class="treat-bowl"></div>
            </div>
            <div class="reaction-float" aria-live="polite">
              <span
                v-for="reaction in reactions"
                :key="`channel-${reaction.id}`"
                :style="{ right: `${reaction.right}%` }"
              >
                {{ reaction.symbol }}
              </span>
            </div>
            <div class="watch-state-badge">
              {{ isActiveChannelWatching ? "Läuft" : "Stream starten" }}
            </div>
            <div class="player-controls" aria-label="Player-Steuerung" @click.stop>
              <button
                type="button"
                :aria-label="isMuted ? 'Ton einschalten' : 'Ton ausschalten'"
                :title="isMuted ? 'Ton einschalten' : 'Ton ausschalten'"
                @click="toggleMute"
              >
                <span aria-hidden="true">{{ isMuted ? "♪" : "♪" }}</span>
              </button>
              <label class="volume-control" title="Lautstärke">
                <span>{{ isMuted ? 0 : volume }}</span>
                <input
                  v-model.number="volume"
                  type="range"
                  min="0"
                  max="100"
                  aria-label="Lautstärke"
                  @input="isMuted = volume === 0"
                />
              </label>
              <button type="button" aria-label="Theatermodus" title="Theatermodus" @click="toggleTheaterMode">
                <span aria-hidden="true">▭</span>
              </button>
              <button
                type="button"
                :aria-label="isFullscreen ? 'Vollbild schließen' : 'Vollbild öffnen'"
                :title="isFullscreen ? 'Vollbild schließen' : 'Vollbild öffnen'"
                @click="toggleFullscreen"
              >
                <span aria-hidden="true">⛶</span>
              </button>
            </div>
          </div>
          <section
            v-if="activeCreatorOtherStreams.length"
            id="creator-stream-switcher"
            class="creator-stream-switcher"
            aria-label="Weitere Streams dieses Creators"
          >
            <div class="switcher-heading">
              <strong>Weitere laufende Streams von {{ activeChannelName }}</strong>
              <span>{{ activeCreatorLiveStreams.length }} Streams live</span>
            </div>
            <div class="creator-stream-tabs">
              <button
                v-for="stream in activeCreatorOtherStreams"
                :key="`related-${stream.id}`"
                type="button"
                :class="{ 'is-live': isChannelLive(stream) }"
                @click="openStreamChannel(stream)"
              >
                <span>LIVE</span>
                <strong>{{ getStreamTitle(stream) }}</strong>
                <small>{{ getStreamFormatLabel(getStreamFormat(stream)) }} · {{ stream.audience }}</small>
              </button>
            </div>
          </section>
          <div class="channel-action-bar" aria-label="Kanalaktionen">
            <div class="support-copy">
              <p class="eyebrow">Aktionen</p>
              <strong>{{ activeChannelName }} unterstützen oder interagieren</strong>
            </div>
            <div class="channel-action-buttons">
              <button
                type="button"
                :class="{ active: selectedSupportMode === 'donation' && isDonationMenuOpen }"
                :aria-expanded="isDonationMenuOpen"
                @click="toggleDonationMenu"
              >
                Spende
              </button>
              <button
                type="button"
                :class="{ active: selectedSupportMode === 'subscription' }"
                @click="selectSubscriptionSupport"
              >
                Abo
              </button>
              <button
                type="button"
                :class="{ active: selectedSupportMode === 'session' && isPlaySessionMenuOpen }"
                :aria-expanded="isPlaySessionMenuOpen"
                @click="togglePlaySessionMenu"
              >
                Spielsession
              </button>
            </div>
          </div>
          <p v-if="interactionHint" class="interaction-hint">
            {{ interactionHint }}
            <button type="button" @click="openSignup('login', undefined, true)">Anmelden</button>
          </p>
          <div v-if="isDonationMenuOpen" class="support-popover" aria-label="Spendenbetrag auswählen">
            <p>Wie viel möchtest du {{ activeChannelName }} unterstützen?</p>
            <div class="donation-options">
              <button
                v-for="amount in donationAmounts"
                :key="`channel-donation-${amount}`"
                type="button"
                :class="{ active: selectedDonationAmount === amount }"
                @click="selectedDonationAmount = amount"
              >
                {{ amount }} EUR
              </button>
            </div>
            <button type="button" class="primary-button" @click="sendDonation()">
              {{ selectedDonationAmount }} EUR spenden
            </button>
          </div>
          <div v-if="selectedSupportMode === 'subscription' && !isDonationMenuOpen && !isPlaySessionMenuOpen" class="support-popover" aria-label="Abo auswählen">
            <p>Regelmäßig unterstützen und als Fan sichtbar bleiben.</p>
            <div class="subscription-options">
              <button v-for="plan in pricingPlans" :key="`support-${plan.id}`" type="button">
                <strong>{{ plan.name }}</strong>
                <span>{{ plan.price }}</span>
              </button>
            </div>
          </div>
          <div v-if="isPlaySessionMenuOpen" class="play-session-popover" aria-label="Spielsession buchen">
            <label>
              {{ activeChannelName }} Lieblingsspielzeug
              <select v-model="selectedToyId">
                <option v-for="toy in creatorToys" :key="toy.id" :value="toy.id">
                  {{ toy.label }} · {{ toy.sessionPrice }}
                </option>
              </select>
            </label>
            <p>{{ selectedToy?.description }}</p>
            <button
              type="button"
              class="primary-button"
              :disabled="playSessionStatus === 'submitting'"
              @click="bookPlaySession"
            >
              {{ playSessionStatus === "submitting" ? "Wird gebucht..." : "Spielsession buchen" }}
            </button>
          </div>
        </section>

        <section class="chat-panel channel-chat" aria-label="Kanal Livechat">
            <div ref="chatListElement" class="chat-list" aria-live="polite">
              <p v-for="chat in activeChatMessages" :key="`channel-${chat.id}`" :class="{ 'system-message': chat.system }">
                <strong>{{ chat.author }}:</strong> {{ chat.message }}
              </p>
            </div>
            <div class="chat-reactions" aria-label="Chat Reactions">
              <button
                v-for="reaction in chatReactions"
                :key="`channel-chat-${reaction.label}`"
                type="button"
                :aria-label="reaction.label"
                :title="reaction.label"
                @click="sendChatReaction(reaction.label, reaction.symbol)"
              >
                {{ reaction.symbol }}
              </button>
            </div>
            <form class="chat-form" @submit.prevent="sendMessage">
              <label class="sr-only" for="channelChatMessage">Chatnachricht</label>
              <input
                id="channelChatMessage"
                v-model="chatInput"
                type="text"
                placeholder="Sag etwas Nettes..."
                autocomplete="off"
              />
              <button type="submit" aria-label="Nachricht senden">➜</button>
            </form>
        </section>

        <section class="next-timeline channel-timeline" aria-label="Nächste Spielsessions">
          <div class="timeline-heading">
            <h2>Als nächstes</h2>
            <span>heute</span>
          </div>
          <ol>
            <li v-for="item in nextItems" :key="`channel-${item.id}`">
              <span>{{ item.time }}</span>
              <div>
                <strong>{{ item.title }}</strong>
                <small>{{ item.meta }}</small>
              </div>
            </li>
          </ol>
        </section>

        <section class="channel-modules">
          <article class="queue-panel">
            <div class="panel-title">
              <h2>Über den Kanal</h2>
            </div>
            <p class="channel-panel-copy">{{ activeChannelDescription }}</p>
          </article>
          <article class="queue-panel">
            <div class="panel-title">
              <h2>Tierwohl-Regeln</h2>
              <span>Creator</span>
            </div>
            <ul class="safety-list">
              <li>Keine Interaktion während Ruhezeiten</li>
              <li>Nur vom Creator freigegebene Spielzeuge</li>
              <li>Chat wird moderiert und tierwohlfeindliche Wünsche werden blockiert</li>
            </ul>
          </article>
          <article class="queue-panel">
            <div class="panel-title">
              <h2>Clips</h2>
              <span>Highlights</span>
            </div>
            <div class="clip-list">
              <button v-for="clip in activeChannelClips" :key="clip.title" type="button">
                <strong>{{ clip.title }}</strong>
                <span>{{ clip.meta }}</span>
              </button>
            </div>
          </article>
          <article class="queue-panel">
            <div class="panel-title">
              <h2>Moderation</h2>
              <span>Community</span>
            </div>
            <p class="channel-panel-copy">Melde auffällige Nachrichten, Stresswünsche oder unpassende Interaktionen.</p>
            <button type="button" class="moderation-action" @click="reportChannelContent">Kanalverlauf melden</button>
          </article>
        </section>
      </div>
    </section>
  </main>

  <main v-else-if="isProfilePage">
    <section class="profile-page" aria-label="Profilbereich">
      <div class="profile-header">
        <div class="channel-avatar">DU</div>
        <div>
          <p class="eyebrow">Dein Profil</p>
          <h1>{{ registration.name || "OnlyPaws Fan" }}</h1>
          <p>{{ currentUser?.email || registration.email || loginEmail || "fan@onlypaws.local" }}</p>
        </div>
      </div>

      <div class="profile-grid">
        <article class="queue-panel">
          <div class="panel-title">
            <h2>Gefolgte Kanäle</h2>
            <span>{{ followedChannels.length }}</span>
          </div>
          <div v-if="followedChannels.length" class="followed-list">
            <article
              v-for="stream in followedChannels"
              :key="`followed-${stream.id}`"
              :class="{ 'is-live': isChannelLive(stream), 'is-offline': !isChannelLive(stream) }"
            >
              <button type="button" @click="openStreamChannel(stream)">
                <span class="followed-channel-heading">
                  <strong>{{ getChannelName(stream) }}</strong>
                  <small>{{ isChannelLive(stream) ? "LIVE" : "Offline" }}</small>
                </span>
                <span v-if="isChannelLive(stream)">{{ getStreamTitle(stream) }}</span>
                <span v-else>Gerade nicht live</span>
                <small v-if="isChannelLive(stream)">
                  {{ stream.audience }} · {{ getStreamFormatLabel(getStreamFormat(stream)) }}
                </small>
                <small v-else>Benachrichtigung beim nächsten Stream</small>
              </button>
              <button type="button" aria-label="Kanal nicht mehr folgen" title="Nicht mehr folgen" @click="unfollowChannel(stream)">
                ×
              </button>
            </article>
          </div>
          <div v-else class="empty-profile-state">
            <p>Noch keine gefolgten Kanäle.</p>
            <button type="button" class="primary-button" @click="navigateTo('browse')">Kanäle finden</button>
          </div>
        </article>
        <article class="queue-panel">
          <div class="panel-title">
            <h2>Abonnements</h2>
            <span>aktiv</span>
          </div>
          <div class="creator-toys">
            <span>Momo & Pixel · Pfotenfan</span>
            <span>Aquarium Zen · Ruhe-Abo</span>
          </div>
        </article>
        <article class="queue-panel">
          <div class="panel-title">
            <h2>Spielsessions</h2>
            <span>{{ playSessions.length }} Queue</span>
          </div>
          <ol class="session-queue">
            <li v-for="session in playSessions.slice(0, 3)" :key="`profile-${session.id}`">
              <strong>{{ session.toyLabel }}</strong>
              <span>{{ session.price }} · {{ session.status === "completed" ? "durchgeführt" : session.status === "refunded" ? "abgelehnt" : session.status === "active" ? "läuft" : "gebucht" }}</span>
            </li>
          </ol>
        </article>
        <article class="queue-panel">
          <div class="panel-title">
            <h2>Gespeicherte Clips</h2>
            <span>{{ fanSessionClips.length }}</span>
          </div>
          <div v-if="fanSessionClips.length" class="clip-list">
            <button v-for="clip in fanSessionClips" :key="clip.id" type="button">
              <strong>{{ clip.title }}</strong>
              <span>{{ clip.channelName || clip.creatorId }} · {{ clip.meta || `${clip.duration} · ${clip.views}` }}</span>
            </button>
          </div>
          <div v-else class="empty-profile-state">
            <p>Noch keine gespeicherten Clips.</p>
          </div>
        </article>
        <article class="queue-panel">
          <div class="panel-title">
            <h2>Unterstützungsverlauf</h2>
            <span>30 Tage</span>
          </div>
          <div class="support-history">
            <span>5 EUR Spende · Momo & Pixel</span>
            <span>Spielsession · Katzenangel</span>
            <span>Abo · Aquarium Zen</span>
          </div>
        </article>
        <article class="queue-panel">
          <div class="panel-title">
            <h2>Benachrichtigungen</h2>
            <span>getrennt</span>
          </div>
          <div class="notification-settings">
            <label><input type="checkbox" checked /> Gefolgte Kanäle gehen live</label>
            <label><input type="checkbox" checked /> Spielsessions werden frei</label>
            <label><input type="checkbox" /> Abo-Updates und Creator-Posts</label>
          </div>
        </article>
        <article class="queue-panel">
          <div class="panel-title">
            <h2>Konto</h2>
            <span>{{ currentUser?.role === "creator" ? "Creator" : "Fan" }}</span>
          </div>
          <p class="channel-panel-copy">
            Profiltyp, Benachrichtigungen und Lieblingskanäle werden später dauerhaft im Account
            gespeichert.
          </p>
        </article>
        <article class="queue-panel">
          <div class="panel-title">
            <h2>Einstellungen</h2>
            <span>Zahlung</span>
          </div>
          <div class="payment-methods">
            <span>Visa ···· 4242</span>
            <span>PayPal verbunden</span>
            <button type="button">Zahlungsmethode hinzufügen</button>
          </div>
        </article>
        <article v-if="currentUser?.role === 'creator'" class="queue-panel creator-studio-card">
          <div class="panel-title">
            <h2>Creator Studio</h2>
            <span>Kontrolle</span>
          </div>
          <div class="creator-studio-grid">
            <label>
              Kanalbeschreibung
              <textarea rows="3" :value="activeChannelDescription"></textarea>
            </label>
            <label>
              Ruhezeiten
              <input type="text" value="13:00-15:00, 22:00-08:00" />
            </label>
            <label>
              Chatmodus
              <select>
                <option>Follower-only</option>
                <option>Alle</option>
                <option>Abonnenten</option>
              </select>
            </label>
            <label>
              Sessions pro Stunde
              <input type="number" value="3" min="0" />
            </label>
          </div>
          <div class="stream-start-board">
            <div class="panel-title">
              <h3>Deine Streams</h3>
              <span>{{ creatorManagedStreamsWithLiveState.filter((stream) => isChannelLive(stream)).length }} live</span>
            </div>
            <div class="creator-stream-list">
              <article
                v-for="stream in creatorManagedStreamsWithLiveState"
                :key="`creator-stream-${stream.id}`"
                :class="{ 'is-live': isChannelLive(stream) }"
              >
                <button type="button" class="creator-stream-meta" @click="openStreamChannel(stream)">
                  <strong>{{ getStreamTitle(stream) }}</strong>
                  <span>{{ getStreamCategoryLabel(stream.category) }} · {{ getStreamFormatLabel(getStreamFormat(stream)) }}</span>
                  <small>{{ isChannelLive(stream) ? `${stream.audience} · ${getLiveSinceLabel(stream)}` : "Bereit zum Starten" }}</small>
                </button>
                <button
                  v-if="isChannelLive(stream)"
                  type="button"
                  class="stream-stop-button"
                  :disabled="streamControlStatus === 'submitting'"
                  @click="stopCreatorStream(stream)"
                >
                  Beenden
                </button>
                <button
                  v-else
                  type="button"
                  class="stream-start-button"
                  :disabled="streamControlStatus === 'submitting'"
                  @click="startCreatorStream(stream)"
                >
                  Starten
                </button>
              </article>
            </div>
            <div class="panel-title stream-create-title">
              <h3>Neuen Stream anlegen</h3>
            </div>
            <div class="stream-start-grid">
              <label>
                Streamtitel
                <input v-model="newStreamTitle" type="text" placeholder="z. B. Ponybox Abendrunde" />
              </label>
              <label>
                Tierbereich
                <select v-model="newStreamCategory">
                  <option v-for="category in streamCategoryOptions" :key="category.value" :value="category.value">
                    {{ category.label }}
                  </option>
                </select>
              </label>
              <label>
                Format
                <select v-model="newStreamFormat">
                  <option v-for="format in streamFormats" :key="format.value" :value="format.value">
                    {{ format.label }}
                  </option>
                </select>
              </label>
              <button
                type="button"
                class="stream-start-button"
                :disabled="newStreamStatus === 'submitting'"
                @click="createCreatorStream"
              >
                Anlegen
              </button>
              <label class="stream-description-input">
                Beschreibung
                <input v-model="newStreamDescription" type="text" placeholder="Kurzbeschreibung fuer diesen Stream" />
              </label>
            </div>
          </div>
          <div class="creator-session-board">
            <div class="panel-title">
              <h3>Gebuchte Spielsessions</h3>
              <span>{{ playSessions.filter((session) => session.status !== "completed" && session.status !== "refunded").length }} offen</span>
            </div>
            <ol class="session-queue">
              <li v-for="session in playSessions.slice(0, 4)" :key="`creator-${session.id}`">
                <strong>{{ session.toyLabel }}</strong>
                <span>{{ session.viewerName }} · {{ session.price }} · {{ session.status === "completed" ? "durchgeführt" : session.status === "refunded" ? "abgelehnt" : session.status === "active" ? "läuft" : "gebucht" }}</span>
                <div v-if="session.status !== 'completed' && session.status !== 'refunded'" class="session-actions">
                  <button type="button" @click="completePlaySession(session)">Durchführen</button>
                  <button type="button" @click="rejectPlaySession(session)">Ablehnen</button>
                </div>
              </li>
            </ol>
          </div>
          <ul class="safety-list">
            <li v-for="rule in creatorStudioRules" :key="rule">{{ rule }}</li>
          </ul>
        </article>
      </div>
    </section>
  </main>

  <main v-else-if="isBrowsePage">
    <section class="browse-page" aria-label="Streams und Kanäle entdecken">
      <div class="browse-header">
        <p class="eyebrow">Entdecken</p>
        <h1>Finde deinen nächsten Lieblingsstream.</h1>
      </div>

      <div class="browse-layout">
        <aside class="browse-filters" aria-label="Such- und Filteroptionen">
          <div class="filter-panel-heading">
            <strong>Filter</strong>
            <button
              v-if="activeBrowseFilterChips.length"
              type="button"
              @click="clearAllBrowseFilters"
            >
              Zurücksetzen
            </button>
          </div>
          <label class="browse-search-field">
            Suche
            <input
              v-model="browseQuery"
              type="search"
              placeholder="Name, Tier, Kategorie oder Format"
              autocomplete="off"
            />
          </label>
          <label>
            Sortierung
            <select v-model="browseSort">
              <option value="recommended">Empfohlen</option>
              <option value="viewers-desc">Zuschauer absteigend</option>
              <option value="viewers-asc">Zuschauer aufsteigend</option>
              <option value="title-asc">Name A-Z</option>
              <option value="format-asc">Stream-Art A-Z</option>
            </select>
          </label>
          <label>
            Stream-Art
            <select v-model="browseFormat">
              <option value="all">Alle Stream-Arten</option>
              <option v-for="format in streamFormats" :key="format.value" :value="format.value">
                {{ format.label }}
              </option>
            </select>
          </label>
          <label>
            Zuschauer
            <select v-model="browseAudience">
              <option value="all">Alle Größen</option>
              <option value="under-5k">Unter 5k</option>
              <option value="5k-10k">5k bis 10k</option>
              <option value="10k-plus">10k+</option>
            </select>
          </label>
          <label>
            Tierart
            <select v-model="browseCategory">
              <option v-for="category in categories" :key="category.value" :value="category.value">
                {{ category.label }}
              </option>
            </select>
          </label>
        </aside>

        <section class="browse-results-panel" aria-label="Suchergebnisse">
          <div class="browse-results-heading">
            <div>
              <p class="eyebrow">Ergebnisse</p>
              <h2>{{ browseResults.length }} Kanäle und Streams</h2>
            </div>
            <div v-if="activeBrowseFilterChips.length" class="active-filter-chips" aria-label="Aktive Filter">
              <button
                v-for="chip in activeBrowseFilterChips"
                :key="`chip-${chip.id}`"
                type="button"
                @click="clearBrowseFilter(chip.id)"
              >
                {{ chip.label }} <span aria-hidden="true">×</span>
              </button>
            </div>
          </div>
          <div class="browse-results">
            <button
              v-for="stream in browseResults"
              :key="`browse-${stream.id}`"
              class="stream-card compact-card"
              type="button"
              @click="openSearchResult(stream)"
            >
              <div class="thumb" :class="stream.theme">
                <span :class="{ offline: !isChannelLive(stream) }">{{ getDiscoveryStatusLabel(stream) }}</span>
                <em>{{ getDiscoveryMetaLabel(stream) }}</em>
              </div>
              <h3>{{ getStreamTitle(stream) }}</h3>
              <p>{{ getChannelName(stream) }}</p>
              <small>{{ stream.audience }} · {{ getStreamFormatLabel(getStreamFormat(stream)) }}</small>
              <small>{{ stream.description }}</small>
            </button>
            <p v-if="browseResults.length === 0" class="empty-streams">
              Keine passenden Streams oder Kanäle gefunden.
            </p>
          </div>
        </section>
      </div>
    </section>
  </main>

  <main v-else-if="!isSignupPage">
    <section class="content-page" aria-label="OnlyPaws Unterseite">
      <div class="content-hero">
        <p class="eyebrow">{{ activeSubPage.eyebrow }}</p>
        <h1>{{ activeSubPage.title }}</h1>
        <p>{{ activeSubPage.copy }}</p>
        <div class="page-highlights">
          <span v-for="highlight in activeSubPage.highlights" :key="highlight">{{ highlight }}</span>
        </div>
      </div>

      <section class="about-intro-grid" aria-label="Was OnlyPaws bietet">
        <article>
          <p class="eyebrow">Für Fans</p>
          <h2>Live dabei sein, statt nur Videos schauen.</h2>
          <p>
            Fans entdecken süße Tiere live, schreiben im Chat, reagieren im Moment und unterstützen
            Lieblingskanäle direkt. Aus passivem Zuschauen wird ein ruhiger, freundlicher Austausch
            mit Creatorn, Tieren und Community.
          </p>
          <ul>
            <li>Livechat, Reactions und echte Stream-Momente</li>
            <li>Lieblingskanäle folgen und Live-Status sehen</li>
            <li>Per Spende, Abo oder Spielsession gezielt unterstützen</li>
            <li>Streams nach Tierart, Format und Tags entdecken</li>
          </ul>
        </article>
        <article>
          <p class="eyebrow">Für Creator</p>
          <h2>Tiere zeigen und Unterstützung erhalten.</h2>
          <p>
            Creator bekommen einen einfachen Ort, um Tiermomente live zu teilen, eine Community aufzubauen
            und Unterstützung zu erhalten. Sie bestimmen selbst, welche Interaktionen möglich sind,
            welche Spielzeuge genutzt werden und wann Ruhezeiten Vorrang haben.
          </p>
          <ul>
            <li>Eigenes Kanalprofil mit Beschreibung, Tags und Verifizierung</li>
            <li>Spenden, Abos und bezahlte Spielsessions als Support-Wege</li>
            <li>Creator kontrollieren Spielzeuge, Preise, Queue und Moderation</li>
            <li>Geeignet für Halter, Tierheime, Trainer und Höfe</li>
          </ul>
        </article>
      </section>

      <section class="about-flow" aria-label="So funktioniert OnlyPaws">
        <div>
          <p class="eyebrow">So läuft es</p>
          <h2>Vom Entdecken bis zur Unterstützung.</h2>
        </div>
        <ol>
          <li>
            <strong>Stream finden</strong>
            <span>Fans entdecken Live-Kanäle nach Tierart, Format, Tags oder Suchbegriff.</span>
          </li>
          <li>
            <strong>Live interagieren</strong>
            <span>Im Kanalchat reagieren Fans direkt, folgen dem Kanal und bleiben bei neuen Streams dran.</span>
          </li>
          <li>
            <strong>Unterstützen</strong>
            <span>Spenden, Abos und Spielsessions helfen Creatorn, ihre Tierstreams regelmäßig anzubieten.</span>
          </li>
        </ol>
      </section>

      <section class="subpage-columns">
        <article>
          <span>01</span>
          <h2>Stream-Arten</h2>
          <p>Interaktiv, 24/7 Cam, Spiel & Training sowie Pflege & Alltag helfen Fans, genau den richtigen Tiermoment zu finden.</p>
        </article>
        <article>
          <span>02</span>
          <h2>Live Interaktionen</h2>
          <p>Chat, Reactions und Spielsessions machen den Stream lebendig, bleiben aber immer durch den Creator kontrolliert.</p>
        </article>
        <article>
          <span>03</span>
          <h2>Creator-Kontrolle</h2>
          <p>Creator legen Beschreibung, Tags, Spielzeuge, Preise und Regeln fest. Tierwohl und Ruhezeiten stehen vor Interaktion.</p>
        </article>
        <article>
          <span>04</span>
          <h2>Direkte Unterstützung</h2>
          <p>Fans unterstützen Lieblingskanäle einmalig per Spende, regelmäßig per Abo oder gezielt durch eine gebuchte Spielsession.</p>
        </article>
      </section>

      <div class="about-pricing-heading">
        <p class="eyebrow">Abo</p>
        <h2>Fans unterstützen Lieblingskanäle ohne Druck.</h2>
          <p>Abos ergänzen Spenden und Spielsessions: mehr Nähe zum Kanal, optionale Extras und regelmäßige Unterstützung für Creator und Tiere.</p>
      </div>

      <section class="pricing-grid subpage-grid about-pricing" aria-label="Abo Modelle">
        <article v-for="plan in pricingPlans" :key="plan.id" :class="{ featured: plan.featured }">
          <h3>{{ plan.name }}</h3>
          <strong>{{ plan.price }}</strong>
          <p>{{ plan.description }}</p>
        </article>
      </section>
    </section>
  </main>

  <main v-else>
    <section class="signup-page" aria-label="OnlyPaws Anmeldung">
      <div class="signup-intro" :style="{ '--signup-image': `url(${signupImageUrl})` }">
        <p class="eyebrow">{{ authMode === "login" ? "Willkommen zurück" : "OnlyPaws Registrierung" }}</p>
        <h1>
          {{
            authMode === "login"
              ? "Melde dich bei OnlyPaws an."
              : isCreatorRegistration
                ? "Starte deinen Tierkanal."
                : "Folge deinen Lieblings­tieren."
          }}
        </h1>
        <p>
          {{
            authMode === "login"
              ? "Greife auf Favoriten, Profil, Spielsession-Queue und Creator-Tools zu."
              : isCreatorRegistration
              ? "Bereite dein Creator-Profil, Tierprofil und deine erste Stream-Idee vor."
              : "Erstelle dein Fan-Profil, um Kanäle zu unterstützen, mit Tieren zu interagieren und Lieblingsstreams zu begleiten."
          }}
        </p>
        <div class="signup-highlights">
          <span><strong>1</strong> {{ authMode === "login" ? "Einloggen" : "Profil anlegen" }}</span>
          <span><strong>2</strong> {{ authMode === "login" ? "Profil öffnen" : isCreatorRegistration ? "Tierprofil vorbereiten" : "Live interagieren" }}</span>
          <span><strong>3</strong> {{ authMode === "login" ? "Weiterstreamen" : isCreatorRegistration ? "Stream starten" : "Tiere unterstützen" }}</span>
        </div>
      </div>

      <div class="signup-form">
        <div class="auth-tabs" aria-label="Anmeldeart">
          <button type="button" :class="{ active: authMode === 'login' }" @click="openSignup('login')">
            Anmelden
          </button>
          <button type="button" :class="{ active: authMode === 'register' }" @click="openSignup('register')">
            Registrieren
          </button>
        </div>

        <form v-if="authMode === 'login'" class="login-form" @submit.prevent="submitLogin">
          <label>
            E-Mail
            <input v-model="loginEmail" type="email" autocomplete="email" required />
          </label>
          <label>
            Passwort
            <input v-model="loginPassword" type="password" autocomplete="current-password" required />
          </label>
          <button class="primary-button large" type="submit">In bestehendes Profil anmelden</button>
          <p class="auth-switch">
            Noch kein Profil?
            <button type="button" @click="openSignup('register')">Jetzt registrieren</button>
          </p>
        </form>

      <form v-else @submit.prevent="submitRegistration">
        <div class="form-row role-choice" aria-label="Kontotyp">
          <label :class="{ selected: registration.role === 'creator' }">
            <input v-model="registration.role" type="radio" value="creator" />
            <span>Creator</span>
            <small>Für Tierhalter, Tierheime und Höfe</small>
          </label>
          <label :class="{ selected: registration.role === 'fan' }">
            <input v-model="registration.role" type="radio" value="fan" />
            <span>Fan</span>
            <small>Für Livechat, Favoriten und Drops</small>
          </label>
        </div>

        <div class="form-grid">
          <label>
            Name
            <input v-model="registration.name" type="text" autocomplete="name" required />
          </label>
          <label>
            E-Mail
            <input v-model="registration.email" type="email" autocomplete="email" required />
          </label>
          <label>
            Passwort
            <input
              v-model="registration.password"
              type="password"
              autocomplete="new-password"
              minlength="8"
              required
            />
          </label>
        </div>

        <div v-if="!isCreatorRegistration" class="dynamic-form-section">
          <div class="form-section-heading">
            <p class="eyebrow">Fan-Profil</p>
            <h2>Welche Kanäle möchtest du unterstützen?</h2>
          </div>
          <div class="form-grid">
            <label>
              Unterstützungsbereich
              <select v-model="registration.favoriteCategory">
                <option value="alle">Alles</option>
                <option value="katzen">Katzen</option>
                <option value="hunde">Hunde</option>
                <option value="kleintiere">Kleintiere</option>
                <option value="aquarium">Aquarium</option>
                <option value="bauernhof">Bauernhof</option>
              </select>
            </label>
            <label>
              Benachrichtigungen
              <select v-model="registration.notificationPreference">
                <option value="highlights">Nur Highlights</option>
                <option value="daily">Tägliche Zusammenfassung</option>
                <option value="weekly">Wöchentliche Empfehlungen</option>
              </select>
            </label>
            <label class="wide-field">
              Wie möchtest du interagieren?
              <input
                v-model="registration.fanGoal"
                type="text"
                placeholder="Entspannung, Lieblingsstreams, Shelter-Support..."
              />
            </label>
          </div>
        </div>

        <div v-else class="dynamic-form-section">
          <div class="form-section-heading">
            <p class="eyebrow">Creator-Profil</p>
            <h2>Erzähl uns kurz von deinem Stream.</h2>
          </div>
          <div class="form-grid">
            <label>
              Tiername
              <input v-model="registration.petName" type="text" placeholder="Momo, Pixel, Bruno..." required />
            </label>
            <label>
              Tierart
              <select v-model="registration.petType" required>
                <option>Katze</option>
                <option>Hund</option>
                <option>Kleintier</option>
                <option>Aquarium</option>
                <option>Bauernhof</option>
                <option>Andere</option>
              </select>
            </label>
            <label>
              Creator-Typ
              <select v-model="registration.creatorType">
                <option value="privat">Privater Tierhaushalt</option>
                <option value="tierheim">Tierheim oder Pflegeplatz</option>
                <option value="trainer">Trainer oder Betreuung</option>
                <option value="hof">Hof oder Stall</option>
              </select>
            </label>
            <label>
              Geplante Häufigkeit
              <select v-model="registration.streamFrequency">
                <option value="taeglich">Täglich</option>
                <option value="mehrmals-pro-woche">Mehrmals pro Woche</option>
                <option value="woechentlich">Wöchentlich</option>
                <option value="gelegentlich">Gelegentlich</option>
              </select>
            </label>
            <label>
              Stream-Idee
              <input
                v-model="registration.streamGoal"
                type="text"
                placeholder="Snackcam, Parkrunde, Nap-Stream..."
                required
              />
            </label>
            <label class="toggle-line wide-field">
              <input v-model="registration.hasStreamingSetup" type="checkbox" />
              <span>Kamera, Licht oder Streaming-Setup ist bereits vorhanden.</span>
            </label>
          </div>
        </div>

        <label class="terms-line">
          <input v-model="registration.acceptedTerms" type="checkbox" required />
          <span>Ich akzeptiere die Community-Regeln und bestätige, dass Tierwohl Vorrang hat.</span>
        </label>

        <button class="primary-button large" type="submit" :disabled="registrationStatus === 'submitting'">
          {{ registrationStatus === "submitting" ? "Wird gesendet..." : "Anmeldung absenden" }}
        </button>

        <p v-if="registrationMessage" class="form-message" :class="registrationStatus">
          {{ registrationMessage }}
        </p>
      </form>
      </div>
    </section>
  </main>

  <aside v-if="showMiniPlayer && watchingStream" class="mini-player" aria-label="Weiterlaufender Stream">
    <button
      type="button"
      class="mini-video"
      :class="watchingStream.theme"
      :aria-label="`Zur Kanalseite von ${getChannelName(watchingStream)}`"
      @click="openStreamChannel(watchingStream)"
    >
      <span>LIVE</span>
      <strong>{{ watchingStream.title }}</strong>
    </button>
    <div class="mini-player-meta">
      <p>{{ getChannelName(watchingStream) }}</p>
      <small>{{ watchingStream.audience }} · läuft weiter</small>
    </div>
    <button type="button" class="mini-close" aria-label="Mini-Player schließen" @click="stopWatching">
      ×
    </button>
  </aside>
</template>
