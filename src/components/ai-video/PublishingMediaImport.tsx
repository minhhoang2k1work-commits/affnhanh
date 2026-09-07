'use client';

import { useRef, useState } from 'react';
import { FolderOpen, Link2, Upload } from 'lucide-react';

type ImportedProject = { id: string; title: string };
const input = 'w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white';
const button = 'inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-40';

export function PublishingMediaImport({ onImported }: { onImported: (projects: ImportedProject[]) => void }) {
  const folder = useRef<HTMLInputElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [drive, setDrive] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState('folder');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  function pick(list: FileList | null) {
    const selected = Array.from(list || []).filter(f => /\.mp4$/i.test(f.name));
    setErrors(selected.length > 30 ? ['Mỗi lượt chọn tối đa 30 video MP4.'] : []);
    setFiles(selected.slice(0, 30));
    setStatus(selected.length ? `Đã chọn ${Math.min(selected.length, 30)} video MP4.` : 'Không có video MP4 trong thư mục đã chọn.');
  }
  async function importVideos() {
    setBusy(true); setErrors([]);
    const imported: ImportedProject[] = []; const failed: string[] = []; const failedFiles: File[] = [];
    try {
      if (mode === 'folder') {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setStatus(`Đang nhập ${i + 1}/${files.length}: ${file.name}`);
          try {
            if (file.size > 250 * 1024 * 1024) throw new Error('Vượt quá 250 MB');
            const response = await fetch('/api/publishing/media', { method: 'POST', headers: { 'Content-Type': 'video/mp4', 'X-AFF-Video-Metadata': encodeURIComponent(JSON.stringify({ name: file.name, description })) }, body: file });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Không tải được video');
            imported.push(result.project);
          } catch (error) { failedFiles.push(file); failed.push(`${file.name}: ${error instanceof Error ? error.message : 'Nhập thất bại'}`); }
        }
        setFiles(failedFiles);
      } else {
        setStatus('Đang tải video từ Google Drive về kho video…');
        const response = await fetch('/api/publishing/media', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ driveUrl: drive, description }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Không tải được video Drive');
        imported.push(result.project); setDrive('');
      }
      setStatus(`Đã nhập ${imported.length} video. Chọn Tạo bài đăng để gắn video với Page và lịch đăng.`);
    } catch (error) { failed.push(error instanceof Error ? error.message : 'Không nhập được video.'); }
    finally { if (imported.length) onImported(imported); setErrors(failed); setBusy(false); }
  }
  return <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
    <div><h2 className="font-semibold text-white">Nguồn video để đăng</h2><p className="text-sm text-slate-400 mt-1">Nhập video từ máy tính hoặc link Drive vào kho video dùng cho lịch đăng.</p></div>
    <div className="flex flex-wrap gap-2"><button className={`${button} ${mode === 'folder' ? 'bg-indigo-600/20 border-indigo-500' : ''}`} disabled={busy} onClick={() => setMode('folder')}><FolderOpen size={17} />Thư mục trên máy</button><button className={`${button} ${mode === 'drive' ? 'bg-indigo-600/20 border-indigo-500' : ''}`} disabled={busy} onClick={() => setMode('drive')}><Link2 size={17} />Link Google Drive</button></div>
    {mode === 'folder' ? <div className="space-y-3"><input ref={folder} type="file" multiple accept="video/mp4" {...{ webkitdirectory: '', directory: '' }} className="hidden" onChange={e => pick(e.target.files)} /><input ref={filesInput} type="file" multiple accept="video/mp4" className="hidden" onChange={e => pick(e.target.files)} /><div className="flex flex-wrap gap-2"><button className={button} disabled={busy} onClick={() => { if (folder.current) { folder.current.value = ''; folder.current.click(); } }}>Chọn thư mục</button><button className={button} disabled={busy} onClick={() => { if (filesInput.current) { filesInput.current.value = ''; filesInput.current.click(); } }}>Chọn từng tệp</button></div>{!!files.length && <ul className="max-h-32 overflow-auto text-xs text-slate-300 space-y-1">{files.map((f, i) => <li key={`${f.name}-${i}`} className="break-all">{f.webkitRelativePath || f.name} · {(f.size / 1048576).toFixed(1)} MB</li>)}</ul>}<p className="text-xs text-slate-500">Chọn tối đa 30 tệp MP4/lượt, 250 MB/tệp. Trình duyệt chỉ đọc thư mục bạn chọn; không tự theo dõi thư mục sau khi đóng trang.</p></div> : <label className="block text-sm text-slate-300">Link tệp video đã chia sẻ<input className={input} disabled={busy} placeholder="https://drive.google.com/file/d/.../view" value={drive} onChange={e => setDrive(e.target.value)} /><span className="block text-xs text-slate-500 mt-2">Chọn “Bất kỳ ai có đường liên kết” và bật quyền tải xuống. Hiện nhận link một tệp MP4, tối đa 250 MB.</span></label>}
    <label className="block text-sm text-slate-300">Mô tả sản phẩm cho video nhập lần này (không bắt buộc)<textarea rows={2} maxLength={3000} className={input} disabled={busy} placeholder="Nếu các video cùng một sản phẩm, nhập mô tả ở đây để ChatGPT viết tiêu đề. Nếu khác sản phẩm, nhập riêng từng lượt." value={description} onChange={e => setDescription(e.target.value)} /></label>
    <button className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" disabled={busy || (mode === 'folder' ? !files.length : !drive.trim())} onClick={importVideos}><Upload size={16} />{busy ? 'Đang nhập video…' : mode === 'folder' ? 'Nhập video đã chọn' : 'Tải video Drive về kho'}</button>
    {status && <p role="status" className="text-sm text-indigo-300">{status}</p>}{errors.map((error, i) => <p role="alert" key={i} className="text-sm text-red-300 break-words">{error}</p>)}
  </section>;
}
