"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AdminPanel } from "@/components/code-review-challenge"
import { UserCount } from "@/components/ui/user-count"
import { io } from 'socket.io-client'

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4001';

export default function AdminDashboard() {
  console.log("Admin Socket: ", SOCKET_URL)
  const [locks, setLocks] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Only allow access if admin session
    fetch(`/api/admin-login`, { method: 'GET' })
      .then(res => res.json())
      .then(data => {
        if (!data.authenticated) {
          router.replace("/admin");
        } else {
          // Fetch locks from API
          fetch(`/api/challenge-locks`)
            .then(res => res.json())
            .then(data => setLocks(data));
        }
        setLoading(false);
      });
  }, [router]);

  const handleToggleLock = async (id: string) => {
    const isLocked = locks[id] !== false;
    const newLocked = !isLocked;
    setLocks(prev => ({ ...prev, [id]: newLocked }));
    await fetch(`/api/challenge-locks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, locked: newLocked })
    });
    // Reset timer if locking the challenge
    if (newLocked) {
      const socket = io(SOCKET_URL, { transports: ['websocket'] });
      socket.emit('admin:resetTimer', { challengeId: id });
      socket.disconnect();
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <UserCount isAdmin={true} />
      <AdminPanel locks={locks} onToggleLock={handleToggleLock} />
    </div>
  );
} 