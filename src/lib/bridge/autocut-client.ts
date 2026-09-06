import { EventEmitter } from 'events';
import type {
  ChromeProfilesResponse,
  ExtensionStatusResponse,
  LaunchChromeRequest,
  LaunchChromeResponse,
  WsStatusResponse,
  StartBatchRequest,
  StartBatchResponse,
  StopBatchResponse,
  OrganizeFilesRequest,
  OrganizeFilesResponse,
  ScanFolderResponse,
  InstallExtensionRequest,
  InstallExtensionResponse,
  WsClientMessage,
  WsServerMessage,
  VideoProjectExchange,
  AutoCutClientEvents,
} from './types';

export interface AutoCutClientConfig {
  /** Host của AutoCut Desktop (mặc định: localhost) */
  host?: string;
  /** Port REST API (mặc định: 8766) */
  restPort?: number;
  /** Port WebSocket (mặc định: 8765) */
  wsPort?: number;
  /** Thời gian chờ reconnect WebSocket (ms, mặc định: 3000) */
  reconnectInterval?: number;
  /** Số lần reconnect tối đa (mặc định: 10) */
  maxRetries?: number;
  /** Timeout cho REST API calls (ms, mặc định: 30000) */
  restTimeout?: number;
}

/**
 * Client bridge giao tiếp với AutoCut Desktop App
 *
 * Hỗ trợ:
 * - REST API (port 8766): Chrome profiles, batch processing, file management
 * - WebSocket (port 8765): Real-time batch progress, prompt dispatch
 *
 * @example
 * ```ts
 * const client = new AutoCutClient();
 *
 * // REST API
 * const profiles = await client.getProfiles();
 * await client.startBatch({ platform: 'google_flow', ... });
 *
 * // WebSocket real-time
 * client.connect();
 * client.on('run_prompt', (msg) => console.log('Prompt:', msg.text));
 * ```
 */
export class AutoCutClient extends EventEmitter {
  private host: string;
  private restPort: number;
  private wsPort: number;
  private ws: WebSocket | null = null;
  private reconnectInterval: number;
  private maxRetries: number;
  private restTimeout: number;
  private retryCount = 0;
  private isConnecting = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config?: AutoCutClientConfig) {
    super();
    this.host = config?.host ?? 'localhost';
    this.restPort = config?.restPort ?? 8766;
    this.wsPort = config?.wsPort ?? 8765;
    this.reconnectInterval = config?.reconnectInterval ?? 3000;
    this.maxRetries = config?.maxRetries ?? 10;
    this.restTimeout = config?.restTimeout ?? 30000;
  }

  private get restBaseUrl() {
    return `http://${this.host}:${this.restPort}`;
  }

  private get wsUrl() {
    return `ws://${this.host}:${this.wsPort}`;
  }

  // ==========================================================================
  // REST API Methods — Giao tiếp HTTP với AutoCut Server (:8766)
  // ==========================================================================

  private async fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.restBaseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.restTimeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`AutoCut API ${response.status}: ${body || response.statusText}`);
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`AutoCut API timeout after ${this.restTimeout}ms: ${path}`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ---- Chrome Profile Management ----

  /**
   * Lấy danh sách tất cả Chrome profiles trên máy
   * Bao gồm tên, email, avatar, đường dẫn
   */
  async getProfiles(): Promise<ChromeProfilesResponse> {
    return this.fetchApi<ChromeProfilesResponse>('/profiles');
  }

  /**
   * Khởi chạy Chrome với profile, extension và URL mục tiêu
   */
  async launchChrome(request: LaunchChromeRequest): Promise<LaunchChromeResponse> {
    return this.fetchApi<LaunchChromeResponse>('/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  }

  /**
   * Kiểm tra Extension đã cài đặt vào Profile Chrome chưa
   */
  async getExtensionStatus(profileDir: string, extensionPath: string): Promise<ExtensionStatusResponse> {
    const params = new URLSearchParams({
      profile_dir: profileDir,
      extension_path: extensionPath,
    });
    return this.fetchApi<ExtensionStatusResponse>(`/extension_status?${params}`);
  }

  /**
   * Cài đặt tự động Extension vào Chrome Profile
   * Copy extension files và ghi vào Preferences
   */
  async installExtension(request: InstallExtensionRequest): Promise<InstallExtensionResponse> {
    return this.fetchApi<InstallExtensionResponse>('/install_extension', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  }

  // ---- WebSocket & Batch Status ----

  /**
   * Lấy trạng thái chi tiết WebSocket connection và batch đang chạy
   * Bao gồm: extension version, queue size, batch progress, prompt hiện tại
   */
  async getWsStatus(): Promise<WsStatusResponse> {
    return this.fetchApi<WsStatusResponse>('/ws_status');
  }

  // ---- Batch Processing ----

  /**
   * Đẩy batch prompts vào hàng đợi xử lý
   *
   * Hỗ trợ 2 chế độ:
   * - Google Flow: Tạo video/ảnh AI (Veo3, Imagen)
   * - ChatGPT: Batch kịch bản/nghiên cứu
   *
   * @example Google Flow batch:
   * ```ts
   * await client.startBatch({
   *   platform: 'google_flow',
   *   workflow_mode: 'text_to_video',
   *   prompts: ['Cinematic shot of mountains', 'Aerial view of city'],
   *   output_folder: 'veo-project-01',
   *   min_delay: 20,
   *   max_delay: 30,
   * });
   * ```
   *
   * @example ChatGPT batch:
   * ```ts
   * await client.startBatch({
   *   platform: 'chatgpt',
   *   action: 'chatgpt_batch',
   *   chatgpt_config: {
   *     mode: 'scenario',
   *     template: 'Viết kịch bản về: {topic}',
   *     topics: ['Tài chính cá nhân', 'Đầu tư chứng khoán'],
   *     wait_sec: 25,
   *     delay_sec: 8,
   *   },
   * });
   * ```
   */
  async startBatch(request: StartBatchRequest): Promise<StartBatchResponse> {
    return this.fetchApi<StartBatchResponse>('/start_batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  }

  /**
   * Dừng ngay batch đang chạy (cả Flow lẫn ChatGPT)
   */
  async stopBatch(): Promise<StopBatchResponse> {
    return this.fetchApi<StopBatchResponse>('/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
  }

  // ---- File Management ----

  /**
   * Gom file media đã tải về vào thư mục dự án
   * Tự động tạo thư mục `tai_nguyen_edit_NN` với index tăng dần
   */
  async organizeFiles(request: OrganizeFilesRequest): Promise<OrganizeFilesResponse> {
    return this.fetchApi<OrganizeFilesResponse>('/organize_files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  }

  /**
   * Quét thư mục trên máy để tìm file media
   * @param path Đường dẫn thư mục cần quét
   * @param extensions Phần mở rộng file (VD: ['mp4', 'webm', 'jpg', 'png'])
   */
  async scanFolder(path: string, extensions?: string[]): Promise<ScanFolderResponse> {
    const params = new URLSearchParams({ path });
    if (extensions?.length) {
      params.set('extensions', extensions.join(','));
    }
    return this.fetchApi<ScanFolderResponse>(`/scan_folder?${params}`);
  }

  // ---- Health Check ----

  /**
   * Kiểm tra AutoCut Desktop có đang chạy và sẵn sàng không
   * @returns true nếu server phản hồi thành công
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.getProfiles();
      return true;
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // WebSocket Connection — Kết nối real-time với AutoCut (:8765)
  // ==========================================================================

  /**
   * Kết nối WebSocket tới AutoCut Desktop
   * Tự động reconnect khi mất kết nối (tối đa maxRetries lần)
   *
   * Events phát ra:
   * - `connected` — Kết nối thành công
   * - `disconnected` — Mất kết nối
   * - `ready` — Nhận hello_ack từ server
   * - `run_prompt` — Server gửi prompt mới xuống
   * - `chatgpt_batch` — Server gửi batch ChatGPT
   * - `stop_batch` — Server yêu cầu dừng batch
   * - `message` — Mọi tin nhắn từ server
   * - `error` — Lỗi kết nối
   * - `max_retries_reached` — Đã hết số lần reconnect
   */
  connect(): void {
    if (this.ws || this.isConnecting) return;
    this.isConnecting = true;

    try {
      // Sử dụng dynamic import cho 'ws' package (server-side only)
      const ws = new (require('ws') as typeof WebSocket)(this.wsUrl);

      ws.onopen = () => {
        this.ws = ws;
        this.isConnecting = false;
        this.retryCount = 0;
        this.emit('connected');

        // Gửi hello message
        this.sendWsMessage({
          type: 'hello',
          version: '1.0.0',
          status: 'idle',
        });

        // Heartbeat mỗi 20 giây
        this.heartbeatTimer = setInterval(() => {
          if (this.ws?.readyState === 1 /* OPEN */) {
            this.sendWsMessage({
              type: 'heartbeat',
              status: 'connected',
              timestamp: new Date().toISOString(),
            });
          }
        }, 20_000);
      };

      ws.onmessage = (event: { data: string | Buffer }) => {
        try {
          const message = JSON.parse(
            typeof event.data === 'string' ? event.data : event.data.toString()
          ) as WsServerMessage;
          this.handleWsMessage(message);
        } catch (err) {
          console.error('[AutoCutClient] Failed to parse WS message:', err);
        }
      };

      ws.onclose = () => {
        this.cleanup();
        this.emit('disconnected');
        this.scheduleReconnect();
      };

      ws.onerror = (event: any) => {
        const error = new Error(event?.message ?? 'WebSocket error');
        console.error('[AutoCutClient] WS error:', error.message);
        this.emit('error', error);
      };
    } catch (err) {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Ngắt kết nối WebSocket (không tự reconnect)
   */
  disconnect(): void {
    this.retryCount = this.maxRetries; // Ngăn reconnect
    this.cleanup();
  }

  /**
   * Gửi tin nhắn tới AutoCut Server qua WebSocket
   */
  sendWsMessage(message: WsClientMessage): void {
    if (this.ws?.readyState === 1 /* OPEN */) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[AutoCutClient] WS not connected, cannot send:', message.type);
    }
  }

  /** Trạng thái kết nối WebSocket hiện tại */
  get isConnected(): boolean {
    return this.ws?.readyState === 1 /* OPEN */;
  }

  // ---- Private helpers ----

  private handleWsMessage(message: WsServerMessage): void {
    this.emit('message', message);

    switch (message.action) {
      case 'hello_ack':
        this.emit('ready', message);
        break;
      case 'run_prompt':
        this.emit('run_prompt', message);
        break;
      case 'chatgpt_batch':
        this.emit('chatgpt_batch', message);
        break;
      case 'stop_batch':
        this.emit('stop_batch', message);
        break;
    }
  }

  private cleanup(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }
    this.isConnecting = false;
  }

  private scheduleReconnect(): void {
    if (this.retryCount >= this.maxRetries) {
      this.emit('max_retries_reached');
      return;
    }

    this.retryCount++;
    const delay = this.reconnectInterval * Math.min(this.retryCount, 5); // Backoff tối đa 5x
    console.log(
      `[AutoCutClient] Reconnecting in ${delay}ms (${this.retryCount}/${this.maxRetries})...`
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}
