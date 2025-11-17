import React, { useRef, useState } from 'react';
import { supabase } from '../../../services/supabaseClient';

interface AvatarUploaderProps {
  value?: string | null;
  onChange: (url: string) => void;
}

export const AvatarUploader: React.FC<AvatarUploaderProps> = ({ value, onChange }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => inputRef.current?.click();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) throw new Error('Not authenticated');

      // Ensure a deterministic file path
      const fileExt = (file.name.split('.').pop() || 'png').toLowerCase();
      let uploadFile: File = file;
      let uploadExt = fileExt;

      // Some PNGs can fail due to metadata or very large size on certain paths.
      // Fallback: convert to webp (lossless) in-browser if PNG upload errors.
      async function convertToWebp(original: File): Promise<File> {
        const img = document.createElement('img');
        const reader = new FileReader();
        const dataUrl: string = await new Promise((res, rej) => {
          reader.onload = () => res(reader.result as string);
          reader.onerror = rej;
          reader.readAsDataURL(original);
        });
        img.src = dataUrl;
        await new Promise((r) => (img.onload = () => r(null)));
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const webpData = canvas.toDataURL('image/webp', 0.95);
        const bin = atob(webpData.split(',')[1]);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return new File([arr], original.name.replace(/\.[^.]+$/, '.webp'), {
          type: 'image/webp',
        });
      }

      let filePath = `public/${userId}-${Date.now()}.${uploadExt}`;

      // Try upload to an 'avatars' bucket. If it doesn't exist or blocked by policy, surface a friendly message.
      let { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, uploadFile, {
          upsert: true,
          cacheControl: '3600',
          contentType: uploadFile.type || `image/${uploadExt}`,
        });
      if (uploadError) {
        // If initial upload fails for PNGs, try webp conversion fallback once.
        if (fileExt === 'png') {
          try {
            uploadFile = await convertToWebp(file);
            uploadExt = 'webp';
            filePath = `public/${userId}-${Date.now()}.webp`;
            const retry = await supabase.storage
              .from('avatars')
              .upload(filePath, uploadFile, {
                upsert: true,
                cacheControl: '3600',
                contentType: uploadFile.type,
              });
            uploadError = retry.error || null;
          } catch (cErr: any) {
            uploadError = uploadError || cErr;
          }
        }
      }
      if (uploadError) {
        setError('Upload failed. Ensure a bucket named "avatars" exists with public read and authenticated upload. You can also try a smaller image.');
        return;
      }
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(filePath);
      if (!pub?.publicUrl) {
        setError('Unable to get public URL for avatar.');
        return;
      }
      onChange(pub.publicUrl);
    } catch (e: any) {
      setError(e?.message ?? 'Unexpected error during upload');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <img
        src={value || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
        alt="avatar"
        className="w-16 h-16 rounded-full object-cover border border-white/10"
      />
      <div className="space-y-2">
        <button
          type="button"
          onClick={handleClick}
          disabled={uploading}
          className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-200 disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : 'Change Avatar'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        {!error && (
          <p className="text-xs text-zinc-500">
            Tip: Add a Storage bucket “avatars” and set public read + authenticated upload.
          </p>
        )}
      </div>
    </div>
  );
};


