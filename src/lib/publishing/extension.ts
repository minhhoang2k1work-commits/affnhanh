'use client';

export function requestPublishing(action: string, payload: Record<string, unknown> = {}) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    if (!document.documentElement.hasAttribute('data-aff-extension-installed')) return reject(new Error('Cài hoặc tải lại extension AutoFlow Hub, rồi tải lại trang.'));
    const requestId = crypto.randomUUID();
    const timer = setTimeout(() => {
      window.removeEventListener('message', listener);
      reject(new Error('Hết thời gian chờ. Kiểm tra tab ChatGPT/Facebook trước khi thao tác lại.'));
    }, action === 'GENERATE' ? 570000 : 180000);
    function listener(event: MessageEvent) {
      if (event.source !== window || event.origin !== location.origin || event.data?.type !== 'AFF_PUBLISH_RESULT' || event.data.requestId !== requestId) return;
      clearTimeout(timer);
      window.removeEventListener('message', listener);
      if (event.data.success) resolve(event.data);
      else reject(new Error(event.data.error || 'Extension không thực hiện được yêu cầu.'));
    }
    window.addEventListener('message', listener);
    window.postMessage({ type: 'AFF_PUBLISH', requestId, action, payload }, location.origin);
  });
}
