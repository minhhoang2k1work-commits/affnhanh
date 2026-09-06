// =============================================================================
// Shared Types cho Bridge giữa AFF (Web) và AutoCut (Desktop)
// Định nghĩa dựa trên protocol thực tế của AutoCut WS (:8765) và REST (:8766)
// =============================================================================

// ---- Chrome Profile Management ----

export interface ChromeProfile {
  dir: string;          // "Default", "Profile 1", ...
  name: string;         // Tên hiển thị "Person 1", "Work"
  email: string;        // Email đăng nhập
  avatar_icon: string;
  is_default: boolean;
  path: string;         // Đường dẫn đầy đủ tới thư mục profile
}

export interface ChromeProfilesResponse {
  success: boolean;
  user_data_dir: string;
  profiles: ChromeProfile[];
}

// ---- Extension Status ----

export interface ExtensionStatusResponse {
  success: boolean;
  profile_dir: string;
  ext_id: string;
  installed: boolean;
  version: string;
  ext_dir: string;
}

// ---- Launch Chrome ----

export interface LaunchChromeRequest {
  profile_dir: string;
  extension_path?: string;
  start_url?: string;
}

export interface LaunchChromeResponse {
  success: boolean;
  pid?: number;
  error?: string;
}

// ---- WebSocket Status ----

export interface WsStatusResponse {
  connected: boolean;
  extension_version: string;
  required_extension_version: string;
  extension_version_supported: boolean;
  is_running: boolean;
  queue_size: number;
  batch_id: string;
  batch_status: BatchStatus;
  batch_error: string;
  batch_message: string;
  current_prompt: string;
  batch_completed_count: number;
  batch_failed_count: number;
  batch_cancelled_count: number;
  output_folder: string;
  last_batch_result: Record<string, unknown> | null;
}

export type BatchStatus = 'idle' | 'queued' | 'running' | 'completed' | 'error' | 'cancelled';

// ---- Batch Processing ----

export type WorkflowMode =
  | 'text_to_video'
  | 'frames_to_video'
  | 'ingredients_to_video'
  | 'image_edit'
  | 'video_edit'
  | 'agent';

export type BatchPlatform = 'google_flow' | 'image_gen' | 'chatgpt';

/** Asset gửi kèm prompt (ảnh start/end frame, ingredients) */
export interface BatchAsset {
  role: 'start_frame' | 'end_frame' | 'ingredient' | 'reference';
  name: string;
  type: string;         // MIME type: "image/png", "image/jpeg"
  size: number;
  dataUrl: string;      // Base64 data URL
}

/** Request khởi tạo batch cho Google Flow / Image Gen */
export interface FlowBatchRequest {
  platform: 'google_flow' | 'image_gen';
  workflow_mode: WorkflowMode;
  prompts: string[];
  output_folder: string;
  min_delay?: number;   // Giây, mặc định 20
  max_delay?: number;   // Giây, mặc định 30
  asset_paths?: string[]; // Đường dẫn file trên máy, server tự encode Base64
}

/** Request khởi tạo batch ChatGPT */
export interface ChatGPTBatchRequest {
  platform: 'chatgpt';
  action: 'chatgpt_batch';
  chatgpt_config: {
    mode: 'scenario' | 'research' | 'outline' | 'custom';
    template: string;   // VD: "Viết kịch bản về: {topic}"
    topics: string[];
    wait_sec?: number;   // Thời gian chờ response, mặc định 25
    delay_sec?: number;  // Delay giữa các topic, mặc định 8
  };
}

export type StartBatchRequest = FlowBatchRequest | ChatGPTBatchRequest;

export interface StartBatchResponse {
  success: boolean;
  batch_id: string;
  queued: number;
  message: string;
}

export interface StopBatchResponse {
  success: boolean;
  message: string;
  stopped: boolean;
  extension_notified: boolean;
}

// ---- File Organization ----

export interface OrganizeFilesRequest {
  source_folder?: string;
  project_folder?: string;
  create_project?: boolean;
  file_extensions?: string[];   // [".mp4", ".webm", ".mov"]
}

export interface OrganizeFilesResponse {
  success: boolean;
  destination: string;
  folder_name: string;
  project_folder: string;
  source_folder: string;
  files_moved: number;
  files: string[];
  errors: string[];
  run_index: number;
}

// ---- Scan Folder ----

export interface ScanFolderResponse {
  success: boolean;
  folder: string;
  files: string[];
  count: number;
}

// ---- Install Extension ----

export interface InstallExtensionRequest {
  profile_dir: string;
  extension_path?: string;
}

export interface InstallExtensionResponse {
  success: boolean;
  message: string;
  ext_id: string;
  ext_dir: string;
}

// =============================================================================
// WebSocket Protocol Messages
// Giao thức tin nhắn WebSocket giữa AFF Client <-> AutoCut Server (:8765)
// =============================================================================

// ---- Messages FROM AutoCut Server -> AFF Client ----

export interface WsHelloAck {
  action: 'hello_ack';
  message: string;
  required_version: string;
}

export interface WsRunPrompt {
  action: 'run_prompt';
  text: string;
  platform: BatchPlatform;
  request_id: string;
  workflow: {
    mode: WorkflowMode;
    outputDirectory: string;
  };
  assets?: BatchAsset[];
}

export interface WsChatGPTBatch {
  action: 'chatgpt_batch';
  mode: string;
  template: string;
  prompts: string[];
  wait_sec: number;
  delay_sec: number;
  request_id: string;
}

export interface WsStopBatch {
  action: 'stop_batch';
}

export type WsServerMessage = WsHelloAck | WsRunPrompt | WsChatGPTBatch | WsStopBatch;

// ---- Messages FROM AFF Client -> AutoCut Server ----

export interface WsHello {
  type: 'hello';
  version: string;
  status: string;
}

export interface WsHeartbeat {
  type: 'heartbeat';
  status?: string;
  timestamp?: string;
}

export interface WsLog {
  type: 'log';
  level: 'info' | 'warn' | 'error';
  message: string;
  run_id?: string;
}

export interface WsProcessing {
  type: 'processing';
  phase: string;
  message: string;
  request_id?: string;
}

export interface WsSuccess {
  type: 'success';
  files?: string[];
  file_data_base64?: string;
  download_directory?: string;
  downloads_completed?: number;
  request_id?: string;
}

export interface WsError {
  type: 'error';
  message: string;
  request_id?: string;
}

export interface WsChatGPTResult {
  type: 'chatgpt_result';
  data: {
    topic: string;
    text: string;
    timestamp: string;
  };
  index: number;
  total: number;
  request_id: string;
}

export interface WsChatGPTBatchDone {
  type: 'chatgpt_batch_done';
  results: Array<{ topic: string; text: string; timestamp: string }>;
  total: number;
  request_id: string;
}

export interface WsStartBatch {
  type: 'start_batch';
  prompts: string[];
  output_folder: string;
  min_delay: number;
  max_delay: number;
  platform: BatchPlatform;
  workflow_mode?: WorkflowMode;
  assets?: BatchAsset[];
}

export interface WsStopBatchClient {
  type: 'stop_batch';
}

export type WsClientMessage =
  | WsHello
  | WsHeartbeat
  | WsLog
  | WsProcessing
  | WsSuccess
  | WsError
  | WsChatGPTResult
  | WsChatGPTBatchDone
  | WsStartBatch
  | WsStopBatchClient;

// =============================================================================
// Video Project Exchange Format
// Format chia sẻ dự án video giữa AFF và AutoCut
// =============================================================================

export interface VideoScene {
  index: number;
  title: string;
  narration: string;           // Lời thoại
  visualPrompt: string;        // Prompt tạo video
  duration: number;            // Giây
  cameraAngle?: string;
  videoClipPath?: string;      // Đường dẫn file video clip
  voiceoverPath?: string;      // Đường dẫn file audio voiceover
  referenceImagePath?: string; // Đường dẫn ảnh tham chiếu
}

export interface VideoProjectExchange {
  /** ID dự án trong AFF database */
  affProjectId: string;
  /** Tiêu đề video */
  title: string;
  /** Mô tả / kịch bản tổng quan */
  description: string;
  /** Phong cách video (2d_flat, 3d_cinematic, etc.) */
  style: string;
  /** Ngôn ngữ */
  language: string;
  /** Các phân cảnh */
  scenes: VideoScene[];
  /** Đường dẫn video đã render hoàn chỉnh (nếu có) */
  finalVideoPath?: string;
  /** Đường dẫn thumbnail */
  thumbnailPath?: string;
  /** Metadata bổ sung */
  metadata: {
    productName?: string;
    productUrl?: string;
    affiliateLink?: string;
    youtubeVideoId?: string;
    googleDriveFileId?: string;
    styleBible?: Record<string, unknown>;
    characterBible?: Record<string, unknown>;
  };
  /** Timestamps */
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Event Types cho AutoCutClient EventEmitter
// =============================================================================

export interface AutoCutClientEvents {
  connected: [];
  disconnected: [];
  error: [error: Error];
  ready: [message: WsHelloAck];
  max_retries_reached: [];
  message: [message: WsServerMessage];
  run_prompt: [message: WsRunPrompt];
  chatgpt_batch: [message: WsChatGPTBatch];
  stop_batch: [message: WsStopBatch];
  /** Batch progress - emitted khi nhận được processing update qua REST polling */
  batch_progress: [status: WsStatusResponse];
}
