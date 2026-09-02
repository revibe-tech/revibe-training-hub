'use client';

import { useState, useRef } from 'react';
import { uploadMaterial } from '@/lib/materials';

export default function UploadZone({ onUploadComplete }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('General');
  
  const fileInputRef = useRef(null);

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
      await handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      await handleFileUpload(e.target.files[0]);
    }
  };

  const handleFileUpload = async (file) => {
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file.');
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

      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        pageCount = pdf.numPages;

        // Extract text for search indexing
        for (let i = 1; i <= Math.min(pageCount, 50); i++) {
          const page = await pdf.getPage(i);
          const textObj = await page.getTextContent();
          const pageText = textObj.items.map(item => item.str).join(' ');
          textContent.push({ page: i, text: pageText });
        }
      } catch (pdfErr) {
        console.warn("Failed to extract PDF text context:", pdfErr);
      }

      const metadata = {
        category,
        pageCount,
        textContent
      };

      const result = await uploadMaterial(file, metadata, (p) => {
        setProgress(Math.round(p));
      });

      if (onUploadComplete) {
        onUploadComplete(result);
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (err) {
      console.error("Upload failed:", err);
      setError('Upload failed: ' + (err.message || 'Unknown error.'));
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="upload-container">
      <div className="flex items-center gap-4 mb-4">
        <label className="font-medium text-primary">Category:</label>
        <select 
          className="input" 
          style={{ width: '200px', padding: '8px 12px' }}
          value={category}
          onChange={e => setCategory(e.target.value)}
          disabled={isUploading}
        >
          <option value="General">General</option>
          <option value="Onboarding">Onboarding</option>
          <option value="Technical">Technical</option>
          <option value="Sales">Sales</option>
          <option value="Policies">Policies</option>
        </select>
      </div>

      <div
        className={`upload-zone ${isDragging ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="application/pdf"
          style={{ display: 'none' }}
        />

        {isUploading ? (
          <div className="flex flex-col items-center">
            <i className="material-icons animate-bounce text-accent-pink text-display mb-4">cloud_upload</i>
            <h3 className="text-h3 mb-4">Uploading... {progress}%</h3>
            <div className="progress-bar w-full max-w-xs">
              <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
        ) : (
          <>
            <i className="material-icons text-display text-accent-purple mb-4">picture_as_pdf</i>
            <h3 className="text-h3 mb-2">Upload new material</h3>
            <p className="text-muted">Drag and drop a PDF or <strong className="text-accent-pink">Browse files</strong></p>
          </>
        )}

        {error && (
          <div className="mt-4 p-3 bg-color-danger-light text-color-danger rounded-md font-medium text-sm">
            ⚠️ {error}
          </div>
        )}
      </div>
    </div>
  );
}
