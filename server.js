const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

players = {}
asteroids = {}

function createAsteroids() {
  const asteroidSkins = ['asteroid1-anim', 'asteroid2-anim', 'asteroid3-anim', 'asteroid4-anim'];
  for (let i = 0; i < 100; i++) {
    asteroids[i] = {
        id: i,
        x: Math.random() * (3000 - 5000) + 5000,
        y: Math.random() * (2000 - 4000) + 4000,
        skin: asteroidSkins[Math.floor(Math.random() * asteroidSkins.length)]
    };
  }
}

app.use(express.static(__dirname + '/public'));
 
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});



io.on('connection', function (socket) {

  if (Object.keys(asteroids).length === 0) {
      createAsteroids();
  }

  players[socket.id] = {
      id: socket.id,
      x: 4000,
      y: 3000,
      drag:300,
      angularDrag:400
  };

  setTimeout(() => {
      socket.emit('loadPlayers', players);
      socket.emit('loadAsteroids', asteroids);
  }, 5000);

  socket.broadcast.emit('newPlayer', players[socket.id]);

  socket.on('disconnect', function () {
      delete players[socket.id];
      io.emit('playerDisconnect', socket.id);
  });

  // когда игроки движутся, то обновляем данные по ним
  socket.on('playerMove', movementData => {
      players[socket.id].x = movementData.x;
      players[socket.id].y = movementData.y;
      players[socket.id].rotation = movementData.rotation;

      socket.broadcast.emit('playerMoved', players[socket.id]);
  });

  socket.on('asteroidDestroy', id => {
      delete asteroids[id];
      socket.broadcast.emit('asteroidDestroyed', id);

      if (Object.keys(asteroids).length === 0) {
          createAsteroids();
          socket.emit('loadAsteroids', asteroids);
          socket.broadcast.emit('loadAsteroids', asteroids);
      }
  });
  
  socket.on('bulletFire', playerInfo => {    
    socket.broadcast.emit('bulletFired', playerInfo);
  });

});



server.listen(8080, function () {
  console.log(`Прослушиваем ${server.address().port}`);
});
