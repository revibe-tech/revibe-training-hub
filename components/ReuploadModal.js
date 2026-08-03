'use client';

import { useState, useRef } from 'react';
import { updateMaterialFile } from '@/lib/materials';
import { useAuth } from '@/contexts/AuthContext';

// Helper to generate custom Revibe presentation thumbnail for PPTX
const generateRevibePresentationThumbnail = (fileName) => {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 250;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 400, 250);
  gradient.addColorStop(0, '#FF3B3F');
  gradient.addColorStop(0.5, '#7E30E1');
  gradient.addColorStop(1, '#4A00E0');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 400, 250);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath();
  ctx.arc(350, 50, 110, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.beginPath();
  ctx.arc(50, 200, 160, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.beginPath();
  ctx.arc(200, 80, 38, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 44px "Poppins", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('R', 200, 80);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 20px "Segoe UI", sans-serif';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;

  let displayName = fileName.replace(/\.pptx$/i, '').replace(/\.pdf$/i, '');
  if (displayName.length > 25) {
    displayName = displayName.substring(0, 22) + '...';
  }
  ctx.fillText(displayName, 200, 155);

  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';

  const x = 110;
  const y = 190;
  const width = 180;
  const height = 28;
  const radius = 14;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 11px "Segoe UI", sans-serif';
  ctx.fillText('REVIBE PRESENTATION', 200, 206);

  return canvas.toDataURL('image/jpeg', 0.85);
};

export default function ReuploadModal({ material, onClose, onSuccess }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const { user } = useAuth();

  if (!material) return null;

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFileReplace(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      await handleFileReplace(e.target.files[0]);
    }
  };

  const handleFileReplace = async (file) => {
    const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isPPTX = file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || file.name.toLowerCase().endsWith('.pptx');

    if (!isPDF && !isPPTX) {
      setError('Please select a PDF or PPTX file.');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError('File is too large. Maximum size is 50MB.');
      return;
    }

    setIsUploading(true);
    setProgress(0);
    setError('');

    try {
      let pageCount = 0;
      let textContent = [];
      let thumbnailURL = null;

      try {
        if (isPDF) {
          const pdfjsLib = await import('pdfjs-dist');
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          pageCount = pdf.numPages;

          for (let i = 1; i <= Math.min(pageCount, 50); i++) {
            const page = await pdf.getPage(i);
            const textObj = await page.getTextContent();
            const pageText = textObj.items.map(item => item.str).join(' ');
            textContent.push({ page: i, text: pageText });
          }

          try {
            const THUMB_WIDTH = 720;
            const page = await pdf.getPage(1);
            const thumbScale = THUMB_WIDTH / page.getViewport({ scale: 1 }).width;
            const viewport = page.getViewport({ scale: thumbScale });
            const thumbCanvas = document.createElement('canvas');
            thumbCanvas.width = Math.round(viewport.width);
            thumbCanvas.height = Math.round(viewport.height);
            const ctx = thumbCanvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            await page.render({ canvasContext: ctx, viewport }).promise;
            thumbnailURL = thumbCanvas.toDataURL('image/jpeg', 0.9);
          } catch (thumbErr) {
            console.warn('Failed to generate PDF thumbnail:', thumbErr);
          }
        } else if (isPPTX) {
          const { PptxRenderer } = await import('pptx-browser');
          const renderer = new PptxRenderer();
          const arrayBuffer = await file.arrayBuffer();
          await renderer.load(arrayBuffer);
          pageCount = renderer.slideCount;

          const allExtracts = await renderer.extractAll();
          allExtracts.forEach(slide => {
            textContent.push({ page: slide.index + 1, text: slide.text || '' });
          });

          try {
            thumbnailURL = generateRevibePresentationThumbnail(file.name);
          } catch (thumbErr) {
            console.warn('Failed to generate presentation thumbnail:', thumbErr);
          }

          renderer.destroy();
        }
      } catch (extractErr) {
        console.warn("Failed to extract text during re-upload:", extractErr);
      }

      const metadata = {
        pageCount: pageCount,
        thumbnailURL: thumbnailURL,
        updatedBy: user?.email || 'unknown',
        textContent: textContent
      };

      await updateMaterialFile(
        material.id,
        file,
        metadata,
        material.storagePath,
        (p) => setProgress(Math.round(p))
      );

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err) {
      console.error("Re-upload failed:", err);
      setError('Re-upload failed: ' + (err.message || 'Unknown error.'));
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="reupload-modal-overlay" onClick={() => !isUploading && onClose()}>
      <div className="reupload-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="reupload-modal-header">
          <div>
            <h3 className="reupload-modal-title">Replace Material File</h3>
            <p className="reupload-modal-subtitle">
              Updating <strong>"{material.name}"</strong> — trainee progress & ratings will be preserved.
            </p>
          </div>
          <button
            className="reupload-close-btn"
            onClick={() => !isUploading && onClose()}
            disabled={isUploading}
          >
            <i className="material-icons">close</i>
          </button>
        </div>

        <div
          className={`upload-zone ${isDragging ? 'drag-over' : ''}`}
          style={{ marginTop: '16px', borderStyle: 'dashed' }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,.pptx"
            style={{ display: 'none' }}
          />

          {isUploading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <i className="material-icons animate-spin" style={{ fontSize: '48px', marginBottom: '16px', color: 'var(--accent-pink)' }}>sync</i>
              <h3 className="upload-zone-title" style={{ marginBottom: '16px' }}>Replacing material... {progress}%</h3>
              <div className="progress-bar" style={{ maxWidth: '300px', width: '100%', margin: '0 auto' }}>
                <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          ) : (
            <>
              <i className="material-icons upload-zone-icon" style={{ color: 'var(--accent-purple)' }}>cloud_sync</i>
              <h3 className="upload-zone-title">Select replacement file</h3>
              <p className="upload-zone-text">Drag & drop new PDF/PPTX here or <strong>Browse</strong></p>
              <p className="upload-zone-hint">
                <i className="material-icons">verified_user</i>
                <span>Trainee progress records and 5-star ratings will remain attached to this material.</span>
              </p>
            </>
          )}

          {error && (
            <div style={{
              marginTop: '16px',
              padding: '12px 16px',
              background: 'var(--color-danger-light)',
              color: 'var(--color-danger)',
              borderRadius: 'var(--radius-md)',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              ⚠️ {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
