'use client';

export function requestProductExtension(type: 'AFF_COLLECT_PRODUCT' | 'AFF_SEND_INDUSTRY_PROMPT', data: Record<string, unknown>) {
  return new Promise<Record<string, any>>((resolve, reject) => {
    if (!document.documentElement.hasAttribute('data-aff-extension-installed')) {
      reject(new Error('Hãy cài hoặc tải lại extension, sau đó tải lại trang web.'));
      return;
    }
    const requestId = crypto.randomUUID();
    const responseType = type === 'AFF_COLLECT_PRODUCT' ? 'AFF_PRODUCT_COLLECTED' : 'AFF_INDUSTRY_PROMPT_SENT';
    const timer = setTimeout(() => {
      window.removeEventListener('message', listener);
      reject(new Error('Hết thời gian chờ extension. Kiểm tra tab đã mở trước khi gửi lại.'));
    }, 90000);
    function listener(event: MessageEvent) {
      if (event.source !== window || event.origin !== location.origin || event.data?.type !== responseType || event.data.requestId !== requestId) return;
      clearTimeout(timer);
      window.removeEventListener('message', listener);
      if (event.data.success) resolve(event.data);
      else reject(new Error(event.data.error || 'Extension chưa thực hiện được yêu cầu.'));
    }
    window.addEventListener('message', listener);
    window.postMessage({ ...data, type, requestId }, location.origin);
  });
}
