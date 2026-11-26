// Row types for the content pipeline (migration 00023). Kept apart from
// the hand-written Database types: these tables are only ever read
// through the service client in src/lib/content/db.ts.

export type ContentKind = "reel" | "story";

export type ContentStatus =
  | "geplant"
  | "gedreht"
  | "freigabe"
  | "eingeplant"
  | "veroeffentlicht"
  | "fehler";

export type PublishState = "uploading" | "processing" | "publishing" | "done";

export type ContentClient = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  ig_username: string | null;
  va_token: string;
  va_email: string | null;
  drive_root_id: string | null;
  drive_root_url: string | null;
  reel_time: string;
  story_time: string;
  shoot_lead_days: number;
  coordinator_phone: string | null;
  research_brief: string | null;
  research_hashtags: string[];
  created_at: string;
};

export type ContentWatchAccount = {
  id: string;
  client_id: string;
  username: string;
  note: string | null;
  active: boolean;
  median_views: number | null;
  last_scraped_at: string | null;
  last_error: string | null;
  created_at: string;
};

export type InspoStatus = "neu" | "gemerkt" | "verworfen" | "request";

export type ContentInspo = {
  id: string;
  client_id: string;
  source: "scrape" | "manual";
  url: string;
  shortcode: string | null;
  owner_username: string | null;
  caption: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  duration_s: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  posted_at: string | null;
  outlier: number | null;
  ai_score: number | null;
  ai_format: string | null;
  ai_reason: string | null;
  ai_idea: string | null;
  ai_area: string | null;
  ai_risk: string | null;
  ai_at: string | null;
  status: InspoStatus;
  idea: string | null;
  item_id: string | null;
  thumb_data: string | null;
  created_at: string;
};

export type EditNote = { text: string; done: boolean };

export type ContentMember = {
  id: string;
  client_id: string;
  name: string;
  area: string;
  phone: string | null;
  token: string;
  active: boolean;
  position: number;
  created_at: string;
};

export type ContentFormat = {
  id: string;
  client_id: string;
  name: string;
  kind: ContentKind;
  area: string | null;
  description: string | null;
  shots: string[];
  tips: string | null;
  example_url: string | null;
  active: boolean;
  created_at: string;
};

export type ContentMetrics = {
  views?: number | null;
  reach?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saved?: number | null;
  interactions?: number | null;
};

export type ContentItem = {
  id: string;
  client_id: string;
  member_id: string | null;
  format_id: string | null;
  kind: ContentKind;
  area: string | null;
  title: string;
  brief: string | null;
  shots: string[];
  shoot_due: string | null;
  publish_at: string | null;
  status: ContentStatus;
  note_member: string | null;
  note_va: string | null;
  caption: string | null;
  legal_checked: boolean;
  drive_folder_id: string | null;
  drive_folder_url: string | null;
  cut_file_id: string | null;
  cut_file_name: string | null;
  cut_size: number | null;
  cut_mime: string | null;
  publish_state: PublishState | null;
  publish_started_at: string | null;
  publish_attempts: number;
  publish_error: string | null;
  ig_container_id: string | null;
  ig_media_id: string | null;
  ig_permalink: string | null;
  metrics: ContentMetrics | null;
  metrics_at: string | null;
  shot_at: string | null;
  cut_at: string | null;
  approved_at: string | null;
  published_at: string | null;
  inspo_id: string | null;
  inspo_url: string | null;
  edit_notes: EditNote[];
  created_at: string;
  updated_at: string;
};

export type ContentUpload = {
  id: string;
  item_id: string;
  kind: "raw" | "cut";
  drive_file_id: string;
  name: string | null;
  size: number | null;
  mime: string | null;
  uploaded_by: string | null;
  created_at: string;
};

export type ContentLead = {
  id: string;
  client_id: string;
  member_id: string | null;
  item_id: string | null;
  area: string | null;
  source: string;
  service: string | null;
  amount: number | null;
  paying: boolean;
  note: string | null;
  lead_date: string;
  created_at: string;
};

export const STATUS_LABEL: Record<ContentStatus, string> = {
  geplant: "Zu drehen",
  gedreht: "Im Schnitt",
  freigabe: "Zur Freigabe",
  eingeplant: "Eingeplant",
  veroeffentlicht: "Online",
  fehler: "Fehler",
};

export const STATUS_ORDER: ContentStatus[] = [
  "geplant",
  "gedreht",
  "freigabe",
  "eingeplant",
  "veroeffentlicht",
  "fehler",
];

export const KIND_LABEL: Record<ContentKind, string> = {
  reel: "Reel",
  story: "Story",
};

/** Suggestions for the area field; free text is allowed too. */
export const DEFAULT_AREAS = [
  "Bioresonanz & DNA",
  "Ernährungscoaching",
  "Kosmetik & Head Spa",
  "Zahnaufhellung",
  "Energie-Tattoos",
  "Haus & Team",
];
