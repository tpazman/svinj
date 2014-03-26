// dependencies
var WebSocketServer = require('ws').Server;
var http = require('http');
var express = require('express');
var fs = require('fs');
var app = express();
var serverProtocol = require('./serverprotocol.js');
var config = loadJson('config.json');
var map = loadJson(config.mapPath);
var mode = require(config.modePath);
  
app.use(express.static(__dirname + '/'));

var port = port = process.env.PORT || 9868;
var server = http.createServer(app);
server.listen(port);

console.log('http server listening on %d', port);

var wServer = new WebSocketServer({server: server});
console.log('websocket server created');

// set up initial state
var gameState;
var clients;
var freeClientIds;
var playerClients;
var entities;
var pendingActions;
var timerId;

function initialize() {
	gameState = {};
	gameState.updatedPositions = false;

	clients = {};
	freeClientIds = [];
	for (var i = 0; i < config.maxClients; i++)
		freeClientIds.push(i);	

	playerClients = 0;
	pendingActions = [];		
	timerId = -1;
}

initialize();

var clientState = {
	CONNECTED : 0,
	AUTHORIZED : 1,
	LOADED : 2,
	PLAYING : 3
}

matchStart();

// connection request callback
wServer.on('connection', function(request) {

	if (freeClientIds.length == 0) {
		request.reject();
		return;
	}
	
    var connection = request;
	//connection.binaryType = 'arraybuffer';
	var client = {};
	client.connection = connection;
	client.id = freeClientIds.shift();
	client.pressedKeys = [,];
	client.state = clientState.CONNECTED;
	client.isPlayer = false;
	clients[client.id] = client;
    console.log((new Date()) + ' connect: ' + client.id);
	//gameState.updatedPositions = true;
	
	// TEMP
	// playerClients++;
	// client.isPlayer = true;
	// mode.addPlayer(client);	
	// END TEMP
	
    // message received callback
    connection.on('message', function(message) {
		console.log(message);
		// parse binary messages
		if (message instanceof Buffer) {
			var byteArray = new Uint8Array(message);	
			var parsedAction = serverProtocol.actionFromMessage(byteArray, client);
			if (parsedAction.valid == true) {
				if (parsedAction.immediate == true)
					evalAction(parsedAction);
				else 
					pendingActions.push(parsedAction);
			}
		}
		// parse json messages
		else {
		    if (message && message.utf8Data) {
				var request = JSON.parse(message.utf8Data)
				var response = respond(request);
				if (response)
					connection.send(JSON.stringify(response));
			}
		}
    });
 
    // connection closed callback
    connection.on('close', function(connection) {
        console.log((new Date()) + ' disconnect: ' + client.id);
		mode.removePlayer(client);
		freeClientIds.push(client.id);
		if (clients[client.id].isPlayer)
			playerClients--;
		delete clients[client.id];
    });
});

function respond(request) {
	if (!('type' in request))
		return null;
	
	var response = {};
	response.result = 'request failed';
	
	if (request.type == 'serverInfo') {
		response.maxPlayers = config.maxPlayers;
		response.currentPlayers = playerClients;
		response.mapName = config.mapName;
		response.modeName = config.modeName;
		response.result = 'ok';
	}
	
	return response;
}

function matchStart() {
    if (timerId != -1)
        clearInterval(timerId);
        
    frameNum = 0;
	var data = {};	
	entities = {};
	mode.init(config, gameState, clients, entities, map);
	timerId = setInterval(matchLoop, 1000 / config.updatesPerSecond);		
}

// main loop
var updating = false;
var frameNum;
var updateSkipper = 0;
function matchLoop() {
	// check reentry guard
	if (updating == true) {
		console.log(new Date() + ' main loop reentry, cycle skipped -> update rate too high!');
		return;
	}
	
	// set reentry guard
	updating = true;
	
	// handle user actions
	while (pendingActions.length > 0)
		evalAction(pendingActions.shift());
	
	// update world
	mode.update();
	
	// send updates to players
    if (updateSkipper == 0 && (frameNum == 0 || gameState.updatedPositions == true))
        sendUpdates();

	updateSkipper++;
	if (updateSkipper == config.updatePlayersEachXUpdates)
		updateSkipper = 0;
	
    frameNum++;
    
	// unset reentry guard
	updating = false;
}

var dataSent = 0;
var updatesSent = 0;
var lastKbpsUpdate = new Date();
function sendUpdates() {
    for (var index in clients) {
        var client = clients[index];
		if (client.isPlayer) {
			var entityDataMessage = serverProtocol.messageFromEntityData(entities, client, gameState.updatedScore);	
			dataSent += 34 + entityDataMessage.length;
			try {
				client.connection.send(entityDataMessage, {binary: true});
			}
			catch (err) {
				// the connection died, but the close event wasn't raised yet -> fine
			}
		}
    }
	updatesSent++;
	
	var time = new Date();
	if (time - lastKbpsUpdate > 60000) {
		lastKbpsUpdate = time;
		console.log((dataSent / 1024 / 60) + ' kb/s, ' + updatesSent / 60 + ' updates per second');
		dataSent = 0;
		updatesSent = 0;
	}
	gameState.updatedScore = false;	
	gameState.updatedPositions = false;
}

function evalAction(action) {
	console.log(action);

	var client = clients[action.clientId];
	
	if (action.type == serverProtocol.messageType.ISPLAYER) {
		if (playerClients < config.maxPlayers) {
			playerClients++;
			client.isPlayer = true;
			mode.addPlayer(client);			
		}
		else {
			client.connection.send(serverProtocol.messageServerFull());
			client.connection.close();
		}
	}	
	
	if (client.isPlayer) {		
		if (action.type == serverProtocol.messageType.KEYDOWN)
			client.pressedKeys[action.keyCode] = true;
		
		if (action.type == serverProtocol.messageType.KEYUP)
			delete client.pressedKeys[action.keyCode];
		
		if (action.type == serverProtocol.messageType.TURN)
			client.mouseAngle = action.angle;
		
		if (action.type == serverProtocol.messageType.LCLICK) {
			client.pressedKeys[0] = { x : action.x, y : action.y, angle : action.angle};
		}
		
		if (action.type == serverProtocol.messageType.LCLICK) {
			client.pressedKeys[1] = { x : action.x, y : action.y, angle : action.angle};
		}		
	}
}

function loadJson(path) {
	var fileContents = fs.readFileSync(path,'utf8'); 
	return JSON.parse(fileContents); 
}