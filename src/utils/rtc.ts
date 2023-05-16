interface IPeerConnectionManagerOptions {
  iceServers?: RTCIceServer[];
}

interface IPeerConnectionConfig {
  iceServers: RTCIceServer[];
}

interface IPeerConnection {
  pc: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
}

type OnConnectionCallback = (pc: RTCPeerConnection) => void;
type OnDataCallback = (data: any) => void;
type OnIceCandidateCallback = (candidate: RTCIceCandidate) => void;

class PeerConnectionManager {
  private connections: IPeerConnection[] = [];
  private config: IPeerConnectionConfig;
  private onDataCallback?: OnDataCallback;
  private onIceCandidateCallback?: OnIceCandidateCallback;

  constructor(options: IPeerConnectionManagerOptions = {}) {
    this.config = {
      iceServers: options.iceServers || [{ urls: "stun:stun.l.google.com:19302" }],
    };
  }

  public createConnection(): RTCPeerConnection {
    const pc = new RTCPeerConnection(this.config);
    const connection: IPeerConnection = { pc };

    this.connections.push(connection);

    pc.onicecandidate = (event) => {
      if (event.candidate && this.onIceCandidateCallback) {
        this.onIceCandidateCallback(event.candidate);
      }
    };

    pc.ondatachannel = (event) => {
      connection.dataChannel = event.channel;
      connection.dataChannel.onmessage = (event) => {
        if (this.onDataCallback) {
          this.onDataCallback(JSON.parse(event.data));
        }
      };
    };

    return pc;
  }

  public closeAllConnections(): void {
    this.connections.forEach((connection) => {
      connection.pc.close();
    });
    this.connections = [];
  }

  public sendToAll(data: any): void {
    this.connections.forEach((connection) => {
      if (connection.dataChannel?.readyState === "open") {
        connection.dataChannel.send(JSON.stringify(data));
      }
    });
  }

  public setOnConnection(callback: OnConnectionCallback): void {
    this.connections.forEach((connection) => {
      callback(connection.pc);
    });
  }

  public setOnData(callback: OnDataCallback): void {
    this.onDataCallback = callback;
  }

  public setOnIceCandidate(callback: OnIceCandidateCallback): void {
    this.onIceCandidateCallback = callback;
  }
}

export default PeerConnectionManager;