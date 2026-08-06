'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getAllUsers, updateUserRole, searchUsers } from '@/lib/users';
import Navbar from '@/components/Navbar';
import './users.css';

// Active = logged in within the last 7 days. Computed at load time (not during
// render) so we don't call Date.now() in the render path.
const ACTIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
function computeActive(lastLogin) {
  if (!lastLogin) return false;
  const t = new Date(lastLogin).getTime();
  if (isNaN(t)) return false;
  return (Date.now() - t) <= ACTIVE_WINDOW_MS;
}

export default function UsersPage() {
  const { user, isTrainer, loading } = useAuth();
  const router = useRouter();
  
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [roleFilter, setRoleFilter] = useState('all'); // 'all', 'trainer', 'trainee'
  const [updatingUserId, setUpdatingUserId] = useState(null);

  // Redirect if not trainer
  useEffect(() => {
    if (!loading && (!user || !isTrainer)) {
      router.push('/dashboard');
    }
  }, [user, isTrainer, loading, router]);

  // Load all users
  useEffect(() => {
    if (isTrainer) {
      loadUsers();
    }
  }, [isTrainer]);

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const allUsers = (await getAllUsers()).map(u => ({ ...u, _active: computeActive(u.lastLogin) }));
      setUsers(allUsers);
      setFilteredUsers(allUsers);
    } catch (error) {
      console.error('Error loading users:', error);
    }
    setIsLoadingUsers(false);
  };

  // Filter users based on search and role
  useEffect(() => {
    let filtered = users;

    // Apply role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => u.role === roleFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(u =>
        (u.displayName && u.displayName.toLowerCase().includes(query)) ||
        (u.email && u.email.toLowerCase().includes(query))
      );
    }

    setFilteredUsers(filtered);
  }, [users, searchQuery, roleFilter]);

  const handleRoleUpdate = async (uid, newRole, currentEmail) => {
    // Prevent changing admin role
    if (currentEmail && currentEmail.toLowerCase() === 'youssf.rehem@revibe.me') {
      alert('Cannot change the role of the admin user.');
      return;
    }

    if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) {
      return;
    }

    setUpdatingUserId(uid);
    try {
      await updateUserRole(uid, newRole);
      
      // Update local state
      setUsers(users.map(u => 
        u.uid === uid ? { ...u, role: newRole } : u
      ));
      
      alert(`User role updated to ${newRole} successfully!`);
    } catch (error) {
      console.error('Error updating user role:', error);
      const reason = error?.code === 'permission-denied' || /insufficient permissions/i.test(error?.message || '')
        ? 'Permission denied by Firestore rules. Make sure the latest firestore.rules are deployed in the Firebase Console.'
        : (error?.message || 'Unknown error');
      alert(`Failed to update user role: ${reason}`);
    }
    setUpdatingUserId(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading || !isTrainer) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-white)' }}>
        <i className="material-icons animate-spin" style={{ fontSize: '48px', color: 'var(--accent-pink)' }}>refresh</i>
      </div>
    );
  }

  const trainerCount = users.filter(u => u.role === 'trainer').length;
  const traineeCount = users.filter(u => u.role === 'trainee').length;
  const activeCount = users.filter(u => u._active).length;

  return (
    <div className="min-h-screen bg-bg-white">
      <Navbar title="User Management" />

      <main className="users-page-content">
        {/* Header */}
        <div className="users-page-header">
          <div>
            <h1 className="users-page-title">User Management</h1>
            <p className="users-page-subtitle">Manage user roles and permissions</p>
          </div>
          
          <div className="users-stats">
            <div className="users-stat-badge">
              <i className="material-icons">people</i>
              <span>{users.length} Total Users</span>
            </div>
            <div className="users-stat-badge active">
              <i className="material-icons">bolt</i>
              <span>{activeCount} Active (7d)</span>
            </div>
            <div className="users-stat-badge trainer">
              <i className="material-icons">school</i>
              <span>{trainerCount} Trainers</span>
            </div>
            <div className="users-stat-badge trainee">
              <i className="material-icons">person</i>
              <span>{traineeCount} Trainees</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="users-filters">
          <div className="search-bar">
            <i className="material-icons search-icon">search</i>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="role-filter-pills">
            <button
              className={`role-filter-pill ${roleFilter === 'all' ? 'active' : ''}`}
              onClick={() => setRoleFilter('all')}
            >
              All Users
            </button>
            <button
              className={`role-filter-pill ${roleFilter === 'trainer' ? 'active' : ''}`}
              onClick={() => setRoleFilter('trainer')}
            >
              Trainers
            </button>
            <button
              className={`role-filter-pill ${roleFilter === 'trainee' ? 'active' : ''}`}
              onClick={() => setRoleFilter('trainee')}
            >
              Trainees
            </button>
          </div>
        </div>

        {/* Users Table */}
        {isLoadingUsers ? (
          <div className="users-loading">
            <i className="material-icons animate-spin text-accent-pink" style={{ fontSize: '48px' }}>refresh</i>
            <p>Loading users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="users-empty">
            <i className="material-icons">people_outline</i>
            <h3>No users found</h3>
            <p>Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="users-table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.uid}>
                    <td>
                      <div className="user-cell">
                        {u.photoURL ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.photoURL} alt={u.displayName} className="user-avatar" />
                        ) : (
                          <div className="user-avatar-placeholder">
                            <i className="material-icons">person</i>
                          </div>
                        )}
                        <span className="user-name">{u.displayName || 'Unknown User'}</span>
                      </div>
                    </td>
                    <td className="user-email">{u.email}</td>
                    <td>
                      <span className={`role-badge ${u.role}`}>
                        <i className="material-icons">
                          {u.role === 'trainer' ? 'school' : 'person'}
                        </i>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${u._active ? 'is-active' : 'is-inactive'}`}>
                        <span className="status-dot" />
                        {u._active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="user-date">{formatDate(u.lastLogin)}</td>
                    <td className="user-date">{formatDate(u.createdAt)}</td>
                    <td>
                      <div className="user-actions">
                        {u.email?.toLowerCase() === 'youssf.rehem@revibe.me' ? (
                          <span className="admin-badge">
                            <i className="material-icons">admin_panel_settings</i>
                            Admin
                          </span>
                        ) : (
                          <>
                            {u.role === 'trainee' ? (
                              <button
                                className="btn-role-action promote"
                                onClick={() => handleRoleUpdate(u.uid, 'trainer', u.email)}
                                disabled={updatingUserId === u.uid}
                                title="Promote to Trainer"
                              >
                                {updatingUserId === u.uid ? (
                                  <i className="material-icons animate-spin">refresh</i>
                                ) : (
                                  <>
                                    <i className="material-icons">arrow_upward</i>
                                    Promote
                                  </>
                                )}
                              </button>
                            ) : (
                              <button
                                className="btn-role-action demote"
                                onClick={() => handleRoleUpdate(u.uid, 'trainee', u.email)}
                                disabled={updatingUserId === u.uid}
                                title="Demote to Trainee"
                              >
                                {updatingUserId === u.uid ? (
                                  <i className="material-icons animate-spin">refresh</i>
                                ) : (
                                  <>
                                    <i className="material-icons">arrow_downward</i>
                                    Demote
                                  </>
                                )}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
