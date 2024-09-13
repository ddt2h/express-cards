import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';

import { Game } from '../mechanics/game';
import { State } from './interfaces/state';
import { ActResponse } from './interfaces/act.response';
import { TurnResponse } from './interfaces/turn.response';
import { GetCardResponse } from './interfaces/getcard.response';
import { CardList } from './interfaces/card.list';

let game = new Game();
game.startGame();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 22828;
let readySet = new Set();
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

function emitGlobalState() {
    let customState: State = game.getState();
    for (const [id, connectedSocket] of io.sockets.sockets) {
        customState.yourCards = game.getUserDeck(id);
        customState.readyCount = readySet.size;
        connectedSocket.emit('state', JSON.stringify(customState));
    }
}

function onConnection(socket: Socket) {
    game.addUser(socket.id);
    socket.emit('your_name', socket.id);
    emitGlobalState();
}

function validateReady(socket: Socket) : boolean {
    if (readySet.size !== io.engine.clientsCount) {
        socket.emit('error', `Ready ${readySet.size}/${io.engine.clientsCount}`);
        return false;
    }

    return true;
}

function validateUser(socket: Socket) : boolean{
    if (game.getCurrentUsername() !== socket.id) {
        socket.emit('error', 'Its not your turn');
        return false;
    }

    return true;
}

function onReady(socket: Socket) {
    readySet.has(socket.id) ? readySet.delete(socket.id) : readySet.add(socket.id);
    emitGlobalState();
}

function onGetCard(socket: Socket) {
    if (!validateReady(socket)) return;
    if (!validateUser(socket)) return;

    const get: GetCardResponse = game.getCard();

    if (get.error) {
        if (!game.getUserDeck(socket.id).length && get.error === 'No cards left') {
            socket.emit('winner', socket.id);
            return;
        }
        socket.emit('error', get.error);
        return;
    }

    emitGlobalState();
}

function onTurn(socket: Socket) {
    if (!validateReady(socket)) return;
    if (!validateUser(socket)) return;

    const turn: TurnResponse = game._turn();

    if (turn.error) {
        io.emit('error', turn.error);
        return;
    }

    socket.emit('turn_result', JSON.stringify({ result: turn.isRight }));

    emitGlobalState();
}

function onPlaceCards(socket: Socket, cardsData: CardList) {
    if (!validateReady(socket)) return;
    if (!validateUser(socket)) return;

    const act: ActResponse = game._act(cardsData.ids, cardsData.as);

    if (!act.isValid) {
        console.log('Act failed :(', act.error);
        socket.emit('error', act.error);
        return;
    }

    emitGlobalState();
}

function onDisconnect(socket: Socket) {
    game.removeUser(socket.id);
    readySet.delete(socket.id);
}

io.on('connection', (socket: Socket) => {

    onConnection(socket);

    socket.on('ready', () => {
        onReady(socket);
    });

    socket.on('get_card', () => {
        onGetCard(socket);
    });

    socket.on('turn', () => {
        onTurn(socket);
    });

    socket.on('place_cards', async (cardsData: CardList) => {
        onPlaceCards(socket, cardsData);
    });

    socket.on('disconnect', () => {
        onDisconnect(socket);
    });
});


server.listen(PORT, '0.0.0.0', function () {
    console.log('Listening to port:  ' + PORT);
});

