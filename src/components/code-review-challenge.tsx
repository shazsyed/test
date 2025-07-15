
import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, XCircle, AlertTriangle, ArrowLeft, Lightbulb, Lock, Unlock, X } from "lucide-react"
import { challenges } from "@/data/challenges"
import type { Challenge } from "@/types/challenge"
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { io, Socket } from 'socket.io-client'

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4001';

// Simple avatar generator: pick a random emoji
const AVATARS = ["🦊", "🐻", "🐼", "🐸", "🐵", "🐶", "🐱", "🦁", "🐯", "🐨", "🐰", "🦄", "🐙", "🐧", "🐢", "🐦", "🐝", "🐬", "🦋", "🐞"];
function getRandomAvatar() {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)];
}


function UserBar({ name, avatar, score, isAdmin, onAdminLogout }: { name: string; avatar: string; score: number; isAdmin: boolean; onAdminLogout: () => void }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-3 bg-white/80 shadow rounded-full px-4 py-2 border border-gray-200">
      <span className="text-2xl select-none" aria-label="avatar">{avatar}</span>
      <span className="font-medium text-gray-800">{name}</span>
      <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">Score: {score}</span>
      {isAdmin && (
        <Button size="sm" variant="outline" onClick={onAdminLogout}>Logout Admin</Button>
      )}
    </div>
  );
}

function NameModal({ open, onSubmit }: { open: boolean; onSubmit: (name: string) => void }) {
  const [input, setInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setAvailable(null);
    setError("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!input.trim()) {
      setAvailable(null);
      setError("");
      return;
    }
    debounceRef.current = setTimeout(() => {
      checkAvailability(input.trim());
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  const checkAvailability = async (name: string) => {
    setChecking(true);
    setError("");
    try {
      const res = await fetch("/api/check-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name })
      });
      const data = await res.json();
      setAvailable(data.available);
      if (!data.available) setError("Username is already taken");
    } catch {
      setError("Could not check username availability");
      setAvailable(null);
    } finally {
      setChecking(false);
    }
  };

  const handleContinue = () => {
    if (input.trim() && available) onSubmit(input.trim());
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-xs flex flex-col items-center gap-4">
        <h2 className="text-xl font-bold mb-2">Welcome!</h2>
        <p className="text-gray-600 text-sm mb-2">Enter your name to get started:</p>
        <input
          className="border rounded px-3 py-2 w-full focus:outline-none focus:ring"
          placeholder="Your name"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={async e => {
            if (e.key === 'Enter' && input.trim() && available) {
              onSubmit(input.trim());
            }
          }}
        />
        {checking && <div className="text-xs text-gray-500">Checking availability...</div>}
        {error && <div className="text-xs text-red-600">{error}</div>}
        <Button className="w-full mt-2" onClick={handleContinue} disabled={checking || available !== true}>
          Continue
        </Button>
      </div>
    </div>
  );
}

function AdminModal({ open, onSubmit, onClose, error }: { open: boolean, onSubmit: (password: string) => void, onClose: () => void, error?: string }) {
  const [input, setInput] = useState("");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-xs flex flex-col items-center gap-4 relative">
        <button
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 focus:outline-none"
          onClick={onClose}
          aria-label="Close"
          type="button"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-xl font-bold mb-2">Admin Login</h2>
        <p className="text-gray-600 text-sm mb-2">Enter admin password:</p>
        <input
          className="border rounded px-3 py-2 w-full focus:outline-none focus:ring"
          placeholder="Password"
          type="password"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && input.trim()) onSubmit(input.trim()); }}
        />
        {error && <div className="text-red-600 text-xs">{error}</div>}
        <div className="flex gap-2 w-full">
          <Button className="w-full mt-2" onClick={() => input.trim() && onSubmit(input.trim())}>Login</Button>
        </div>
      </div>
    </div>
  );
}

// --- Timer Hook ---
function useChallengeTimer(selectedChallenge: Challenge | null) {
  const [timer, setTimer] = useState<{ startTime: number; duration: number; isRunning: boolean; isPaused: boolean } | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!selectedChallenge) return;
    if (!socketRef.current) {
      socketRef.current = io(SOCKET_URL, { transports: ['websocket'] });
    }
    const socket = socketRef.current;
    const handleTimerUpdate = (data: { challengeId: string; startTime: number; duration: number; isRunning: boolean; isPaused: boolean; remaining?: number }) => {
      if (data.challengeId === selectedChallenge.id) {
        setTimer({ startTime: data.startTime, duration: data.duration, isRunning: data.isRunning, isPaused: !!data.isPaused });
        // If paused, set timeLeft to remaining
        if (data.isPaused && typeof data.remaining === 'number') {
          setTimeLeft(Math.max(0, Math.floor(data.remaining / 1000)));
        }
      }
    };
    socket.on('timer:update', handleTimerUpdate);
    return () => {
      socket.off('timer:update', handleTimerUpdate);
    };
  }, [selectedChallenge]);

  useEffect(() => {
    if (!timer) {
      setTimeLeft(0);
      return;
    }
    if (timer.isPaused) {
      // Don't tick when paused
      return;
    }
    if (!timer.isRunning) {
      setTimeLeft(0);
      return;
    }
    const interval = setInterval(() => {
      const now = Date.now();
      const end = timer.startTime + timer.duration;
      setTimeLeft(Math.max(0, Math.floor((end - now) / 1000)));
    }, 250);
    return () => clearInterval(interval);
  }, [timer]);

  return { timer, timeLeft };
}

// --- Timer Display ---
function TimerDisplay({ timeLeft }: { timeLeft: number }) {
  const min = Math.floor(timeLeft / 60);
  const sec = timeLeft % 60;
  return (
    <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded font-mono text-lg min-w-[70px] text-center">
      {min}:{sec.toString().padStart(2, '0')}
    </span>
  );
}

// --- AdminPanel with Timer Start ---
export function AdminPanel({ locks, onToggleLock }: { locks: Record<string, boolean>, onToggleLock: (id: string) => void }) {
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [timerDurations, setTimerDurations] = useState<Record<string, number>>({});
  const [timers, setTimers] = useState<Record<string, { startTime: number; duration: number; isRunning: boolean; isPaused: boolean; remaining?: number }>>({});
  const [timeLefts, setTimeLefts] = useState<Record<string, number>>({});
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!socketRef.current) {
      socketRef.current = io(SOCKET_URL, { transports: ['websocket'] });
    }
    const socket = socketRef.current;
    const handleTimerUpdate = (data: { challengeId: string; startTime: number; duration: number; isRunning: boolean; isPaused: boolean; remaining?: number }) => {
      setTimers(prev => ({
        ...prev,
        [data.challengeId]: {
          startTime: data.startTime,
          duration: data.duration,
          isRunning: data.isRunning,
          isPaused: data.isPaused,
          ...(typeof data.remaining === 'number' ? { remaining: data.remaining } : {})
        }
      }));
    };
    socket.on('timer:update', handleTimerUpdate);
    return () => {
      socket.off('timer:update', handleTimerUpdate);
    };
  }, []);

  // Update ticking timers for admin
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLefts(prev => {
        const updated: Record<string, number> = { ...prev };
        Object.entries(timers).forEach(([challengeId, timer]) => {
          if (timer.isPaused && typeof (timer as any).remaining === 'number') {
            updated[challengeId] = Math.max(0, Math.floor((timer as any).remaining / 1000));
          } else if (timer.isRunning) {
            const now = Date.now();
            const end = timer.startTime + timer.duration;
            updated[challengeId] = Math.max(0, Math.floor((end - now) / 1000));
          } else {
            updated[challengeId] = 0;
          }
        });
        return updated;
      });
    }, 250);
    return () => clearInterval(interval);
  }, [timers]);

  const handleStartTimer = (challengeId: string) => {
    const durationMinutes = timerDurations[challengeId] || 5; // default 5 min
    socketRef.current?.emit('admin:startTimer', { challengeId, duration: durationMinutes * 60 * 1000 });
  };

  const handleDurationChange = (challengeId: string, value: string) => {
    const num = Math.max(1, Math.min(60, parseInt(value) || 0));
    setTimerDurations(prev => ({ ...prev, [challengeId]: num }));
  };

  const getTimeLeft = (challengeId: string) => {
    return timeLefts[challengeId] || 0;
  };

  const handleReset = async () => {
    if (!window.confirm('Are you sure you want to reset everything? This cannot be undone.')) return;
    setResetting(true);
    setResetSuccess(false);
    const res = await fetch('/api/admin-reset', { method: 'POST' });
    setResetting(false);
    if (res.ok) setResetSuccess(true);
  };

  const handlePauseTimer = (challengeId: string) => {
    socketRef.current?.emit('admin:pauseTimer', { challengeId });
  };
  const handleResumeTimer = (challengeId: string) => {
    socketRef.current?.emit('admin:resumeTimer', { challengeId });
  };
  const handleResetTimer = (challengeId: string) => {
    socketRef.current?.emit('admin:resetTimer', { challengeId });
    // Clear local timer state for this challenge so Start Timer is shown again
    setTimers(prev => {
      const copy = { ...prev };
      delete copy[challengeId];
      return copy;
    });
    setTimeLefts(prev => {
      const copy = { ...prev };
      delete copy[challengeId];
      return copy;
    });
  };

  // Call this when a challenge is locked
  useEffect(() => {
    Object.entries(locks).forEach(([challengeId, locked]) => {
      if (locked && timers[challengeId]) {
        handleResetTimer(challengeId);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locks]);

  console.log("HOME Socket", SOCKET_URL)

  return (
    <div className="max-w-4xl mx-auto mt-10 bg-white rounded-lg shadow p-10">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Unlock className="h-5 w-5 text-green-600" /> Admin Challenge Unlocks</h2>
      <div className="mb-6">
        <Button variant="destructive" onClick={handleReset} disabled={resetting}>
          {resetting ? 'Resetting...' : 'Reset Everything'}
        </Button>
        {resetSuccess && <span className="ml-4 text-green-700 font-semibold">Database reset!</span>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {challenges.map((challenge) => {
          const isLocked = locks[challenge.id] !== false; // default locked
          const timeLeft = getTimeLeft(challenge.id);
          const timer = timers[challenge.id];
          return (
            <Card key={challenge.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {isLocked ? <Lock className="h-4 w-4 text-gray-400" /> : <Unlock className="h-4 w-4 text-green-500" />}
                  {challenge.title}
                </CardTitle>
                <CardDescription>{challenge.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2 justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        variant={!isLocked ? "destructive" : "outline"}
                        className={isLocked ? "border-green-600 text-green-700 hover:bg-green-50 hover:text-green-900" : ""}
                        onClick={() => onToggleLock(challenge.id)}
                      >
                        {isLocked ? "Unlock" : "Lock"}
                      </Button>
                      {!isLocked && (!timer || (!timer.isRunning && !timer.isPaused)) && (
                        <input
                          type="number"
                          min={1}
                          max={60}
                          value={timerDurations[challenge.id] || 5}
                          onChange={e => handleDurationChange(challenge.id, e.target.value)}
                          className="border rounded px-2 py-1 w-20 text-sm"
                          placeholder="Minutes"
                        />
                      )}
                    </div>
                    {!isLocked && (
                      <div className="flex items-center gap-2">
                        {timer && timer.isRunning && !timer.isPaused ? (
                          <>
                            <Button variant="secondary" onClick={() => handlePauseTimer(challenge.id)}>
                              Pause Timer
                            </Button>
                            <Button variant="outline" onClick={() => handleResetTimer(challenge.id)}>
                              Reset Timer
                            </Button>
                          </>
                        ) : timer && timer.isPaused ? (
                          <>
                            <Button variant="default" onClick={() => handleResumeTimer(challenge.id)}>
                              Resume Timer
                            </Button>
                            <Button variant="outline" onClick={() => handleResetTimer(challenge.id)}>
                              Reset Timer
                            </Button>
                          </>
                        ) : (
                          <Button variant="default" onClick={() => handleStartTimer(challenge.id)}>
                            Start Timer
                          </Button>
                        )}
                        {/* Timer display for admin: show if running or paused and time left > 0 */}
                        {(timer && (timer.isRunning || timer.isPaused) && timeLeft > 0) && <TimerDisplay timeLeft={timeLeft} />}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Leaderboard({ currentUser }: { currentUser: { name: string; avatar: string; score: number } }) {
  const [users, setUsers] = useState<{ name: string; avatar: string; score: number }[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch leaderboard on mount and every 5 seconds
  useEffect(() => {
    const fetchLeaderboard = () => {
      fetch('/api/leaderboard')
        .then(res => res.json())
        .then(setUsers);
    };
    fetchLeaderboard();
    intervalRef.current = setInterval(fetchLeaderboard, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // If current user is not in the top, show them at the bottom
  const inTop = users.some(u => u.name === currentUser.name);
  const displayUsers = inTop ? users : [...users, currentUser];

  // Medal icons for top 3
  const medalIcons = [
    <span key="gold" aria-label="1st" className="text-2xl mr-2">🥇</span>,
    <span key="silver" aria-label="2nd" className="text-2xl mr-2">🥈</span>,
    <span key="bronze" aria-label="3rd" className="text-2xl mr-2">🥉</span>,
  ];

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md mx-auto mt-6 md:mt-0 md:ml-8 border border-gray-100">
      <h3 className="text-2xl font-extrabold mb-5 text-center flex items-center justify-center gap-2 tracking-tight">
        <span>🏆</span> Leaderboard
      </h3>
      <ul className="space-y-2">
        {displayUsers.map((user, idx) => {
          const isCurrent = user.name === currentUser.name;
          const isTop5 = idx < 5;
          let positionIcon = null;
          let positionClass = "";
          let badge = null;

          if (idx < 3) {
            positionIcon = medalIcons[idx];
            positionClass = [
              "bg-gradient-to-r from-yellow-100 to-yellow-50 border-yellow-300",
              "bg-gradient-to-r from-gray-200 to-gray-50 border-gray-300",
              "bg-gradient-to-r from-amber-200 to-amber-50 border-amber-300"
            ][idx];
          } else if (isTop5) {
            badge = (
              <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold border border-blue-200">Top 5</span>
            );
            positionClass = "bg-blue-50 border-blue-200";
          }

          return (
            <li
              key={user.name}
              className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${positionClass} ${isCurrent && !isTop5 ? "ring-2 ring-blue-400 bg-blue-50 font-bold" : ""} ${isCurrent ? "shadow-md" : ""}`}
              style={{ boxShadow: isCurrent ? '0 2px 8px 0 rgba(59,130,246,0.08)' : undefined }}
            >
              <div className="flex items-center gap-3">
                {positionIcon}
                <span className="text-xl select-none" aria-label="avatar">{user.avatar}</span>
                <span className={`truncate max-w-[120px] text-base ${isCurrent ? "text-blue-900" : "text-gray-800"}`}>{user.name}</span>
                {badge}
                {isCurrent && !isTop5 && (
                  <span className="ml-2 px-2 py-0.5 bg-blue-200 text-blue-900 rounded-full text-xs font-semibold border border-blue-300">You</span>
                )}
              </div>
              <span className={`text-lg font-bold ${idx === 0 ? "text-yellow-600" : idx === 1 ? "text-gray-500" : idx === 2 ? "text-amber-700" : "text-blue-700"}`}>{user.score}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Resizable container for the challenge card
function ResizableCard({ children, defaultWidth = 0 }: { children: React.ReactNode, defaultWidth?: number }) {
  const [width, setWidth] = useState(defaultWidth); // Use defaultWidth as initial value
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const startDrag = useCallback((e: React.MouseEvent) => {
    setDragging(true);
    document.body.style.cursor = "ew-resize";
  }, []);

  const onDrag = useCallback((e: MouseEvent) => {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const minWidth = 320;
    const maxWidth = 900;
    let newWidth = e.clientX - rect.left;
    newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
    setWidth(newWidth);
  }, [dragging]);

  const stopDrag = useCallback(() => {
    setDragging(false);
    document.body.style.cursor = "";
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent) => onDrag(e);
    const up = () => stopDrag();
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [dragging, onDrag, stopDrag]);

  return (
    <div
      ref={containerRef}
      className="relative bg-transparent"
      style={{ width: width ? width : undefined, minWidth: 320, maxWidth: 900 }}
    >
      <div>{children}</div>
      <div
        className="absolute top-0 right-0 h-full w-2 cursor-ew-resize z-20 flex items-center group"
        onMouseDown={startDrag}
        style={{ userSelect: "none" }}
      >
        <div className="w-1 h-16 bg-gray-300 rounded-full opacity-60 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

// --- ChallengeTimer component ---
function ChallengeTimer({ selectedChallenge }: { selectedChallenge: Challenge }) {
  const { timeLeft } = useChallengeTimer(selectedChallenge);
  if (!timeLeft) return null;
  return <TimerDisplay timeLeft={timeLeft} />;
}

// Add a hook to get all running/paused timers for the challenge list
function useAllChallengeTimers() {
  const [timers, setTimers] = useState<Record<string, { startTime: number; duration: number; isRunning: boolean; isPaused: boolean; remaining?: number }>>({});
  const [timeLefts, setTimeLefts] = useState<Record<string, number>>({});
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!socketRef.current) {
      socketRef.current = io(SOCKET_URL, { transports: ['websocket'] });
    }
    const socket = socketRef.current;
    const handleTimerUpdate = (data: { challengeId: string; startTime: number; duration: number; isRunning: boolean; isPaused: boolean; remaining?: number }) => {
      setTimers(prev => ({ ...prev, [data.challengeId]: data }));
    };
    socket.on('timer:update', handleTimerUpdate);
    return () => {
      socket.off('timer:update', handleTimerUpdate);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLefts(prev => {
        const updated: Record<string, number> = { ...prev };
        Object.entries(timers).forEach(([challengeId, timer]) => {
          if (timer.isPaused && typeof (timer as any).remaining === 'number') {
            updated[challengeId] = Math.max(0, Math.floor((timer as any).remaining / 1000));
          } else if (timer.isRunning) {
            const now = Date.now();
            const end = timer.startTime + timer.duration;
            updated[challengeId] = Math.max(0, Math.floor((end - now) / 1000));
          } else {
            updated[challengeId] = 0;
          }
        });
        return updated;
      });
    }, 250);
    return () => clearInterval(interval);
  }, [timers]);

  return { timers, timeLefts };
}

// Utility to generate dynamic lab URL
function getDynamicLabUrl(labPath: string) {
  if (typeof window === 'undefined') return '';
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:8888${labPath}`;
}

export default function CodeReviewChallenge() {
  // User state
  const [user, setUser] = useState({ name: "", avatar: "", score: 0 });
  const [showNameModal, setShowNameModal] = useState(false);

  // Admin state
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminError, setAdminError] = useState("");

  // Challenge lock state (persisted via API)
  const [locks, setLocks] = useState<Record<string, boolean>>({});

  // Challenge state
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null)
  const [selectedLines, setSelectedLines] = useState<number[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [showHints, setShowHints] = useState(false)
  const [alreadySolved, setAlreadySolved] = useState(false);
  const [flagAlreadySolved, setFlagAlreadySolved] = useState(false);

  // Track if the last submission was correct
  const [lastSubmissionCorrect, setLastSubmissionCorrect] = useState<boolean | null>(null);

  // Attempts state
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState(2);

  // Open Lab state
  const [openLabChallenge, setOpenLabChallenge] = useState<string | null>(null);
  const [flagInput, setFlagInput] = useState("");
  const [flagStatus, setFlagStatus] = useState<{ status: 'idle' | 'loading' | 'success' | 'error' | 'already'; message?: string }>({ status: 'idle' });

  // --- Flag submission state for challenge view ---
  const [flagChallengeLoading, setFlagChallengeLoading] = useState(false);
  const [flagChallengeStatus, setFlagChallengeStatus] = useState<{ status: 'idle' | 'loading' | 'success' | 'error' | 'already'; message?: string }>({ status: 'idle' });

  // Move this hook call here so it's always called, before any early returns
  const { timers: allTimers, timeLefts: allTimeLefts } = useAllChallengeTimers();

  // On mount, load user/admin from localStorage, and fetch locks from API
  useEffect(() => {
    const stored = localStorage.getItem("crc_user");
    if (stored) {
      const parsed = JSON.parse(stored);
      // Fetch actual score from backend
      fetch('/api/leaderboard')
        .then(res => res.json())
        .then(users => {
          const found = users.find((u: any) => u.name === parsed.name);
          setUser({
            name: parsed.name,
            avatar: parsed.avatar,
            score: found ? found.score : 0,
          });
        });
    } else setShowNameModal(true);
    const admin = localStorage.getItem("crc_admin");
    setIsAdmin(admin === "true");
    // Fetch locks from API
    fetch('/api/challenge-locks')
      .then(res => res.json())
      .then(data => setLocks(data));
  }, []);

  // Save user and admin state to localStorage
  useEffect(() => {
    if (user.name) localStorage.setItem("crc_user", JSON.stringify(user));
  }, [user]);
  useEffect(() => {
    localStorage.setItem("crc_admin", isAdmin ? "true" : "false");
  }, [isAdmin]);

  const handleNameSubmit = (name: string) => {
    setUser({ name, avatar: getRandomAvatar(), score: 0 });
    setShowNameModal(false);
  };

  // Admin login/logout logic
  const handleAdminLogin = () => {
    setShowAdminModal(true);
    setAdminError("");
  };
  const handleAdminLogout = () => {
    setIsAdmin(false);
  };
  const handleAdminModalSubmit = (password: string) => {
    if (password === "admin123") {
      setIsAdmin(true);
      setShowAdminModal(false);
      setAdminError("");
    } else {
      setAdminError("Incorrect password");
    }
  };

  // Challenge lock/unlock logic (persist to API)
  const handleToggleLock = async (id: string) => {
    // If currently locked (undefined or true), unlock (set to false). If unlocked (false), lock (set to true).
    const isLocked = locks[id] !== false;
    const newLocked = !isLocked;
    setLocks(prev => ({ ...prev, [id]: newLocked })); // Optimistic update
    await fetch('/api/challenge-locks', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, locked: newLocked })
    });
    // Reset timer if locking the challenge
    if (newLocked && isAdmin) {
      const socket = io(SOCKET_URL, { transports: ['websocket'] });
      socket.emit('admin:resetTimer', { challengeId: id });
      socket.disconnect();
    }
    // Optionally, re-fetch locks from API for consistency
    // const data = await fetch("/api/challenge-locks").then(res => res.json());
    // setLocks(data);
  };

  const handleSelectChallenge = (challenge: Challenge) => {
    // By default, all challenges are locked unless explicitly unlocked
    const isLocked = locks[challenge.id] !== false;
    if (!isAdmin && isLocked) return;
    setSelectedChallenge(challenge)
    setSelectedLines([])
    setSubmitted(false)
    setShowResults(false)
    setShowHints(false)
    setFlagInput("");
    setFlagChallengeStatus({ status: 'idle' });
  }

  // Check if user has already solved the selected challenge (challenge submission)
  useEffect(() => {
    const checkAlreadySolved = async () => {
      if (selectedChallenge && user.name) {
        const res = await fetch('/api/challenge-status', {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: user.name,
            challengeId: selectedChallenge.id,
          }),
        });
        const data = await res.json();
        setAlreadySolved(!!data.solved);
      } else {
        setAlreadySolved(false);
      }
    };
    checkAlreadySolved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChallenge, user.name]);

  // Check if user has already solved the flag for the selected challenge
  useEffect(() => {
    const checkFlagAlreadySolved = async () => {
      if (selectedChallenge && user.name) {
        const res = await fetch('/api/flag-status', {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: user.name,
            challengeId: selectedChallenge.id,
          }),
        });
        const data = await res.json();
        setFlagAlreadySolved(!!data.solved);
      } else {
        setFlagAlreadySolved(false);
      }
    };
    checkFlagAlreadySolved();
  }, [selectedChallenge, user.name]);

  // Fetch attempts when challenge or user changes
  useEffect(() => {
    const fetchAttempts = async () => {
      if (selectedChallenge && user.name) {
        const res = await fetch('/api/challenge-attempts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: user.name, challengeId: selectedChallenge.id })
        });
        const data = await res.json();
        setAttemptsUsed(data.attemptsUsed);
        setAttemptsRemaining(data.attemptsRemaining);
      } else {
        setAttemptsUsed(0);
        setAttemptsRemaining(2);
      }
    };
    fetchAttempts();
  }, [selectedChallenge, user.name]);

  const handleSubmit = async () => {
    setSubmitted(true);
    setShowResults(true);
    if (selectedChallenge && selectedLines.length > 0) {
      // Send selectedLines array to backend
      const res = await fetch('/api/submit-challenge', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: user.name,
          avatar: user.avatar,
          challengeId: selectedChallenge.id,
          selectedLines: selectedLines,
        }),
      });
      const data = await res.json();
      // Determine correctness: all vulnerable lines must be selected, and no extra lines
      const vulnerableLines = selectedChallenge.vulnerableLines;
      const selectedSet = new Set(selectedLines);
      const vulnerableSet = new Set(vulnerableLines);
      const allCorrect =
        selectedLines.length === vulnerableLines.length &&
        selectedLines.every((line) => vulnerableSet.has(line));
      setLastSubmissionCorrect(allCorrect);
      if (allCorrect) setAlreadySolved(true);
      else setAlreadySolved(false);
      // Update attempts from backend response
      if (typeof data.attemptsUsed === 'number') setAttemptsUsed(data.attemptsUsed);
      if (typeof data.attemptsRemaining === 'number') setAttemptsRemaining(data.attemptsRemaining);
      // Optionally, use data.feedback for per-line feedback if needed
      // Optionally, update score or attempts from backend response
      // setUser(u => ({ ...u, score: data.score }));
      // setAttemptsUsed(data.attemptsUsed);
      // setAttemptsRemaining(data.attemptsRemaining);
    }
  }

  const handleReset = () => {
    setSelectedLines([])
    setSubmitted(false)
    setShowResults(false)
    setShowHints(false)
  }

  const handleBackToChallenges = () => {
    setSelectedChallenge(null)
    setSelectedLines([])
    setSubmitted(false)
    setShowResults(false)
    setShowHints(false)
    setOpenLabChallenge(null)
    setFlagInput("");
    setFlagChallengeStatus({ status: 'idle' });
  }

  const toggleLine = (lineNumber: number) => {
    if (submitted) return;
    const maxSelectable = selectedChallenge?.maxSelectableLines ?? 1;
    if (!selectedLines.includes(lineNumber) && selectedLines.length >= maxSelectable) {
      // Optionally, show a warning or ignore further selection
      return;
    }
    setSelectedLines((prev) =>
      prev.includes(lineNumber) ? prev.filter((l) => l !== lineNumber) : [...prev, lineNumber]
    );
  }

  const getLineStatus = (lineNumber: number) => {
    if (!showResults || !selectedChallenge) return null;
    const isSelected = selectedLines.includes(lineNumber);
    const isVulnerable = selectedChallenge.vulnerableLines.includes(lineNumber);
    if (isSelected && isVulnerable) return "correct";
    if (isSelected && !isVulnerable) return "incorrect";
    return null;
  }

  // Helper to refresh solved states for both challenge and flag
  const refreshSolvedStates = useCallback(() => {
    // Check if user has already solved the selected challenge (challenge submission)
    if (selectedChallenge && user.name) {
      fetch('/api/challenge-status', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: user.name,
          challengeId: selectedChallenge.id,
        }),
      })
        .then(res => res.json())
        .then(data => setAlreadySolved(!!data.solved));

      fetch('/api/flag-status', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: user.name,
          challengeId: selectedChallenge.id,
        }),
      })
        .then(res => res.json())
        .then(data => setFlagAlreadySolved(!!data.solved));
    }
  }, [selectedChallenge, user.name]);

  // Show name modal if needed
  if (showNameModal) {
    return <NameModal open={showNameModal} onSubmit={handleNameSubmit} />
  }

  // Show admin modal if needed
  if (showAdminModal) {
    return <AdminModal open={showAdminModal} onSubmit={handleAdminModalSubmit} onClose={() => setShowAdminModal(false)} error={adminError} />
  }

  // Show admin panel if admin
  if (isAdmin && !selectedChallenge) {
    return (
      <>
        <UserBar name={user.name} avatar={user.avatar} score={user.score} isAdmin={isAdmin} onAdminLogout={handleAdminLogout} />
        <AdminPanel locks={locks} onToggleLock={handleToggleLock} />
      </>
    );
  }

  // Show challenge selection if no challenge is selected
  if (!selectedChallenge) {
    return (
      <>
        <UserBar name={user.name} avatar={user.avatar} score={user.score} isAdmin={isAdmin} onAdminLogout={handleAdminLogout} />
        <div className="min-h-screen bg-gray-50 p-4">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col items-center space-y-2">
              <h1 className="text-3xl font-bold text-center">Code Review Challenge</h1>
              <p className="text-gray-600 text-center">Choose a challenge to test your skills</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {challenges.map((challenge) => {
                // By default, all challenges are locked unless explicitly unlocked
                const locked = locks[challenge.id] !== false;
                const timer = allTimers[challenge.id];
                const timeLeft = allTimeLefts[challenge.id] || 0;
                const isOpenLab = openLabChallenge === challenge.id;
                // Special style for DEMO challenge
                const demoCardClass = challenge.id === 'DEMO' ? 'bg-yellow-50 border-yellow-400 ring-2 ring-yellow-300' : '';
                return (
                  <Card key={challenge.id} className={`relative transition-shadow ${demoCardClass} ${locked && !isAdmin ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-lg'}`} onClick={() => handleSelectChallenge(challenge)}>
                    {/* Timer at bottom right if running or paused */}
                    {(timer && (timer.isRunning || timer.isPaused) && timeLeft > 0) && (
                      <div className="absolute bottom-3 right-3 z-10">
                        <TimerDisplay timeLeft={timeLeft} />
                      </div>
                    )}
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-orange-500" />
                        {challenge.title}
                        {locked && <Lock className="h-4 w-4 text-gray-400 ml-2" />}
                      </CardTitle>
                      <CardDescription className="mt-2">{challenge.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2 items-start justify-between">
                      {locked && !isAdmin && <span className="ml-2 text-xs text-gray-400">Locked</span>}
                      {!locked && !isOpenLab && (
                        <Button variant="default" onClick={() => { setOpenLabChallenge(challenge.id); setFlagInput(""); setFlagStatus({ status: 'idle' }); }}>
                          Open
                        </Button>
                      )}
                      {!locked && isOpenLab && (
                        <div className="w-full flex flex-col gap-2">
                          {flagStatus.status === 'success' && <div className="text-green-700 text-xs font-semibold">{flagStatus.message}</div>}
                          {flagStatus.status === 'already' && <div className="text-blue-700 text-xs font-semibold">{flagStatus.message}</div>}
                          {flagStatus.status === 'error' && <div className="text-red-600 text-xs font-semibold">{flagStatus.message}</div>}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </>
    )
  }

  // Challenge view
  const codeLines = selectedChallenge.code.split("\n")
  const correctAnswers = selectedLines.filter((line) => selectedChallenge.vulnerableLines.includes(line)).length
  const totalVulnerabilities = selectedChallenge.vulnerableLines.length
  const incorrectSelections = selectedLines.filter((line) => !selectedChallenge.vulnerableLines.includes(line)).length

  // In the challenge view, add a check for locked
  const isLocked = locks[selectedChallenge.id] !== false;

  return (
    <>
      <UserBar name={user.name} avatar={user.avatar} score={user.score} isAdmin={isAdmin} onAdminLogout={handleAdminLogout} />
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-start md:gap-6">
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button variant="outline" onClick={handleBackToChallenges}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Challenges
                  </Button>
                </div>
                <div className="w-32"></div> {/* Spacer for centering */}
              </div>
              <ResizableCard defaultWidth={800}>
                <Card className="mt-10">
                  <CardHeader>
                    <div className="flex justify-between w-full items-center">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-orange-500" />
                          {selectedChallenge.title}
                        </CardTitle>
                        <CardDescription className="mt-2 text-sm">{selectedChallenge.description}</CardDescription>
                      </div>
                      <span className="flex bg-blue-100 text-blue-800 text-sm font-semibold px-2 py-1 w-28 rounded-full items-center">Attempts: {attemptsRemaining}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 mb-4">
                      {/* Timer display for all users and admin */}
                      <ChallengeTimer selectedChallenge={selectedChallenge} />
                    </div>
                    <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                      <SyntaxHighlighter
                        language="javascript"
                        style={oneDark}
                        customStyle={{ background: 'transparent', fontSize: 14, margin: 0, padding: 0 }}
                        showLineNumbers
                        wrapLines
                        lineProps={(lineNumber: number) => {
                          const status = getLineStatus(lineNumber);
                          const isSelected = selectedLines.includes(lineNumber);
                          let className = "flex items-center cursor-pointer transition-colors ";
                          if (isSelected && !submitted) className += "bg-blue-900/50 hover:bg-blue-900/70 ";
                          if (submitted && status === "correct") className += "bg-green-900/50 ";
                          if (submitted && status === "incorrect") className += "bg-red-900/50 ";
                          return {
                            className,
                            onClick: () => toggleLine(lineNumber),
                            style: { cursor: 'pointer' },
                          };
                        }}
                        lineNumberStyle={{ minWidth: 32, color: '#888', textAlign: 'right', userSelect: 'none', marginRight: 16 }}
                      >
                        {selectedChallenge.code}
                      </SyntaxHighlighter>
                      {/* Show Hints button left-aligned with code block */}
                      {!submitted && selectedChallenge.hints && (
                        <div className="mt-2">
                          <Button variant="outline" size="sm" onClick={() => setShowHints(!showHints)}>
                            <Lightbulb className="h-4 w-4 mr-2" />
                            {showHints ? "Hide Hints" : "Show Hints"}
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex gap-4">
                      </div>

                      <div className="space-x-2">
                        {!submitted || lastSubmissionCorrect === true ? (
                          <div className="flex gap-2">
                            <a
                              href={getDynamicLabUrl(selectedChallenge.labUrl || '') || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button
                                type="button"
                                className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200"
                                variant="outline"
                                disabled={!selectedChallenge.labUrl}
                              >
                                Go to Lab
                              </Button>
                            </a>
                            <Button onClick={handleSubmit} disabled={selectedLines.length === 0 || alreadySolved || attemptsRemaining === 0 || (isLocked && !isAdmin)}>
                              Submit Answer
                            </Button>
                          </div>
                        ) : (
                          <Button onClick={handleReset} variant="outline">
                            Try Again
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* --- Flag submission for challenge view --- */}
                    <div className="mt-5">
                      {/* Only show flag submission form if flag is not already solved */}
                      { !flagAlreadySolved && (
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            if (!flagInput.trim() || flagAlreadySolved || (isLocked && !isAdmin)) return;
                            setFlagChallengeLoading(true);
                            setFlagChallengeStatus({ status: 'loading' });
                            try {
                              const res = await fetch('/api/submit-flag', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ challengeId: selectedChallenge.id, flag: flagInput.trim(), name: user.name }),
                              });
                              const data = await res.json();
                              if (res.status === 423) {
                                setFlagChallengeStatus({ status: 'error', message: 'This challenge is currently locked by the admin. You cannot submit flags.' });
                              } else if (data.success && data.correct) {
                                setFlagChallengeStatus({ status: 'success', message: data.alreadySolved ? 'Already solved!' : 'Correct flag! +5 points' });
                                setUser(u => ({ ...u, score: data.score }));
                                refreshSolvedStates();
                              } else if (data.success && data.alreadySolved) {
                                setFlagChallengeStatus({ status: 'already', message: 'Already solved!' });
                                refreshSolvedStates();
                              } else {
                                setFlagChallengeStatus({ status: 'error', message: 'Incorrect flag. Try again.' });
                              }
                            } catch {
                              setFlagChallengeStatus({ status: 'error', message: 'Could not submit flag. Please try again.' });
                            } finally {
                              setFlagChallengeLoading(false);
                            }
                          }}
                          className="flex items-center gap-2 mb-6"
                        >
                          <input
                            type="text"
                            className="border rounded px-3 py-2 w-full focus:outline-none focus:ring"
                            placeholder="Flag here"
                            value={flagInput}
                            onChange={e => setFlagInput(e.target.value)}
                            disabled={flagChallengeLoading || flagAlreadySolved || (isLocked && !isAdmin)}
                          />
                          <Button
                            type="submit"
                            className="ml-2 h-full bg-green-100 text-green-700 hover:bg-green-200 border-green-200"
                            variant="outline"
                            disabled={flagChallengeLoading || !flagInput.trim() || flagAlreadySolved || (isLocked && !isAdmin)}
                          >
                            {flagChallengeLoading ? 'Submitting...' : 'Submit Flag'}
                          </Button>
                        </form>
                      )}
                      {/* Feedback message/status always shown if not idle */}
                      {flagChallengeStatus.status !== 'idle' && (
                        <div className="mt-3">
                          {flagChallengeStatus.status === 'success' && (
                            <div className="flex items-center gap-2 bg-green-100 border border-green-300 text-green-800 px-4 py-2 rounded shadow-sm animate-fade-in">
                              <CheckCircle className="h-5 w-5 text-green-500" />
                              <span className="font-semibold">{flagChallengeStatus.message}</span>
                            </div>
                          )}
                          {flagChallengeStatus.status === 'error' && (
                            <div className="flex items-center gap-2 bg-red-100 border border-red-300 text-red-800 px-4 py-2 rounded shadow-sm animate-fade-in">
                              <XCircle className="h-5 w-5 text-red-500" />
                              <span className="font-semibold">{flagChallengeStatus.message}</span>
                            </div>
                          )}
                          {flagChallengeStatus.status === 'loading' && (
                            <div className="flex items-center gap-2 bg-gray-100 border border-gray-300 text-gray-800 px-4 py-2 rounded shadow-sm animate-fade-in">
                              <span className="font-semibold">Checking flag...</span>
                            </div>
                          )}
                        </div>
                      )}
                      {/* --- Enhanced 2-column solved status view --- */}
                      <div className="my-8">
                        <Card className="shadow-md border max-w-2xl mx-auto">
                          <CardContent className="py-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Challenge Submission Status */}
                              <div className="flex flex-col items-center justify-center text-center">
                                <div className="mb-2">
                                  {alreadySolved ? (
                                    <CheckCircle className="h-10 w-10 text-green-500 transition-transform duration-300 scale-110" />
                                  ) : (
                                    <XCircle className="h-10 w-10 text-red-400 transition-transform duration-300 scale-100" />
                                  )}
                                </div>
                                <span className={`text-base font-semibold mb-1 ${alreadySolved ? 'text-green-700' : 'text-red-700'}`}>Challenge Submission</span>
                                <span className={`text-xs font-medium mb-2 ${alreadySolved ? 'text-green-600' : 'text-red-500'}`}>{alreadySolved ? 'Solved' : 'Not Solved'}</span>
                                <span className="text-xs text-gray-500">Select the vulnerable line in the code above.</span>
                              </div>
                              {/* Flag Submission Status */}
                              <div className="flex flex-col items-center justify-center text-center">
                                <div className="mb-2">
                                  {flagAlreadySolved ? (
                                    <CheckCircle className="h-10 w-10 text-green-500 transition-transform duration-300 scale-110" />
                                  ) : (
                                    <XCircle className="h-10 w-10 text-red-400 transition-transform duration-300 scale-100" />
                                  )}
                                </div>
                                <span className={`text-base font-semibold mb-1 ${flagAlreadySolved ? 'text-green-700' : 'text-red-700'}`}>Flag Submission</span>
                                <span className={`text-xs font-medium mb-2 ${flagAlreadySolved ? 'text-green-600' : 'text-red-500'}`}>{flagAlreadySolved ? 'Solved' : 'Not Solved'}</span>
                                <span className="text-xs text-gray-500">Submit the flag you found in the lab.</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>

                    {showHints && selectedChallenge.hints && !submitted && (
                      <div className="mt-4 p-4 bg-blue-50 border-l-4 border-blue-400 rounded">
                        <h4 className="font-medium text-blue-800 mb-2">💡 Hints:</h4>
                        <ul className="text-sm text-blue-700 space-y-1">
                          {selectedChallenge.hints.map((hint, index) => (
                            <li key={index}>• {hint}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </ResizableCard>

              {showResults && lastSubmissionCorrect && (
                <Card className="mt-5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      Vulnerability Explanations
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{correctAnswers}</div>
                        <div className="text-sm text-green-700">Correct</div>
                      </div>
                      <div className="text-center p-4 bg-red-50 rounded-lg">
                        <div className="text-2xl font-bold text-red-600">{incorrectSelections}</div>
                        <div className="text-sm text-red-700">Incorrect</div>
                      </div>
                    </div> */}

                    <div className="space-y-3">
                      <div className="space-y-2">
                        {selectedChallenge.vulnerableLines.map((lineNumber) => (
                          <div key={lineNumber} className="p-3 bg-red-50 border-l-4 border-red-400 rounded">
                            <p className="font-medium text-red-800">Line {lineNumber}: Vulnerability Found</p>
                            <p className="text-sm text-red-700">{selectedChallenge.explanations[lineNumber]}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
            {/* Leaderboard on the right */}
            <div className="w-full mt-24 md:w-[400px] flex-shrink-0 md:self-start">
              <Leaderboard currentUser={user} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
