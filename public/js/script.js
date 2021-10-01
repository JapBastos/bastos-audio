let socket;

// server side
const { pipeline } = require('stream')
const server = require('http').Server().listen(8080)
const io = require('socket.io')(server)
const ss = require('socket.io-stream')

io.on('connection', (socket) => ss(socket).on('stream', (stream) => {
  pipeline(stream, process.stdout,  (err) => err && console.log(err))
}));


// client side
const client = require('socket.io-client')
const socket = client.connect('http://localhost:8080')

socket.on('connect', () => {
  const stream = ss.createStream()
  ss(socket).emit('stream', stream)
  pipeline(process.stdin, stream,  (err) => err && console.log(err))
});

document.getElementById("join").addEventListener("click", function () {
  if (!socket) {
    socket = new io("http://localhost:3333");
  }

  socket.on("received", (message) => {
    console.log(message);
  });
});

document
  .getElementById("send-message")
  .addEventListener("click", function () {
    if (!socket) {
      return;
    }

    socket.emit("message", `Hello Popsen ${Math.random()}`);
  });