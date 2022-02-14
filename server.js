const path = require('path'); // express.static에 사용할 public 폴더의 경로를 정의하기 위해 모듈을 불러온다.
const http = require('http'); // socket.io에 적용할 서버를 생성하기 위해 모듈을 불러온다.
// 하지만 app.listen()이 서버를 리턴하기 때문에 그 것을 변수에 할당해서 socket.io에 넣어도 동일하게 동작한다.
const express = require('express');
const socketio = require('socket.io');
const formatMessage = require('./utils/messages');
const {
  userJoin, // id, username, room 정보를 받아 객체화한 뒤, 유저 목록에 추가(생성한 유저 객체 반환)
  getCurrentUser, // 연결된(접속한) 유저 목록에서 해당 유저를 찾아서 객체로 반환
  userLeave, // 유저의 id를 입력받아 해당 유저를 접속 중인 유저 목록에서 제거
  getRoomUsers // 접속 중인 유저 중 같은 room에 있는 유저의 목록을 배열 형태로 반환
} = require('./utils/users');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Set static folder
// 앱을 실행하면 실행할 정적 파일을 읽어오는 express가 제공하는 static 미들웨어로
// 절대경로 + public 디렉토리의 모든 정적 파일을 읽어온다.
// 미들웨어에 등록했기 때문에 서버가 실행되면 정적 파일이 자동으로 실행된다.(브라우저에 바로 띄워진다.)
app.use(express.static(path.join(__dirname, 'public')));
// express에서 제공하는 정적 파일을 읽어오는 미들웨어
// 절대 경로의 public이라는 디렉토리에 있는 파일을 모두 읽어온다.
// 미들웨어로 등록했기 때문에 브라우저에서 /에 접속하면 해당 정적 파일을 기본적으로 보여주게 된다.

const botName = 'ChatCord Bot';

// Run when client connects
// 클라이언트가 실행될 때, io()에서 connection 이벤트를 보내면 실행되는 부분
io.on('connection', (socket) => {
  // 여기는 서버의 Root Path이다.
  // 이 Path로 들어오는 socket 이벤트는 클라이언트에서 Default Namespace로 보내는 Connection 이벤트이다.
  // 해당하는 Namespace에 들어오는 Connection 이벤트에 함께 Callback의 인자로 들어오는 socket은 해당 Client의 socket(유저)이다.
  // 각 socket은 현재 Connection 이벤트를 발생시킨 Client(유저)이며 각 socket은 고유한 id(socket.id)를 가진다.
  // 보통 이 id(socket.id)로 각 Client(유저)를 구분할 수 있다.

  socket.on('joinRoom', ({ username, room }) => {
    // Client에서 joinRoom 이벤트를 발생시킬 때, username과 room 이름을 객체 형태로 전달한다.
    const user = userJoin(socket.id, username, room);
    // socket.id는 각 socket(Client)에 부여되는 고유한 값으로 Client(유저)를 구분할 때 사용할 수 있다.

    socket.join(user.room);
    // 해당 socket(Client)이 해당 room에 join 한다.
    // room 이름이라는 카테고리로 그룹화 하는 것과 같다.

    // Welcome current user
    socket.emit('message', formatMessage(botName, 'Welcome to ChatCord!'));

    // Broadcast when a user connects
    socket.broadcast //! broadcast는 emit 이벤트를 발생시킨 사용자(접속한 사용자)를 제외한 모두에게 보낸다.
      .to(user.room) // to를 사용해서 해당 room에 broadcast를 보내는 것이다.
      .emit(
        'message',
        formatMessage(botName, `${user.username} has joined the chat`)
      );

    // Send users and room info
    io.to(user.room).emit('roomUsers', {
      // 해당 room에 join된 socket(Client)에게 emit을 보낸다.
      room: user.room,
      users: getRoomUsers(user.room)
    });
  });

  // Listen for chatMessage
  socket.on('chatMessage', (msg) => {
    const user = getCurrentUser(socket.id);

    io.to(user.room).emit('message', formatMessage(user.username, msg));
  });

  // Runs when client disconnects
  socket.on('disconnect', () => {
    const user = userLeave(socket.id);

    if (user) {
      io.to(user.room).emit(
        'message',
        formatMessage(botName, `${user.username} has left the chat`)
      );

      // Send users and room info
      io.to(user.room).emit('roomUsers', {
        room: user.room,
        users: getRoomUsers(user.room)
      });
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
