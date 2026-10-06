'use client';

// Replace the file behind an existing material. The material id stays the
// same, so trainee progress, ratings and certificates are preserved.
import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { updateMaterialFile, logMaterialUpdate } from '@/lib/materials';
import { describeUploadError, extractDeck, validateDeckFile } from '@/lib/thumbnails';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@/components/ui';
import { normalizeAudiences } from '@/lib/categories';
import { DropArea, FileRow, FormAlert, ModalShell, UploadProgress } from '@/components/UploadZone';
import '@/app/dashboard/dashboard.css';

export default function ReuploadModal({ material, onClose, onSuccess }) {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | extract | upload
  const [progress, setProgress] = useState(0);
  const busy = phase !== 'idle';

  const handleClose = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);

  if (!material) return null;

  const isPptx = material.fileName?.toLowerCase().endsWith('.pptx');
  const unit = isPptx ? 'slides' : 'pages';

  const pickFile = (f) => {
    const problem = validateDeckFile(f);
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setFile(f);
  };

  const handleReplace = async (e) => {
    e.preventDefault();
    if (!file || busy) return;
    setError('');
    setPhase('extract');

    try {
      const { pageCount, textContent, thumbnailURL } = await extractDeck(file, {
        title: material.name,
        category: material.category,
      });

      setPhase('upload');
      setProgress(0);
      await updateMaterialFile(
        material.id,
        file,
        { pageCount, thumbnailURL, updatedBy: user?.email || 'unknown', textContent },
        material.storagePath,
        (p) => setProgress(Math.round(p)),
      );

      // Log the update so all users get a notification on next login.
      try {
        await logMaterialUpdate(material.id, material.name, user?.displayName || user?.email || 'Trainer', 'updated', normalizeAudiences(material.audiences));
      } catch (logErr) {
        console.warn('Could not log material update notification:', logErr);
      }

      toast.success(`File replaced. Everyone's progress on “${material.name}” is kept.`);
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Re-upload failed:', err);
      setError(describeUploadError(err, 'Re-upload'));
      setPhase('idle');
      setProgress(0);
    }
  };

  return (
    <ModalShell
      title="Replace file"
      subtitle={<>Updating <strong>{material.name}</strong></>}
      icon="cloud_sync"
      onClose={handleClose}
      dismissible={!busy}
    >
      <form onSubmit={handleReplace} className="up-form" noValidate>
        <div className="up-current">
          <span className="eyebrow">Current file</span>
          <span className="up-current-name" title={material.fileName}>{material.fileName || material.name}</span>
          {material.pageCount > 0 && (
            <span className="up-current-sub">{material.pageCount} {unit}</span>
          )}
        </div>

        {!file ? (
          <DropArea onFile={pickFile} icon="cloud_sync" title="Choose the new version" />
        ) : (
          <FileRow file={file} onChange={() => { setFile(null); setError(''); }} disabled={busy} />
        )}

        <p className="up-tip is-safe">
          <i className="material-icons" aria-hidden="true">verified_user</i>
          <span>Trainee progress, ratings and certificates stay attached to this material.</span>
        </p>

        {busy && <UploadProgress phase={phase} progress={progress} verb="Replacing file" />}
        <FormAlert>{error}</FormAlert>

        <div className="modal-footer up-modal-footer">
          <button type="button" className="btn btn-outline" onClick={handleClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-gradient" disabled={!file || busy}>
            {busy ? <Spinner size="sm" white /> : <i className="material-icons" aria-hidden="true">sync</i>}
            {busy ? 'Replacing' : 'Replace file'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
