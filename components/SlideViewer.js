'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as pdfjsLib from 'pdfjs-dist';

// Setting worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export default function SlideViewer({ url, title }) {
  const router = useRouter();
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [isRendering, setIsRendering] = useState(true);
  const [scale, setScale] = useState(1.0);
  
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const renderTaskRef = useRef(null);

  useEffect(() => {
    if (!url) return;
    const loadPDF = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setPageNum(1);
      } catch (error) {
        console.error('Error loading PDF:', error);
      }
    };
    loadPDF();
  }, [url]);

  const calculateScale = useCallback((page) => {
    if (!containerRef.current) return 1;
    const container = containerRef.current;
    
    // Viewport at scale 1
    const unscaledViewport = page.getViewport({ scale: 1 });
    
    // Calculate scale to fit width and height
    const scaleWidth = container.clientWidth / unscaledViewport.width;
    const scaleHeight = container.clientHeight / unscaledViewport.height;
    
    // Use the smaller scale so it fits entirely within the container (contain)
    return Math.min(scaleWidth, scaleHeight) * 0.95; // 95% to leave a tiny padding
  }, []);

  const renderPage = useCallback(async (num) => {
    if (!pdfDoc || !canvasRef.current) return;
    setIsRendering(true);

    if (renderTaskRef.current) {
      try {
        await renderTaskRef.current.cancel();
      } catch (err) {}
    }

    try {
      const page = await pdfDoc.getPage(num);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      const currentScale = calculateScale(page);
      setScale(currentScale);

      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: currentScale * dpr });
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / dpr}px`;
      canvas.style.height = `${viewport.height / dpr}px`;

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
      };

      renderTaskRef.current = page.render(renderContext);
      await renderTaskRef.current.promise;
    } catch (error) {
      if (error.name !== 'RenderingCancelledException') {
        console.error('Error rendering page:', error);
      }
    } finally {
      setIsRendering(false);
    }
  }, [pdfDoc, calculateScale]);

  useEffect(() => {
    renderPage(pageNum);
  }, [pageNum, renderPage]);

  // Handle window resize to re-render at correct scale
  useEffect(() => {
    let resizeTimer;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        renderPage(pageNum);
      }, 200);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, [pageNum, renderPage]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'Space') {
        e.preventDefault();
        setPageNum(prev => Math.min(numPages, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setPageNum(prev => Math.max(1, prev - 1));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        router.push('/');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [numPages, router]);

  const changePage = (offset) => {
    setPageNum(prev => {
      const newPage = prev + offset;
      return newPage >= 1 && newPage <= numPages ? newPage : prev;
    });
  };

  const progressPercent = numPages > 0 ? (pageNum / numPages) * 100 : 0;

  return (
    <div className="slideshow-container bg-bg-dark">
      <div className="slideshow-main" ref={containerRef}>
        {pdfDoc ? (
          <div className={`slide-wrapper ${isRendering ? 'rendering' : ''}`}>
            <canvas ref={canvasRef} className="slide-canvas shadow-xl" />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-white">
            <i className="material-icons animate-spin text-4xl mb-4 text-accent-pink">refresh</i>
            <p className="font-poppins">Loading Presentation...</p>
          </div>
        )}
      </div>

      <div className="slideshow-controls">
        <div className="slideshow-controls-inner">
          <button 
            className="btn btn-ghost text-white btn-sm"
            onClick={() => router.push('/')}
            title="Exit Presentation (Esc)"
          >
            <i className="material-icons">close</i>
          </button>

          <div className="slideshow-title" title={title}>{title || 'Presentation'}</div>

          <div className="slideshow-nav">
            <button 
              className="nav-btn" 
              onClick={() => changePage(-1)}
              disabled={pageNum <= 1}
            >
              <i className="material-icons">chevron_left</i>
            </button>
            <div className="page-indicator font-mono">
              {pageNum} / {numPages || '-'}
            </div>
            <button 
              className="nav-btn" 
              onClick={() => changePage(1)}
              disabled={pageNum >= numPages}
            >
              <i className="material-icons">chevron_right</i>
            </button>
          </div>
        </div>
        
        <div className="slideshow-progress-bar">
          <div 
            className="slideshow-progress-fill" 
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
