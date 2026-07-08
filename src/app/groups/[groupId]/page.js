'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { getGroupByIdAction } from '../../actions/groupActions';

export default function GroupDetailsPage() {
  const { groupId } = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) { 
      router.push('/login'); 
      return; 
    }
    
    if (user && groupId) {
      getGroupByIdAction(groupId).then(res => {
        if (!res.error) {
          setGroup(res.group);
        }
        setLoading(false);
      });
    }
  }, [user, authLoading, groupId, router]);

  if (authLoading || loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: '100px' }}>
        <h2>Group not found</h2>
        <Link href="/groups" className="btn btn-ghost" style={{ marginTop: '20px' }}>Return to Groups</Link>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="bg-orb bg-orb-gold" style={{ opacity: 0.3 }} />
      
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <Link href="/groups" className="btn btn-ghost" style={{ padding: '4px 0', marginBottom: '12px', fontSize: '14px', display: 'inline-block' }}>
            ← Back to Groups
          </Link>
          <h1 className="page-title" style={{ textTransform: 'uppercase', fontFamily: 'var(--font-display)', fontWeight: '800' }}>
            {group.name}
          </h1>
          <p className="text-secondary" style={{ marginTop: '4px' }}>
            Invite Code: <strong style={{ color: 'var(--color-gold)', letterSpacing: '2px' }}>{group.inviteCode}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Link href={`/session/create?groupId=${group._id}`} className="btn btn-primary">
            ♠ Create Group Session
          </Link>
        </div>
      </div>

      {/* Group Stats & Leaderboard */}
      <div className="card animate-in" style={{ animationDelay: '0.1s' }}>
        <div className="card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 className="card-title">Group Leaderboard</h3>
            <span className="badge badge-gold">Total Sessions: {group.totalSessions || 0}</span>
          </div>
          
          <div className="table-responsive">
            <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  <th style={{ padding: '12px 8px' }}>Player</th>
                  <th style={{ padding: '12px 8px' }}>Sessions</th>
                  <th style={{ padding: '12px 8px' }}>Wins</th>
                  <th style={{ padding: '12px 8px' }}>Highest Win</th>
                  <th style={{ padding: '12px 8px' }}>Highest Loss</th>
                </tr>
              </thead>
              <tbody>
                {group.members && group.members.length > 0 ? (
                  group.members
                    .sort((a, b) => ((b.stats?.wins || 0) - (a.stats?.wins || 0))) // Sort by wins descending
                    .map(member => (
                    <tr key={member.user?._id || member._id} style={{ borderBottom: '1px solid var(--bg-hover)' }}>
                      <td style={{ padding: '16px 8px', fontWeight: 'bold' }}>
                        {member.user?.name || member.name || 'Unknown Player'}
                      </td>
                      <td style={{ padding: '16px 8px', color: 'var(--text-secondary)' }}>
                        {member.stats?.sessions || 0}
                      </td>
                      <td style={{ padding: '16px 8px', color: 'var(--text-secondary)' }}>
                        {member.stats?.wins || 0}
                      </td>
                      <td style={{ padding: '16px 8px', color: 'var(--color-success)' }}>
                        +₹{member.stats?.highestWin || 0}
                      </td>
                      <td style={{ padding: '16px 8px', color: 'var(--color-danger)' }}>
                        -₹{Math.abs(member.stats?.highestLoss || 0)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No members found in this group.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}