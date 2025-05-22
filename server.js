const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

const words = [
  { secret: "Zahnarzt", covers: ["Beruf", "Medizin", "Praxis"] },
  { secret: "Gitarre", covers: ["Instrument", "Musik", "Saiten"] },
  { secret: "Kaffeemaschine", covers: ["Gerät", "Haushalt", "Küche"] },
  { secret: "Regenschirm", covers: ["Schutz", "Wetter", "Gegenstand"] },
  { secret: "Fußball", covers: ["Sport", "Spiel", "Ball"] }
];

let gameState = {
  players: [], // {id: socket.id, name: "", isImposter: false, word: ""}
  currentPlayerIndex: 0,
  secretWord: "",
  started: false
};

app.use(express.static('public')); // Für die HTML/JS-Dateien im Ordner 'public'

io.on('connection', (socket) => {
  console.log('Spieler verbunden:', socket.id);

  socket.on('joinGame', (name) => {
    if(gameState.started) {
      socket.emit('gameStarted');
      return;
    }

    gameState.players.push({ id: socket.id, name: name, isImposter: false, word: "" });
    io.emit('playersUpdate', gameState.players.map(p => p.name));
  });

  socket.on('startGame', (imposterCount) => {
    if(gameState.started) return;

    if(imposterCount > gameState.players.length) {
      socket.emit('errorMessage', 'Zu viele Imposter!');
      return;
    }
    gameState.started = true;

    // Wort zufällig auswählen
    const word = words[Math.floor(Math.random() * words.length)];
    gameState.secretWord = word.secret;

    // Imposter zufällig zuweisen
    let indices = [...Array(gameState.players.length).keys()];
    for(let i = 0; i < imposterCount; i++) {
      const idx = Math.floor(Math.random() * indices.length);
      const playerIndex = indices.splice(idx,1)[0];
      gameState.players[playerIndex].isImposter = true;
      gameState.players[playerIndex].word = word.covers[i % word.covers.length];
    }
    // Andere Spieler bekommen das echte Wort
    gameState.players.forEach(p => {
      if(!p.isImposter) p.word = gameState.secretWord;
    });

    io.emit('gameStartedServer');
    sendCurrentPlayer();
  });

  socket.on('showWord', () => {
    const player = gameState.players[gameState.currentPlayerIndex];
    if(player.id !== socket.id) return;

    socket.emit('yourWord', player.word);

    // Nach Anzeige zum nächsten Spieler
    gameState.currentPlayerIndex++;
    if(gameState.currentPlayerIndex >= gameState.players.length) {
      io.emit('gameOver');
    } else {
      sendCurrentPlayer();
    }
  });

  socket.on('disconnect', () => {
    console.log('Spieler getrennt:', socket.id);
    gameState.players = gameState.players.filter(p => p.id !== socket.id);
    io.emit('playersUpdate', gameState.players.map(p => p.name));
    if(gameState.currentPlayerIndex >= gameState.players.length) {
      io.emit('gameOver');
    } else {
      sendCurrentPlayer();
    }
  });

  function sendCurrentPlayer() {
    if(gameState.currentPlayerIndex < gameState.players.length) {
      const current = gameState.players[gameState.currentPlayerIndex];
      io.emit('currentPlayer', current.name);
    }
  }
});

server.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
