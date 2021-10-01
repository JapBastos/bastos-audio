import express from 'express';
import socket from 'socket.io';
import path from 'path';
import http from 'http';
import fs from 'fs';
const ss = require('socket.io-stream');

const app = express();
const httpServer = http.createServer(app);
const io = new socket.Server(httpServer);

app.use(express.static(path.resolve(__dirname, '..', 'public')));

io.on('connection', socket => {
  const stream = ss.createStream();

  console.log(`Nova conexão com id: ${socket.id}`);

  socket.on('track', () => {
    const filePath = path.resolve(__dirname, 'private', 'audio.raw');
    const stat = fs.statSync(filePath);
    const readStream = fs.createReadStream(filePath);
    // pipe stream with response stream
    readStream.pipe(stream);
    console.log('stream', stream);

    ss(socket).emit('track-stream', stream, { stat });
  });
  
  socket.on('disconnect', () => {});

  /* socket.on('message', message => {
    console.log(`Nova mensagem: ${message}`);
    socket.emit('received', `Mensagem recebida: ${message}`);
  }) */
});

httpServer.listen(3333, () => {
  console.log('Server rodando na porta 3333!')
})