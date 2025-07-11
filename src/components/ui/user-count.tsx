"use client"

import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Users } from 'lucide-react';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4001';
const USER_ID_KEY = 'ssrf-lab-user-id';
const CHANNEL_NAME = 'ssrf-lab-user-channel';

export const UserCount: React.FC<{ isAdmin?: boolean }> = ({ isAdmin = false }) => {
  console.log("User Count Socket", SOCKET_URL)
  const [userCount, setUserCount] = useState<number>(1);
  const [isLeader, setIsLeader] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Get or create userId on client only
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let id = localStorage.getItem(USER_ID_KEY);
    if (!id) {
      // Simple generic random string generator (not cryptographically secure)
      id = Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
      localStorage.setItem(USER_ID_KEY, id);
    }
    setUserId(id);
  }, []);

  // Tab coordination and leader election (only for non-admins)
  useEffect(() => {
    if (!userId || isAdmin) return;
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;
    let leader = false;
    let leaderTimeout: NodeJS.Timeout | null = null;

    function claimLeadership() {
      channel.postMessage({ type: 'claim-leader', from: userId });
      leaderTimeout = setTimeout(() => {
        if (!leader) {
          leader = true;
          setIsLeader(true);
        }
      }, 500);
    }

    function handleMessage(e: MessageEvent) {
      const msg = e.data;
      if (msg.type === 'claim-leader' && msg.from !== userId) {
        if (leader) {
          leader = false;
          setIsLeader(false);
        }
        channel.postMessage({ type: 'leader-exists', from: userId });
      } else if (msg.type === 'leader-exists' && msg.from !== userId) {
        if (leaderTimeout) clearTimeout(leaderTimeout);
        leader = false;
        setIsLeader(false);
      }
    }

    channel.addEventListener('message', handleMessage);
    claimLeadership();

    const onUnload = () => {
      if (leader) {
        channel.postMessage({ type: 'leader-gone', from: userId });
      }
    };
    window.addEventListener('beforeunload', onUnload);

    return () => {
      channel.close();
      window.removeEventListener('beforeunload', onUnload);
      if (leaderTimeout) clearTimeout(leaderTimeout);
    };
  }, [userId, isAdmin]);

  // Socket connection and user count updates
  useEffect(() => {
    if (!userId) return;
    const socket = io(SOCKET_URL, { transports: ['websocket'] });
    socketRef.current = socket;
    if (isAdmin) {
      // Admin: only listen for userCount, do not register as a player
      socket.on('userCount', (count: number) => {
        setUserCount(count);
      });
    } else {
      if (!isLeader) {
        const channel = channelRef.current;
        function handleMessage(e: MessageEvent) {
          const msg = e.data;
          if (msg.type === 'user-count-update') {
            setUserCount(msg.count);
          }
        }
        channel?.addEventListener('message', handleMessage);
        return () => channel?.removeEventListener('message', handleMessage);
      }
      socket.on('connect', () => {
        socket.emit('register', userId, false); // not admin
      });
      socket.on('userCount', (count: number) => {
        setUserCount(count);
        channelRef.current?.postMessage({ type: 'user-count-update', count });
      });
    }
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isLeader, userId, isAdmin]);

  if (!userId) return null;

  return (
    <div className="fixed top-4 left-4 z-50 flex items-center gap-2 bg-white/80 shadow rounded-full px-4 py-2 border border-gray-200">
      <Users className="w-5 h-5 text-primary" />
      <span className="text-base font-bold text-primary">{userCount}</span>
    </div>
  );
};

export default UserCount; 