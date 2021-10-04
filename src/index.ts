import express from 'express';
import socket from 'socket.io';
import path from 'path';
import http from 'http';
import fs from 'fs';
const ss = require('socket.io-stream');

const app = express();
const api = express();
const httpServer = http.createServer(app);
const io = new socket.Server(httpServer);

app.use(express.static(path.resolve(__dirname, '..', 'public')));

api.get('/track', (req, res, err) => {
  // generate file path
  const filePath = path.resolve(__dirname, 'private', 'audio.raw');
  // get file size info
  const stat = fs.statSync(filePath);

  // set response header info
  res.writeHead(200, {
    'Content-Type': 'audio/wav',
    'Content-Length': stat.size,
    'Access-Control-Allow-Origin': '*'
  });
  //create read stream
  const readStream = fs.createReadStream(filePath);
  // attach this stream with response stream
  readStream.pipe(res);
});

io.on('connection', socket => {
  const stream = ss.createStream();

  console.log(`Nova conexão com id: ${socket.id}`);

  socket.on('track', () => {
    const filePath = path.resolve(__dirname, 'private', 'audio.raw');
    const stat = fs.statSync(filePath);
    const readStream = fs.createReadStream(filePath);
    // pipe stream with response stream
    // ss.createBlobReadStream(filePath).pipe(stream);
    readStream.pipe(stream);
    console.log('Id: ', stream.id);

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