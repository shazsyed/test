"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var http_1 = require("http");
var socket_io_1 = require("socket.io");
var httpServer = (0, http_1.createServer)();
var io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: '*',
    },
});
// Set to track unique user IDs
var activeUsers = new Set();
// Timer state per challenge
var challengeTimers = {};
// Helper to broadcast timer state
function broadcastTimerUpdate(challengeId) {
    var timer = challengeTimers[challengeId];
    if (timer) {
        io.emit('timer:update', __assign({ challengeId: challengeId }, timer));
    }
}
io.on('connection', function (socket) {
    var userId = null;
    var isAdmin = false;
    // Helper to emit user count to all clients
    function emitUserCount() {
        io.emit('userCount', activeUsers.size);
    }
    // Expect the client to send their userId and admin flag immediately after connecting
    socket.on('register', function (id, adminFlag) {
        userId = id;
        isAdmin = !!adminFlag;
        socket.data.userId = id;
        socket.data.isAdmin = isAdmin;
        if (!isAdmin) {
            if (!activeUsers.has(id)) {
                activeUsers.add(id);
                emitUserCount();
            }
        }
    });
    socket.on('disconnect', function () {
        var id = socket.data.userId;
        var wasAdmin = socket.data.isAdmin;
        if (id && !wasAdmin) {
            // Check if any other sockets with the same userId are still connected
            var stillConnected = Array.from(io.sockets.sockets.values()).some(function (s) { return s !== socket && s.data.userId === id && !s.data.isAdmin; });
            if (!stillConnected) {
                activeUsers.delete(id);
                emitUserCount();
            }
        }
    });
    // Admin starts timer for a challenge
    socket.on('admin:startTimer', function (_a) {
        var challengeId = _a.challengeId, duration = _a.duration;
        var now = Date.now();
        challengeTimers[challengeId] = {
            startTime: now,
            duration: duration,
            isRunning: true,
            isPaused: false,
            pausedAt: undefined,
            remaining: undefined,
        };
        broadcastTimerUpdate(challengeId);
    });
    // Admin pauses timer
    socket.on('admin:pauseTimer', function (_a) {
        var challengeId = _a.challengeId;
        var timer = challengeTimers[challengeId];
        if (timer && timer.isRunning && !timer.isPaused) {
            timer.isPaused = true;
            timer.pausedAt = Date.now();
            timer.remaining = (timer.startTime + timer.duration) - timer.pausedAt;
            timer.isRunning = false;
            broadcastTimerUpdate(challengeId);
        }
    });
    // Admin resumes timer
    socket.on('admin:resumeTimer', function (_a) {
        var challengeId = _a.challengeId;
        var timer = challengeTimers[challengeId];
        if (timer && timer.isPaused && timer.remaining && timer.remaining > 0) {
            timer.isPaused = false;
            timer.isRunning = true;
            timer.startTime = Date.now();
            timer.duration = timer.remaining;
            timer.pausedAt = undefined;
            timer.remaining = undefined;
            broadcastTimerUpdate(challengeId);
        }
    });
    // Admin resets timer
    socket.on('admin:resetTimer', function (_a) {
        var challengeId = _a.challengeId;
        if (challengeTimers[challengeId]) {
            delete challengeTimers[challengeId];
            broadcastTimerUpdate(challengeId);
        }
    });
    // On user connect, send current timer state for all running timers
    Object.entries(challengeTimers).forEach(function (_a) {
        var challengeId = _a[0], timer = _a[1];
        if (timer.isRunning || timer.isPaused) {
            socket.emit('timer:update', __assign({ challengeId: challengeId }, timer));
        }
    });
});
var PORT = 4001;
httpServer.listen(PORT, function () {
    console.log("Socket.IO server running on port ".concat(PORT));
});
