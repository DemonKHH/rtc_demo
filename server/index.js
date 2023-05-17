const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

const { v4: uuidv4 } = require("uuid");

const PORT = 8002;

// 定义房间对象
const rooms = {};

// 在服务器启动时输出日志
http.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});

// 处理 WebSocket 连接请求
io.on("connection", (socket) => {
  // socket.peerId = uuidv4();
  // console.log("New client connected.", socket.peerId);
  socket.on("register", (payload) => {
    console.log("on register.", payload);
    registerPeer(socket, payload);
  });
  socket.on("offer", (payload) => {
    console.log("on offer.", payload);
    sendOfferToExistingPeers(socket, payload);
  });
  socket.on("answer", (payload) => {
    console.log("on answer.", payload);
    sendAnswer(socket, payload);
  });
  socket.on("candidate", (payload) => {
    console.log("on candidate.", payload);
    sendCandidate(socket, payload);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected.");
    removePeer(socket);
  });
});

function registerPeer(socket, payload) {
  const { roomId } = payload;
  socket.peerId = payload.peerId;
  const room = getOrCreateRoom(roomId);
  room.peers.push(socket.peerId);
  room.sockets[socket.peerId] = socket;
  socket.roomId = roomId;

  console.log(`Peer ${socket.peerId} registered in room ${roomId}.`);

  broadcastPeerConnected(room, socket.peerId);
}

function sendOfferToExistingPeers(socket, payload) {
  const { offer } = payload;
  const room = getRoomByPeerId(socket.peerId);

  room.peers.forEach((peerId) => {
    if (peerId !== socket.peerId) {
      const peer = room.sockets[peerId];
      peer.emit("offer", {
        offer,
        fromPeerId: socket.peerId,
      });
      console.log(`Sending offer from ${socket.peerId} to ${peerId}.`);
    }
  });
}

function sendAnswer(socket, payload) {
  const { answer, toPeerId } = payload;
  const room = getRoomByPeerId(socket.peerId);
  const toPeer = room.sockets[toPeerId];
  toPeer.emit("answer", {
    answer,
    fromPeerId: socket.peerId,
  });
  console.log(`Sending answer from ${socket.peerId} to ${toPeerId}.`);
}

function sendCandidate(socket, payload) {
  const { candidate, toPeerId } = payload;
  const room = getRoomByPeerId(socket.peerId);
  const toPeer = room.sockets[toPeerId];
  toPeer.emit("candidate", {
    candidate,
    fromPeerId: socket.peerId,
  });
  console.log(`Sending candidate from ${socket.peerId} to ${toPeerId}.`);
}

function removePeer(socket) {
  if (socket.peerId && socket.roomId) {
    console.log(`Removing peer ${socket.peerId} from room ${socket.roomId}.`);
    const room = getRoomByPeerId(socket.peerId);
    const index = room.peers.findIndex((peerId) => peerId === socket.peerId);
    if (index >= 0) {
      room.peers.splice(index, 1);
      delete room.sockets[socket.peerId];
      broadcastPeerDisconnected(room, socket.peerId);
    }
  }
}

function getOrCreateRoom(roomId) {
  if (!rooms[roomId]) {
    rooms[roomId] = {
      peers: [],
      sockets: {},
    };
  }
  return rooms[roomId];
}

function getRoomByPeerId(peerId) {
  for (const roomId in rooms) {
    const room = rooms[roomId];
    if (room.peers.includes(peerId)) {
      return room;
    }
  }
  return null;
}

function broadcastPeerConnected(room, peerId) {
  room.peers.forEach((otherPeerId) => {
    console.log('room===>', otherPeerId)
    if (otherPeerId !== peerId) {
      const otherPeer = room.sockets[otherPeerId];
      otherPeer.emit("peer-connected", { peerId });
      console.log(
        `Sending peer-connected message from ${peerId} to ${otherPeerId}.`
      );
    }
  });
}

function broadcastPeerDisconnected(room, peerId) {
  room.peers.forEach((otherPeerId) => {
    if (otherPeerId !== peerId) {
      const otherPeer = room.sockets[otherPeerId];
      otherPeer.emit(
        "peer-disconnected",
        {
          peerId,
        }
      );
      console.log(
        `Sending peer-disconnected message from ${peerId} to ${otherPeerId}.`
      );
    }
  });
}

// 设置跨域头部
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});
