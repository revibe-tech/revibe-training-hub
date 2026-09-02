'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import MaterialCard from '@/components/MaterialCard';
import { getAllMaterials } from '@/lib/materials';
import './home.css';

export default function Home() {
  const [materials, setMaterials] = useState([]);
  const [filteredMaterials, setFilteredMaterials] = useState([]);
  const [categories, setCategories] = useState(['All', 'General', 'Onboarding', 'Technical', 'Sales']);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMaterials();
  }, []);

  useEffect(() => {
    let filtered = materials;
    if (activeCategory !== 'All') {
      filtered = filtered.filter(m => m.category === activeCategory);
    }
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(m => 
        m.name.toLowerCase().includes(q) || 
        (m.textContent && m.textContent.some(page => page.text.toLowerCase().includes(q)))
      );
    }
    setFilteredMaterials(filtered);
  }, [materials, activeCategory, searchQuery]);

  const loadMaterials = async () => {
    setIsLoading(true);
    try {
      const data = await getAllMaterials();
      setMaterials(data);
      
      const uniqueCats = new Set(['All', 'General', 'Onboarding', 'Technical', 'Sales']);
      data.forEach(m => { if (m.category) uniqueCats.add(m.category); });
      setCategories(Array.from(uniqueCats));
    } catch (error) {
      console.error("Failed to load materials", error);
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-bg-white">
      <Navbar />

      <section className="hero-section">
        <div className="hero-background-icon">
          <i className="material-icons">school</i>
        </div>
        <div className="hero-content">
          <h1 className="hero-title text-display">Training Hub</h1>
          <p className="hero-subtitle">Access all your training materials in one place.</p>
          <p className="hero-tagline">"Like new, but waaaay better at learning."</p>
        </div>
      </section>

      <main className="container pt-8 pb-16">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <div className="search-bar">
            <i className="material-icons search-icon">search</i>
            <input 
              type="text" 
              placeholder="Search by name or content..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="category-pills">
          {categories.map(cat => (
            <button 
              key={cat}
              className={`category-pill ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center mt-16 text-muted">
            <i className="material-icons animate-spin" style={{ fontSize: '48px' }}>refresh</i>
            <p className="mt-4">Loading materials...</p>
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-16 text-muted">
            <i className="material-icons" style={{ fontSize: '48px', opacity: 0.5 }}>inventory_2</i>
            <h3 className="text-h3 mt-4 text-primary">No materials found</h3>
            <p className="mt-2">Check back later for new training materials.</p>
          </div>
        ) : (
          <div className="materials-grid">
            {filteredMaterials.map(material => (
              <MaterialCard key={material.id} material={material} />
            ))}
          </div>
        )}
      </main>

      <footer className="home-footer text-center py-8 text-muted text-small border-t border-gray-100">
        <div className="gradient-text font-poppins font-bold text-lg mb-2">REVIBE</div>
        <p>&copy; {new Date().getFullYear()} Revibe. All rights reserved.</p>
      </footer>
    </div>
  );
}
