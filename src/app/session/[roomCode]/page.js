'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import {
  getSessionDetailAction,
  recordTransactionAction,
  editTransactionAction,
  deleteTransactionAction,
  endSessionAction
} from '../../actions/sessionActions';

const formatINR = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const POLL_INTERVAL = 10000;

export default function SessionRoomPage() {
  const { roomCode } = useParams();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showTxModal, setShowTxModal] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [toast, setToast] = useState(null);
  const pollRef = useRef(null);

  const fetchSession = useCallback(async () => {
    if (!user) return;
    const result = await getSessionDetailAction(user._id, roomCode.toUpperCase());
    if (result.error) { setError(result.error); }
    else { setSession(result.session); }
    setLoading(false);
  }, [roomCode, user]);

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return; }
    if (user) {
      fetchSession();
      pollRef.current = setInterval(fetchSession, POLL_INTERVAL);
      return () => clearInterval(pollRef.current);
    }
  }, [user, authLoading, fetchSession, router]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(session.roomCode);
    showToast('Room code copied!');
  };

  const handleDeleteTx = async (txId) => {
    if (!confirm('Delete this transaction? This will reverse its effect on stacks.')) return;
    const result = await deleteTransactionAction(user._id, session.roomCode, txId);
    if (result.error) showToast(result.error, 'error');
    else { setSession(result.session); showToast('Transaction deleted'); }
  };

  if (authLoading || !user) return null;

  if (loading) return (
    <div className="loading-screen" style={{ position: 'relative', minHeight: 'calc(100vh - 60px)', background: 'transparent' }}>
      <div className="loading-spinner" />
      <span>Loading session...</span>
    </div>
  );

  if (error) return (
    <div className="page" style={{ textAlign: 'center', paddingTop: '80px' }}>
      <div style={{ fontSize: '24px', marginBottom: '16px', color: '#ef4444' }}>⚠</div>
      <h2 style={{ fontFamily: 'var(--font-display)', color: '#ef4444', marginBottom: '8px' }}>{error}</h2>
      <button className="btn btn-outline" onClick={() => router.push('/dashboard')}>Back to Dashboard</button>
    </div>
  );

  if (!session) return null;

  const isAdmin = session.admin?.toString() === user._id?.toString() || session.admin === user._id;
  const isActive = session.status === 'active';
  const totalInPlay = session.players.reduce((s, p) => s + (p.totalBuyIn || 0), 0) + (session.currentBank || 0);
  const isBalanced = Math.abs(totalInPlay - session.initialBank) < 0.01;
  const activeTxs = (session.transactions || []).filter(t => !t.isDeleted);

  return (
    <div className="session-room">
      <div className="bg-orb bg-orb-gold" style={{ opacity: 0.3 }} />

      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="session-header">
        <div>
          <div className="section-badge" style={{ marginBottom: '8px' }}>
            {isActive ? <span className="badge badge-active">● Live</span> : <span className="badge badge-gray">✓ Ended</span>}
          </div>
          <h1 className="session-name">{session.name}</h1>
          {session.group && (
            <p style={{ color: 'var(--color-gold)', fontSize: '13px', fontFamily: 'var(--font-display)', fontWeight: '600', marginTop: '4px' }}>
              ♥ {session.group.name}
            </p>
          )}
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>Admin: {session.adminUsername}</p>
        </div>

        {isActive && (
          <div className="room-code-display" style={{ cursor: 'pointer' }} onClick={handleCopyCode} title="Click to copy">
            <div>
              <div className="room-code-label">Room Code</div>
              <div className="room-code-value">{session.roomCode}</div>
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Copy</span>
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        <div className="bank-display">
          <div className="bank-label">Current Bank</div>
          <div className="bank-amount">{formatINR(session.currentBank)}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', fontFamily: 'var(--font-display)' }}>
            of {formatINR(session.initialBank)} initial
          </div>
        </div>

        <div className="card" style={{ padding: '20px 24px', textAlign: 'center' }}>
          <div className="bank-label" style={{ color: isBalanced ? 'var(--text-muted)' : '#ef4444' }}>
            {isBalanced ? '✓ Conservation OK' : '⚠ Conservation Error!'}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '900', color: isBalanced ? '#22c55e' : '#ef4444', marginTop: '8px' }}>
            {formatINR(totalInPlay)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', fontFamily: 'var(--font-display)' }}>
            Total in play {isBalanced ? '= Initial' : '≠ Initial'}
          </div>
        </div>

        <div className="card" style={{ padding: '20px 24px', textAlign: 'center' }}>
          <div className="bank-label">Players</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '900', color: 'var(--color-gold)', marginTop: '8px' }}>
            {session.players.length}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', fontFamily: 'var(--font-display)' }}>At the table</div>
        </div>
      </div>

      {/* Admin Actions */}
      {isAdmin && isActive && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <button className="btn btn-primary" onClick={() => setShowTxModal(true)}>♠ Record Transaction</button>
          <button className="btn btn-danger" onClick={() => setShowEndModal(true)}>End Session</button>
        </div>
      )}

      {/* Auto-refresh indicator */}
      {isActive && (
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
          Auto-updating every 10s
        </div>
      )}

      {/* Players Grid */}
      <div className="players-grid">
        {session.players.map(player => {
          const isEnded = session.status === 'ended';
          const profit = isEnded && player.finalStack != null
            ? player.finalStack - (player.totalBuyIn || 0)
            : null;
          const isMe = player.user?.toString() === user._id?.toString() || player.user === user._id;
          const isPlayerAdmin = session.admin?.toString() === player.user?.toString() || session.admin === player.user;

          return (
            <div key={player.user} className="card player-card" style={isMe ? { borderColor: 'rgba(201,168,76,0.4)', boxShadow: '0 0 20px rgba(201,168,76,0.1)' } : {}}>
              <div className="player-info">
                <div className="avatar avatar-md" style={{ background: player.avatarColor || '#c9a84c', color: '#0a0a0f', flexShrink: 0 }}>
                  {player.username?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="player-name">
                    {player.username} {isMe && <span style={{ color: 'var(--color-gold)', fontSize: '12px' }}>(You)</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '3px' }}>
                    {isPlayerAdmin && <span className="badge badge-gold" style={{ fontSize: '9px' }}>Admin</span>}
                    {isMe && <span className="badge badge-gray" style={{ fontSize: '9px' }}>You</span>}
                  </div>
                </div>
              </div>

              {isEnded ? (
                /* Post-session: show only profit/loss */
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                  <div style={{
                    fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '900',
                    color: profit > 0 ? '#22c55e' : profit < 0 ? '#ef4444' : 'var(--text-muted)'
                  }}>
                    {profit > 0 ? '+' : ''}{formatINR(profit)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '4px' }}>
                    {profit > 0 ? 'Won' : profit < 0 ? 'Lost' : 'Broke Even'}
                  </div>
                </div>
              ) : (
                /* Active: show current buy-in */
                <>
                  <div className="player-stack" style={{ color: 'var(--color-gold)' }}>
                    {formatINR(player.totalBuyIn || 0)}
                  </div>
                  <div className="player-stats">
                    <span>Buy-in total</span>
                  </div>
                </>
              )}

              {isAdmin && isActive && (
                <div className="player-actions">
                  <button
                    className="btn btn-ghost btn-sm w-full"
                    onClick={() => setShowTxModal({ toPlayerId: player.user, toUsername: player.username })}
                  >
                    + Rebuy / Transfer
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Transaction History */}
      <div style={{ marginTop: '24px' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowHistory(h => !h)} style={{ marginBottom: '16px' }}>
          {showHistory ? 'Hide' : 'View'} Transaction History ({activeTxs.length})
        </button>

        {showHistory && (
          <div className="card">
            <div className="card-body">
              <h3 className="card-title" style={{ marginBottom: '14px' }}>Transaction History</h3>
              {activeTxs.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No transactions yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[...activeTxs].reverse().map((tx) => (
                    <div key={tx._id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 14px', background: 'rgba(255,255,255,0.02)',
                      borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', gap: '10px'
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '13px' }}>
                          {tx.fromUsername} → {tx.toUsername}
                        </span>
                        {tx.note && <span style={{ color: 'var(--text-muted)', marginLeft: '8px', fontSize: '12px' }}>• {tx.note}</span>}
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {tx.type.replace('_', ' ')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--color-gold)' }}>
                          {formatINR(tx.amount)}
                        </span>
                        {isAdmin && isActive && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '4px 10px', fontSize: '11px' }}
                              onClick={() => setEditingTx(tx)}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-sm"
                              style={{ padding: '4px 10px', fontSize: '11px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
                              onClick={() => handleDeleteTx(tx._id)}
                            >
                              Del
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Transaction Modal */}
      {showTxModal && isAdmin && (
        <TransactionModal
          session={session}
          userId={user._id}
          preSelectedTo={typeof showTxModal === 'object' ? showTxModal : null}
          onClose={() => setShowTxModal(false)}
          onSuccess={(updatedSession, warnings) => {
            setSession(updatedSession);
            setShowTxModal(false);
            if (warnings?.length > 0) showToast('⚠ ' + warnings[0], 'warning');
            else showToast('Transaction recorded!');
          }}
          onError={msg => showToast(msg, 'error')}
        />
      )}

      {/* Edit Transaction Modal */}
      {editingTx && (
        <EditTransactionModal
          tx={editingTx}
          session={session}
          userId={user._id}
          onClose={() => setEditingTx(null)}
          onSuccess={(updatedSession) => {
            setSession(updatedSession);
            setEditingTx(null);
            showToast('Transaction updated!');
          }}
          onError={msg => showToast(msg, 'error')}
        />
      )}

      {/* End Session Modal */}
      {showEndModal && (
        <EndSessionModal
          session={session}
          userId={user._id}
          onClose={() => setShowEndModal(false)}
          onSuccess={() => {
            setShowEndModal(false);
            showToast('Session ended! Results saved.');
            fetchSession();
          }}
          onError={msg => showToast(msg, 'error')}
        />
      )}
    </div>
  );
}

// ─── Transaction Modal ─────────────────────────────────────────────────────────
function TransactionModal({ session, userId, preSelectedTo, onClose, onSuccess, onError }) {
  const [form, setForm] = useState({
    fromType: 'bank',
    fromUserId: '',
    toUserId: preSelectedTo?.toPlayerId || '',
    txDirection: 'to_player', // 'to_player' | 'return_to_bank'
    amount: '',
    note: ''
  });
  const [loading, setLoading] = useState(false);

  const handleChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) < 1) { onError('Enter a valid amount'); return; }

    const isReturn = form.txDirection === 'return_to_bank';
    if (isReturn && !form.fromUserId) { onError('Select player to return from'); return; }
    if (!isReturn && !form.toUserId) { onError('Select a recipient'); return; }
    if (!isReturn && form.fromType === 'player' && !form.fromUserId) { onError('Select source player'); return; }
    if (!isReturn && form.fromType === 'player' && form.fromUserId === form.toUserId) { onError('Source and recipient cannot be the same'); return; }

    setLoading(true);
    const toPlayer = !isReturn ? session.players.find(p => p.user === form.toUserId) : null;
    const txType = isReturn ? 'return_to_bank'
      : form.fromType === 'bank' ? (toPlayer?.totalBuyIn === 0 ? 'buyin' : 'rebuy')
      : 'player_transfer';

    const result = await recordTransactionAction(userId, session.roomCode, {
      type: txType,
      fromType: isReturn ? 'player' : form.fromType,
      fromUserId: isReturn ? form.fromUserId : (form.fromType === 'player' ? form.fromUserId : undefined),
      toUserId: isReturn ? undefined : form.toUserId,
      amount: Number(form.amount),
      note: form.note
    });

    setLoading(false);
    if (result.error) onError(result.error);
    else onSuccess(result.session, result.warnings);
  };

  const fromPlayer = session.players.find(p => p.user === form.fromUserId);
  const isReturn = form.txDirection === 'return_to_bank';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">♠ Record Transaction</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            {/* Direction */}
            <div className="form-group">
              <label className="form-label">Transaction Type</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  { val: 'to_player', label: 'Bank → Player', sub: 'Buy-in / Rebuy' },
                  { val: 'return_to_bank', label: 'Player → Bank', sub: 'Return chips' }
                ].map(opt => (
                  <label key={opt.val} style={{
                    display: 'flex', flexDirection: 'column', gap: '4px', padding: '12px 14px',
                    background: form.txDirection === opt.val ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${form.txDirection === opt.val ? 'rgba(201,168,76,0.4)' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.2s'
                  }}>
                    <input type="radio" name="txDirection" value={opt.val} checked={form.txDirection === opt.val} onChange={handleChange} style={{ display: 'none' }} />
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '13px', color: form.txDirection === opt.val ? 'var(--color-gold)' : 'var(--text-primary)' }}>{opt.label}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{opt.sub}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Player transfer option (only for to_player) */}
            {!isReturn && (
              <div className="form-group">
                <label className="form-label">Money From</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {[
                    { val: 'bank', label: 'Bank', sub: `₹${Number(session.currentBank || 0).toLocaleString('en-IN')} remaining` },
                    { val: 'player', label: 'Player', sub: 'Chip transfer' }
                  ].map(opt => (
                    <label key={opt.val} style={{
                      display: 'flex', flexDirection: 'column', gap: '4px', padding: '12px 14px',
                      background: form.fromType === opt.val ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${form.fromType === opt.val ? 'rgba(201,168,76,0.4)' : 'var(--border-subtle)'}`,
                      borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.2s'
                    }}>
                      <input type="radio" name="fromType" value={opt.val} checked={form.fromType === opt.val} onChange={handleChange} style={{ display: 'none' }} />
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '13px', color: form.fromType === opt.val ? 'var(--color-gold)' : 'var(--text-primary)' }}>{opt.label}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{opt.sub}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Source player selector */}
            {(!isReturn && form.fromType === 'player' || isReturn) && (
              <div className="form-group">
                <label className="form-label">{isReturn ? 'Player Returning ♠' : 'Source Player ♠'}</label>
                <select name="fromUserId" className="form-input form-select" value={form.fromUserId} onChange={handleChange}>
                  <option value="">— Select player —</option>
                  {session.players.map(p => (
                    <option key={p.user} value={p.user}>
                      {p.username} (Buy-in: ₹{Number(p.totalBuyIn || 0).toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Recipient */}
            {!isReturn && (
              <div className="form-group">
                <label className="form-label">Recipient Player ♥</label>
                <select name="toUserId" className="form-input form-select" value={form.toUserId} onChange={handleChange}>
                  <option value="">— Select player —</option>
                  {session.players
                    .filter(p => form.fromType === 'bank' || p.user !== form.fromUserId)
                    .map(p => (
                      <option key={p.user} value={p.user}>
                        {p.username} (Buy-in: ₹{Number(p.totalBuyIn || 0).toLocaleString('en-IN')})
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Amount ♦ (₹)</label>
              <input type="number" name="amount" className="form-input" placeholder="Enter amount" value={form.amount} onChange={handleChange} min={1} step={1} />
              {fromPlayer && (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                  {fromPlayer.username} buy-in: ₹{Number(fromPlayer.totalBuyIn || 0).toLocaleString('en-IN')}
                </p>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Note ♣ (optional)</label>
              <input type="text" name="note" className="form-input" placeholder="e.g., First buy-in, Side game..." value={form.note} onChange={handleChange} maxLength={100} />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                {loading ? 'Recording...' : 'Confirm'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Transaction Modal ────────────────────────────────────────────────────
function EditTransactionModal({ tx, session, userId, onClose, onSuccess, onError }) {
  const [amount, setAmount] = useState(String(tx.amount));
  const [note, setNote] = useState(tx.note || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!amount || Number(amount) < 1) { onError('Amount must be at least ₹1'); return; }
    setLoading(true);
    const result = await editTransactionAction(userId, session.roomCode, tx._id, Number(amount), note);
    setLoading(false);
    if (result.error) onError(result.error);
    else onSuccess(result.session);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <h2 className="modal-title">Edit Transaction</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ padding: '10px 14px', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>
            {tx.fromUsername} → {tx.toUsername} • {tx.type.replace('_', ' ')}
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Amount (₹)</label>
              <input type="number" className="form-input" value={amount} onChange={e => setAmount(e.target.value)} min={1} step={1} required />
            </div>
            <div className="form-group">
              <label className="form-label">Note (optional)</label>
              <input type="text" className="form-input" value={note} onChange={e => setNote(e.target.value)} maxLength={100} placeholder="Update note..." />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── End Session Modal (multi-confirm) ────────────────────────────────────────
function EndSessionModal({ session, userId, onClose, onSuccess, onError }) {
  const router = useRouter();
  const [finalStacks, setFinalStacks] = useState(
    Object.fromEntries(session.players.map(p => [p.user, p.totalBuyIn || 0]))
  );
  const [confirmStep, setConfirmStep] = useState(0); // 0=enter stacks, 1=first confirm, 2=final confirm
  const [loading, setLoading] = useState(false);

  const totalFinal = Object.values(finalStacks).reduce((s, v) => s + Number(v || 0), 0);
  const isBalanced = Math.abs(totalFinal + (session.currentBank || 0) - session.initialBank) < 0.01;

  const handleSubmit = async () => {
    setLoading(true);
    const result = await endSessionAction(userId, session.roomCode, finalStacks);
    setLoading(false);
    if (result.error) { onError(result.error); setConfirmStep(0); }
    else {
      onSuccess();
      setTimeout(() => router.push('/dashboard'), 1500);
    }
  };

  return (
    <div className="modal-overlay" onClick={confirmStep === 0 ? onClose : undefined}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px' }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ color: confirmStep > 0 ? '#ef4444' : 'var(--text-primary)' }}>
            {confirmStep === 0 ? 'End Session' : confirmStep === 1 ? '⚠ Are you sure?' : '🔴 Final Confirmation'}
          </h2>
          {confirmStep === 0 && <button className="modal-close" onClick={onClose}>✕</button>}
        </div>
        <div className="modal-body">
          {confirmStep === 0 && (
            <>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px', fontFamily: 'var(--font-display)' }}>
                Enter each player's final chip count. Only P/L will be displayed after this.
              </p>
              <div style={{ marginBottom: '16px' }}>
                {session.players.map(p => (
                  <div key={p.user} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div className="avatar avatar-sm" style={{ background: p.avatarColor || '#c9a84c', color: '#0a0a0f', flexShrink: 0 }}>
                      {p.username?.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '14px' }}>{p.username}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        Buy-in: ₹{Number(p.totalBuyIn || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      <input
                        type="number" className="form-input"
                        style={{ width: '120px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}
                        value={finalStacks[p.user] ?? ''}
                        onChange={e => setFinalStacks(prev => ({ ...prev, [p.user]: e.target.value }))}
                        placeholder="Final ₹" min={0}
                      />
                      {finalStacks[p.user] !== '' && (
                        <span style={{ fontSize: '12px', fontFamily: 'var(--font-display)', fontWeight: '700', color: (Number(finalStacks[p.user]) - (p.totalBuyIn || 0)) >= 0 ? '#22c55e' : '#ef4444' }}>
                          {(Number(finalStacks[p.user]) - (p.totalBuyIn || 0)) >= 0 ? '+' : ''}₹{Math.abs(Number(finalStacks[p.user]) - (p.totalBuyIn || 0)).toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ padding: '12px 14px', background: isBalanced ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${isBalanced ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 'var(--radius-md)', fontSize: '13px', fontFamily: 'var(--font-display)', fontWeight: '600', marginBottom: '20px' }}>
                {isBalanced
                  ? <span style={{ color: '#22c55e' }}>✓ Conservation check passed</span>
                  : <span style={{ color: '#ef4444' }}>⚠ Mismatch! Total + bank = ₹{Number(totalFinal + (session.currentBank || 0)).toLocaleString('en-IN')} vs ₹{Number(session.initialBank).toLocaleString('en-IN')}</span>}
              </div>
            </>
          )}

          {confirmStep === 1 && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '16px', color: 'var(--text-primary)', marginBottom: '8px' }}>
                This will permanently end the session.
              </p>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                All {session.players.length} player results will be saved to the group leaderboard.
              </p>
              {!isBalanced && (
                <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', color: '#ef4444', fontSize: '13px', fontFamily: 'var(--font-display)', fontWeight: '600', marginTop: '12px' }}>
                  ⚠ Conservation check FAILED. Stacks don't add up.
                </div>
              )}
            </div>
          )}

          {confirmStep === 2 && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔴</div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '18px', color: '#ef4444', marginBottom: '8px', fontWeight: '800' }}>
                FINAL WARNING
              </p>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                Once ended, this session cannot be reopened. Are you absolutely sure?
              </p>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button className="btn btn-ghost" onClick={confirmStep === 0 ? onClose : () => setConfirmStep(s => s - 1)}>
            {confirmStep === 0 ? 'Cancel' : '← Back'}
          </button>

          {confirmStep < 2 ? (
            <button className="btn btn-danger" onClick={() => setConfirmStep(s => s + 1)}>
              {confirmStep === 0 ? 'End Session →' : 'Yes, I\'m Sure →'}
            </button>
          ) : (
            <button className="btn btn-danger" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Ending...' : '🔴 End Session & Save Results'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}