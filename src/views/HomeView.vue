<template>
  <div>
    <h1>Multi-Peer Audio Demo</h1>
    <div>
      <button @click="joinRoom">Join Room</button>
      <button @click="leaveRoom">Leave Room</button>
    </div>
    <div>
      <div v-for="peer in rtcInfo.peers" :key="peer.peerId">
        <h2>Peer {{ peer.peerId }}</h2>
        <audio :srcObject="peer.stream" autoplay></audio>
      </div>
    </div>
  </div>
</template>

<script setup>
import Peer from "peerjs";
import { io } from "socket.io-client";
import { reactive } from "vue";

const rtcInfo = reactive({
  peer: null,
  peers: [],
  socket: null,
});

const connectAudio = (stream) => {
  const audioCtx = new AudioContext();
  const sourceNode = audioCtx.createMediaStreamSource(stream);
  const gainNode = audioCtx.createGain();
  sourceNode.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  // 控制音量
  gainNode.gain.value = 0.5;
}
const getUserMedia = () => {
  return navigator.mediaDevices
    .getUserMedia({
      audio: {
        echoCancellation: true, // 启用 AEC
        autoGainControl: true, // 启用 AGC
        noiseSuppression: true, // 启用 NS
      }
    })
    .then((stream) => {
      connectAudio(stream)
      return Promise.resolve(stream)
    }).catch(err => {
      return Promise.reject(err)
    })
}

const leaveRoom = () => {
  rtcInfo.peer.disconnect();
  rtcInfo.peers.forEach((peer) => {
    rtcInfo.peer.call.close();
  });
  rtcInfo.peers = [];
  rtcInfo.socket.disconnect();
};
const connectToPeer = (peerId) => {
  console.log("Connecting to peer " + peerId + "...");
  getUserMedia()
    .then((stream) => {
      const call = rtcInfo.peer.call(peerId, stream);
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
  console.log("addPeer==", peerId);
  if (!rtcInfo.peers.find((peer) => rtcInfo.peer.peerId === peerId)) {
    rtcInfo.peers.push({ peerId, stream });
  }
};
const removePeer = (peerId) => {
  const index = rtcInfo.peers.findIndex(
    (peer) => rtcInfo.peer.peerId === peerId
  );
  if (index >= 0) {
    rtcInfo.peers.splice(index, 1);
  }
};

const joinRoom = () => {
  const roomId = prompt("Please enter room ID:");
  rtcInfo.socket = io("https://short.hithit.cn", {
    query: {},
    transports: ["websocket", "polling"],
    timeout: 5000,
  });
  // rtcInfo.socket = io("http://127.0.0.1:8002", {
  //   query: {},
  //   transports: ["websocket", "polling"],
  //   timeout: 5000,
  //   // path: "/",
  // });

  rtcInfo.peer = new Peer(`laiya_peer${new Date().getTime()}`, {
    // config: {
    //   audioProcessingOptions: {
    //     echoCancellation: true, // 启用 AEC
    //     autoGainControl: true, // 启用 AGC
    //     noiseSuppression: true, // 启用 NS
    //   },
    // },
  });

  rtcInfo.peer.on("open", (id) => {
    console.log("My peer ID is: " + id);
    rtcInfo.socket.emit("register", { peerId: id, roomId });
  });

  rtcInfo.peer.on("call", (call) => {
    console.log("Received call from " + call.peer);
    getUserMedia()
      .then((stream) => {
        call.answer(stream);
        addPeer(call.peer, stream);
      })
      .catch((error) => {
        console.error("Error accessing media devices.", error);
      });
  });

  rtcInfo.socket.on("peer-connected", (data) => {
    const peerId = data.peerId;
    console.log("Peer " + peerId + " connected.");
    connectToPeer(peerId);
  });

  rtcInfo.socket.on("peer-disconnected", (data) => {
    const peerId = data.peerId;
    console.log("Peer " + peerId + " disconnected.");
    removePeer(peerId);
  });

  rtcInfo.socket.on("offer", (data) => {
    const { offer, fromPeerId } = data;
    console.log(`Received offer from ${fromPeerId}.`);
    getUserMedia()
      .then((stream) => {
        const call = rtcInfo.peer.call(fromPeerId, stream);
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

  rtcInfo.socket.on("answer", (data) => {
    const { answer, fromPeerId } = data;
    console.log(`Received answer from ${fromPeerId}.`);
    const call = rtcInfo.peer.call(
      fromPeerId,
      rtcInfo.peers.find((peer) => rtcInfo.peer.peerId === fromPeerId).stream
    );
    call.answer(answer);
  });

  rtcInfo.socket.on("candidate", (data) => {
    const { candidate, fromPeerId } = data;
    console.log(`Received candidate from ${fromPeerId}.`);
    const call = rtcInfo.peer.call(
      fromPeerId,
      rtcInfo.peers.find((peer) => rtcInfo.peer.peerId === fromPeerId).stream
    );
    call.answer(candidate);
  });
};
</script>
