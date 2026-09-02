'use client';

import { useRouter } from 'next/navigation';

export default function MaterialCard({ material }) {
  const router = useRouter();
  
  return (
    <div className="material-card">
      <div className="material-thumbnail">
        <div className="material-thumbnail-placeholder">
          <i className="material-icons">picture_as_pdf</i>
        </div>
        <div className="material-page-count">{material.pageCount} pages</div>
      </div>
      <div className="material-info">
        <h3 className="material-name" title={material.name}>{material.name}</h3>
        <div className="material-meta">
          <div className="material-meta-item">
            <i className="material-icons">folder</i>
            <span>{material.category}</span>
          </div>
          <div className="material-meta-item">
            <i className="material-icons">schedule</i>
            <span>{new Date(material.uploadedAt).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="material-actions mt-auto">
          <button 
            className="btn btn-gradient btn-sm flex-1"
            onClick={() => router.push(`/viewer?id=${material.id}`)}
          >
            Start Training &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
