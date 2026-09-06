// Bridge module: Giao tiếp giữa AFF Web App và AutoCut Desktop App
export { AutoCutClient } from './autocut-client';
export type { AutoCutClientConfig } from './autocut-client';
export type {
  // Chrome Profile
  ChromeProfile,
  ChromeProfilesResponse,
  ExtensionStatusResponse,
  LaunchChromeRequest,
  LaunchChromeResponse,
  InstallExtensionRequest,
  InstallExtensionResponse,
  // WebSocket Status
  WsStatusResponse,
  BatchStatus,
  // Batch Processing
  WorkflowMode,
  BatchPlatform,
  BatchAsset,
  FlowBatchRequest,
  ChatGPTBatchRequest,
  StartBatchRequest,
  StartBatchResponse,
  StopBatchResponse,
  // File Management
  OrganizeFilesRequest,
  OrganizeFilesResponse,
  ScanFolderResponse,
  // WebSocket Protocol
  WsServerMessage,
  WsHelloAck,
  WsRunPrompt,
  WsChatGPTBatch,
  WsStopBatch,
  WsClientMessage,
  WsHello,
  WsHeartbeat,
  WsLog,
  WsProcessing,
  WsSuccess,
  WsError,
  WsChatGPTResult,
  WsChatGPTBatchDone,
  WsStartBatch,
  WsStopBatchClient,
  // Video Project Exchange
  VideoScene,
  VideoProjectExchange,
  // Events
  AutoCutClientEvents,
} from './types';
