const localUserNameEl = document.getElementById("local-name");
const remoteUserNameEl = document.getElementById("remote-name");
const localVideoEl = document.getElementById("local-feed");
const remoteVideoEl = document.getElementById("remote-feed");

let userName;
while (!userName) {
  userName = window.prompt("Enter user name");
}
localUserNameEl.textContent = userName;
let isInCall = false;

const hangUpBtn = document.getElementById("hangup-button");

const socketList = document.getElementById("sockets");

let peerConnection;

const config = {
  iceServers: [
    {
      urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"],
    },
  ],
};

let didCall = true;
const renderSockets = (connectedSocketList) => {
  socketList.innerHTML = "";
  connectedSocketList.forEach((socket) => {
    const newSocketElement = createNewSocketEl(socket);
    socketList.appendChild = newSocketElement;
  });
};

const socket = io.connect("https://localhost:8080", {
  auth: {
    userName,
  },
});

let connectedSockets = [];
let partner;

socket.on("socketListUpdated", (sockets) => {
  connectedSockets = [];
  for (let i = 0; i < sockets.length; i++) {
    if (socket.id !== sockets[i].socketId) {
      connectedSockets.push(sockets[i]);
    }
  }

  socketList.innerHTML = "";
  for (let i = 0; i < connectedSockets.length; i++) {
    socketList.appendChild(createNewSocketEl(connectedSockets[i]));
  }
});

const createNewSocketEl = (newSocket) => {
  const newSocketElement = document.createElement("div");
  newSocketElement.className = "socket";

  const newSocketName = document.createElement("p");
  newSocketName.className = "socket-name";

  const callBtn = document.createElement("button");
  callBtn.style.cursor = "pointer";

  newSocketElement.appendChild(newSocketName);
  newSocketElement.appendChild(callBtn);
  callBtn.className = "callBtn";
  newSocketName.textContent = `${newSocket.userName}`;
  callBtn.textContent = "Call";

  callBtn.addEventListener("click", (e) => {
    call(newSocket);
  });

  return newSocketElement;
};

let localStream;
let remoteStream = new MediaStream();

let sendIceCandidateTo;

const call = async (callSocket) => {
  if (isInCall) {
    if (window.confirm("Do you want to end this call")) {
      hangUp();
    } else {
      return;
    }
  }
  const socketToCall = {
    userName: callSocket.userName,
    socketId: callSocket.socketId,
  };

  sendIceCandidateTo = socketToCall.socketId;
  await fetchUserMedia();

  await createPeerConnection(config);

  await createOffer(socketToCall);
};

hangUpBtn.addEventListener("click", (e) => {
  // Emitting hangup
  if (peerConnection) {
    socket.emit("hangUp", partner);
  }

  hangUp();
});

const hangUp = () => {
  if (peerConnection) {
    // closing the peer connection
    peerConnection.close();
    peerConnection = null;

    // stopping the streams
    remoteStream.getTracks().forEach((t) => {
      t.stop();
      remoteStream = null;
      remoteStream = new MediaStream();
    });

    localStream.getTracks().forEach((t) => {
      t.stop();
      localStream = null;
    });

    remoteUserNameEl.textContent = ``;
    isInCall = false;
  } else {
    window.alert("not in an active call");
  }
};

const fetchUserMedia = () => {
  return new Promise(async (resolve, reject) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      localVideoEl.srcObject = stream;
      localStream = stream;
      remoteVideoEl.srcObject = remoteStream;
      resolve();
    } catch (err) {
      console.log(err);
      reject();
    }
  });
};

const createPeerConnection = async (peerConfig) => {
  peerConnection = await new RTCPeerConnection(peerConfig);

  localStream.getTracks().forEach((track) => {
    try {
      peerConnection.addTrack(track, localStream);
    } catch (err) {
      console.log(`Error: ${err}`);
    }
  });

  peerConnection.addEventListener("icecandidate", (e) => {
    const candidateInfo = {
      candidate: e.candidate,
      to: sendIceCandidateTo,
    };
    socket.emit("iceCandidate", candidateInfo);
  });

  peerConnection.addEventListener("track", (e) => {
    e.streams[0].getTracks().forEach((t) => {
      try {
        remoteStream.addTrack(t, remoteStream);
      } catch (err) {
        console.log(`Error adding track: ${err}`);
      }
    });
  });
};

const createOffer = async (socketToCall) => {
  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    const offerDescription = {
      offer: offer,
      socketToCall: socketToCall,
    };
    socket.emit("newOffer", offerDescription);
  } catch (err) {
    console.log(`Error: ${err}`);
  }
};

socket.on("offerAwaiting", async (callOffer) => {
  const offer = callOffer.offer;
  const socketToCall = callOffer.socketToCall;
  const callingSocket = callOffer.callingSocket;

  if (isInCall) {
    socket.emit("peerBusy", callingSocket);
    return;
  }
  if (window.confirm(`${callingSocket.userName} is calling`)) {
    partner = {
      socketId: callingSocket.socketId,
      userName: callingSocket.userName,
    };
    await fetchUserMedia();
    await createPeerConnection(config);
    sendIceCandidateTo = callingSocket.socketId;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer({});

    await peerConnection.setLocalDescription(answer);

    const answerDescription = {
      answerFrom: {
        userName: userName,
        socketId: socket.id,
      },
      answerTo: {
        userName: callingSocket.userName,
        socketId: callingSocket.socketId,
      },
      answer: answer,
    };
    didCall = false;
    socket.emit("callAnswered", answerDescription);
    isInCall = true;
    remoteUserNameEl.textContent = callingSocket.userName;
  } else {
    socket.emit("callRejected", callOffer);
  }
});

socket.on("answerReceived", async (answerOffer) => {
  partner = {
    socketId: answerOffer.answerer.socketId,
    userName: answerOffer.answerer.userName,
  };
  isInCall = true;
  remoteUserNameEl.textContent = partner.userName;
  await peerConnection.setRemoteDescription(answerOffer.answer);
});

socket.on("iceCandidateAdded", async (candidate) => {
  if (peerConnection && candidate) {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }
});

socket.on("hungup", (hungUpBy) => {
  window.alert(`${hungUpBy.userName} hung up on you`);
  hangUp();
});

socket.on("lineBusy", () => {
  window.alert("The user is busy at the moment");
});
