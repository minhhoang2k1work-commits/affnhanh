// Prepare the panel before the click so open() runs directly in the user gesture.
(async () => {
  const button = document.getElementById('openPublishingPanel');
  const status = document.getElementById('publishingPanelStatus');
  function enableMiniWindow(reason) {
    status.textContent = `${reason} Bạn vẫn có thể bấm nút để mở cửa sổ nhỏ.`;
    button.disabled = false;
    button.onclick = async () => {
      try {
        const current = await chrome.windows.getCurrent();
        const width = Math.min(420, current.width || 420);
        await chrome.windows.create({
          url: chrome.runtime.getURL('publishing-history.html'), type: 'popup',
          width, height: Math.max(300, Math.min(800, current.height || 700)),
          left: Math.max(0, (current.left || 0) + (current.width || width) - width),
          top: Math.max(0, current.top || 0), focused: true,
        });
        window.close();
      } catch (error) { status.textContent = `Không mở được cửa sổ: ${error.message}`; }
    };
  }
  try {
    if (!chrome.sidePanel?.open) {
      const manifest = chrome.runtime.getManifest();
      enableMiniWindow(!manifest.permissions?.includes('sidePanel')
        ? 'Bản extension đang chạy chưa nhận quyền bảng bên cạnh. Hãy tải lại extension tại chrome://extensions.'
        : 'Trình duyệt chưa cung cấp tính năng bảng bên cạnh cho extension.');
      return;
    }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!Number.isInteger(tab?.id)) throw new Error('Không tìm thấy tab hiện tại.');
    await chrome.sidePanel.setOptions({ tabId: tab.id, path: 'publishing-history.html', enabled: true });
    button.disabled = false;
    button.onclick = () => {
      chrome.sidePanel.open({ tabId: tab.id }).then(() => window.close()).catch(error => {
        enableMiniWindow(`Không mở được bảng bên cạnh: ${error.message}`);
      });
    };
  } catch (error) { enableMiniWindow(error.message); }
})();
