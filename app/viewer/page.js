'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import SlideViewer from '@/components/SlideViewer';
import './viewer.css';

function ViewerContent() {
  const searchParams = useSearchParams();
  const materialId = searchParams.get('id');
  const router = useRouter();
  
  const [material, setMaterial] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!materialId) {
      router.push('/');
      return;
    }

    const fetchMaterial = async () => {
      try {
        const docRef = doc(db, 'materials', materialId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setMaterial(docSnap.data());
        } else {
          setError('Material not found');
        }
      } catch (err) {
        console.error('Error fetching material', err);
        setError('Failed to load presentation details');
      } finally {
        setLoading(false);
      }
    };

    fetchMaterial();
  }, [materialId, router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-bg-dark text-white">
        <i className="material-icons animate-spin text-accent-pink" style={{fontSize: '48px'}}>refresh</i>
        <p className="mt-4 font-medium opacity-70">Preparing presentation...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-bg-dark text-white">
        <i className="material-icons text-color-danger text-display mb-4">error_outline</i>
        <h2 className="text-h2 font-poppins mb-2">Oops!</h2>
        <p className="text-body opacity-70 mb-6">{error}</p>
        <button className="btn btn-gradient" onClick={() => router.push('/')}>
          Return to Hub
        </button>
      </div>
    );
  }

  if (!material) return null;

  return (
    <SlideViewer 
      url={material.downloadURL} 
      title={material.name} 
    />
  );
}

export default function ViewerPage() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-bg-dark flex items-center justify-center text-white">
        <i className="material-icons animate-spin">refresh</i>
      </div>
    }>
      <ViewerContent />
    </Suspense>
  );
}
