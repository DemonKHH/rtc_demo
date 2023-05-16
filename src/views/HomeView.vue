<template>
  <div>
    <h1>Multi-Peer Audio Demo</h1>
    <div>
      <button @click="joinRoom">Join Room</button>
      <button @click="leaveRoom">Leave Room</button>
    </div>
    <div>
      <div v-for="peer in peers" :key="peer.peerId">
        <h2>Peer {{ peer.peerId }}</h2>
        <audio :srcObject="peer.stream" autoplay></audio>
      </div>
    </div>
  </div>
</template>

<script setup>
import Peer from "peerjs";
import { io } from "socket.io-client";

let peer = null;
let peers = [];
let socket = null;

const leaveRoom = () => {
  peer.disconnect();
  peers.forEach((peer) => {
    peer.call.close();
  });
  peers = [];
  socket.disconnect();
};
const connectToPeer = (peerId) => {
  console.log("Connecting to peer " + peerId + "...");
  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      const call = peer.call(peerId, stream);
      call.on("stream", (remoteStream) => {
        addPeer(peerId, remoteStream);
      });
      call.on("close", () => {
        removePeer(peerId);
      });
    })
    .catch((error) => {
      console.error("Error accessing media devices.", error);
    });
};
const addPeer = (peerId, stream) => {
  if (!peers.find((peer) => peer.peerId === peerId)) {
    peers.push({ peerId, stream });
  }
};
const removePeer = (peerId) => {
  const index = peers.findIndex((peer) => peer.peerId === peerId);
  if (index >= 0) {
    peers.splice(index, 1);
  }
};

const joinRoom = () => {
  const roomId = prompt("Please enter room ID:");
  socket = io("http://127.0.0.1:8001", {
    query: {},
    transports: ["websocket", "polling"],
    timeout: 5000,
  });

  peer = new Peer(`laiya_peer${new Date().getTime()}`);

  peer.on("open", (id) => {
    console.log("My peer ID is: " + id);
    socket.emit("register", { peerId: id, roomId });
  });

  peer.on("call", (call) => {
    console.log("Received call from " + call.peer);
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        call.answer(stream);
        addPeer(call.peer, stream);
      })
      .catch((error) => {
        console.error("Error accessing media devices.", error);
      });
  });

  socket.on("peer-connected", (data) => {
    const peerId = data.peerId;
    console.log("Peer " + peerId + " connected.");
    connectToPeer(peerId);
  });

  socket.on("peer-disconnected", (data) => {
    const peerId = data.peerId;
    console.log("Peer " + peerId + " disconnected.");
    removePeer(peerId);
  });

  socket.on("offer", (data) => {
    const { offer, fromPeerId } = data;
    console.log(`Received offer from ${fromPeerId}.`);
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        const call = peer.call(fromPeerId, stream);
        call.on("stream", (remoteStream) => {
          addPeer(fromPeerId, remoteStream);
        });
        call.on("close", () => {
          removePeer(fromPeerId);
        });
        call.answer(offer);
      })
      .catch((error) => {
        console.error("Error accessing media devices.", error);
      });
  });

  socket.on("answer", (data) => {
    const { answer, fromPeerId } = data;
    console.log(`Received answer from ${fromPeerId}.`);
    const call = peer.call(
      fromPeerId,
      peers.find((peer) => peer.peerId === fromPeerId).stream
    );
    call.answer(answer);
  });

  socket.on("candidate", (data) => {
    const { candidate, fromPeerId } = data;
    console.log(`Received candidate from ${fromPeerId}.`);
    const call = peer.call(
      fromPeerId,
      peers.find((peer) => peer.peerId === fromPeerId).stream
    );
    call.answer(candidate);
  });
};
</script>
