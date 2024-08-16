const fs = require("fs");
const express = require("express");
const { Server } = require("socket.io");
const cors = require("cors");
const https = require("https");
const path = require("path");

const app = new express();
app.use(express.static(path.join(__dirname, "public")));

const cert = fs.readFileSync("cert.crt");
const key = fs.readFileSync("cert.key");

const httpsServer = https.createServer({ key, cert }, app);

const io = new Server(httpsServer, {
  cors: {
    origin: ["https://localhost/"],
    methods: ["GET", "POST"],
  },
});

let connectedSockets = [];

io.on("connection", (socket) => {
  const userName = socket.handshake.auth.userName;
  console.log(
    `Socket id: ${socket.id} connected successfully with the user name: ${userName}`
  );

  if (socket.id && userName) {
    connectedSockets.push({
      socketId: socket.id,
      userName,
    });
  }
  console.log(connectedSockets);
  io.emit("socketListUpdated", connectedSockets);

  socket.on("disconnect", () => {
    const userName = socket.handshake.auth.userName;
    console.log(
      `Socket id: ${socket.id} disconnected with user name: ${userName}`
    );

    console.log(connectedSockets);

    connectedSockets = connectedSockets.filter((s) => s.socketId !== socket.id);
    socket.broadcast.emit("socketListUpdated", connectedSockets);
  });

  socket.on("newOffer", (offerDescription) => {
    const offer = offerDescription.offer;
    const socketToCall = offerDescription.socketToCall;
    const callOffer = {
      offer: offer,
      socketToCall: socketToCall,
      callingSocket: {
        socketId: socket.id,
        userName: userName,
      },
    };
    socket.broadcast.emit("offerAwaiting", callOffer);
  });

  socket.on("callAnswered", (answerDescription) => {
    const offerer = answerDescription.answerTo;
    const answerer = answerDescription.answerFrom;
    const answer = answerDescription.answer;

    const answerOffer = {
      offerer: offerer,
      answerer: answerer,
      answer: answer,
    };

    socket.to(offerer.socketId).emit("answerReceived", answerOffer);
  });

  socket.on("iceCandidate", (candidateInfo) => {
    console.log(
      `New ice candidate received: ${candidateInfo.candidate} from socket: ${socket.id}`
    );
    const candidate = candidateInfo.candidate;
    const to = candidateInfo.to;
    console.log(`Emitting the ice candidate to ${to}`);
    socket.to(to).emit("iceCandidateAdded", candidate);
  });

  socket.on("hangUp", (partner) => {
    console.log(`${userName} hung up on ${partner.socketId}`);
    socket.to(partner.socketId).emit("hungup", {
      socketId: socket.id,
      userName: userName,
    });

  });

  socket.on('peerBusy', callingSocket => {
    socket.to(callingSocket.socketId).emit("lineBusy")
  })

});

httpsServer.listen(8080, () => {
  console.log("server up and running");
});
