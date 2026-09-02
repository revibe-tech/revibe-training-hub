'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import UploadZone from '@/components/UploadZone';
import { getAllMaterials, deleteMaterial, updateMaterial } from '@/lib/materials';
import './dev.css';

export default function DevConsole() {
  const [materials, setMaterials] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editCategory, setEditCategory] = useState('');

  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    setIsLoading(true);
    try {
      const data = await getAllMaterials();
      setMaterials(data);
    } catch (error) {
      console.error("Failed to load materials", error);
    }
    setIsLoading(false);
  };

  const handleUploadComplete = (newMaterial) => {
    setMaterials([newMaterial, ...materials]);
  };

  const handleDelete = async (id, storagePath) => {
    if (confirm('Are you sure you want to delete this material?')) {
      try {
        await deleteMaterial(id, storagePath);
        setMaterials(materials.filter(m => m.id !== id));
      } catch (error) {
        alert('Failed to delete material');
      }
    }
  };

  const saveCategory = async (id) => {
    try {
      await updateMaterial(id, { category: editCategory });
      setMaterials(materials.map(m => m.id === id ? { ...m, category: editCategory } : m));
      setEditingId(null);
    } catch (error) {
      alert('Failed to update category');
    }
  };

  return (
    <div className="min-h-screen bg-bg-soft">
      <Navbar />

      <div className="dev-header bg-bg-dark text-white py-10 px-8 text-center">
        <h1 className="text-h1 mb-2">Developer Console</h1>
        <p className="text-muted opacity-80">Manage training materials. (Unlisted Route)</p>
      </div>

      <main className="container py-12">
        <div className="card p-8 mb-12 shadow-lg border-2 border-accent-purple-light">
          <h2 className="text-h2 mb-6">Upload Content</h2>
          <UploadZone onUploadComplete={handleUploadComplete} />
        </div>

        <div className="card p-8 shadow-md">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-h2">Material Management</h2>
            <div className="badge badge-purple">{materials.length} Items</div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <i className="material-icons animate-spin text-4xl text-accent-pink">refresh</i>
            </div>
          ) : materials.length === 0 ? (
            <div className="text-center py-12 text-muted">
              <i className="material-icons text-display opacity-50 mb-4">inventory_2</i>
              <p>No materials found. Upload one above.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="dev-table">
                <thead>
                  <tr>
                    <th>Document Name</th>
                    <th>Category</th>
                    <th>Pages</th>
                    <th>Uploaded Date</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map(material => (
                    <tr key={material.id}>
                      <td className="font-medium text-primary">
                        <div className="flex items-center gap-2">
                          <i className="material-icons text-accent-purple">picture_as_pdf</i>
                          <span className="truncate max-w-xs block" title={material.name}>{material.name}</span>
                        </div>
                      </td>
                      <td>
                        {editingId === material.id ? (
                          <div className="flex items-center gap-2">
                            <input 
                              type="text" 
                              className="input p-1 text-sm h-8"
                              value={editCategory}
                              onChange={(e) => setEditCategory(e.target.value)}
                            />
                            <button className="btn btn-sm btn-ghost text-color-success" onClick={() => saveCategory(material.id)}>
                              <i className="material-icons text-sm">check</i>
                            </button>
                            <button className="btn btn-sm btn-ghost text-color-danger" onClick={() => setEditingId(null)}>
                              <i className="material-icons text-sm">close</i>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group">
                            <span className="badge badge-pink">{material.category}</span>
                            <button 
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-accent-purple"
                              onClick={() => {
                                setEditingId(material.id);
                                setEditCategory(material.category);
                              }}
                            >
                              <i className="material-icons text-sm">edit</i>
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="font-mono text-sm text-muted">{material.pageCount}</td>
                      <td className="text-sm text-muted">{new Date(material.uploadedAt).toLocaleDateString()}</td>
                      <td className="text-right">
                        <button 
                          className="btn btn-ghost btn-sm text-color-danger hover:bg-color-danger-light"
                          onClick={() => handleDelete(material.id, material.storagePath)}
                          title="Delete"
                        >
                          <i className="material-icons">delete</i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
