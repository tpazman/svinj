// http://ejohn.org/blog/ecmascript-5-strict-mode-json-and-more/
"use strict";

process.title = 'svinj master server';

// dependencies
var config = require('./config.json');
var webSocketServer = require('websocket').server;
var http = require('http');
var fs = require('fs');
var players = require('./players.json');
var protocol = require('./masterprotocol.js');
var servers = require('./servers.json');
var onlineServers = {};

var clients = {};
var nextClientId = 0;
var clientCount = 0;

// create http server
var server = http.createServer(function(request, response) { });
server.listen(config.serverPort, function() {
	console.log((new Date()) + " Server is listening on port " + config.serverPort);
});

// create websocket server
var wServer = new webSocketServer({ httpServer: server });
wServer.binaryType = 'arraybuffer';
// connection request callback
wServer.on('request', function(request) {
	console.log('connection request from: ' + request.origin);
	// if too busy reject clients
	if (clientCount >= config.maxClients) {
		console.log('request from ' + request.origin + ' rejected, maxClients reached');
		request.reject();
		return;
	}
	
	// check origin
	if (request.origin != config.loginOrigin) {
		console.log('request from ' + request.origin + ' rejected, wrong origin');	
		request.reject();
		return;
	}
	
	// accept the request and add new client
    var connection = request.accept(null, request.origin); 
	connection.binaryType = "arraybuffer";
	var client = {};
	client.connection = connection;
	client.id = nextClientId;
	client.origin = request.origin;
	client.ip = connection.remoteAddress;	
	nextClientId++;
	clients[client.id] = client;
    console.log((new Date()) + ' connect: ' + client.id);
	
    // message received callback
    connection.on('message', function(message) {
		client.lastRequest = new Date();	
		var request = JSON.parse(message.utf8Data);
		var response = respond(request, client);
		if (!response)
			connection.close();			
		else	
			connection.send(JSON.stringify(response));
    });
 
    // connection closed callback
    connection.on('close', function(connection) {
        console.log((new Date()) + ' disconnect: ' + client.id);
		delete clients[client.id];
    });
});

function checkLogin(username, password) {
	var player = players[username];
	if (player && player.password == password)
		return true;
	else
		return false;
}

function respond(request, client) {
	var response = {};
	response.result = 'request failed';
	if (!('type' in request && 'username' in request && 'password' in request))
		return null;
		
	if (request.type == 'login') {
		var player = players[request.username];
		if (checkLogin(request.username, request.password)) {
			player.token = { username : request.username, ip : client.ip, key : Math.floor(Math.random() * 0x1000000).toString() + Math.floor(Math.random() * 0x1000000).toString() };
			response.result = 'ok';			
			response.token = player.token;
			response.name = player.name;
		}
	}
	
	if (request.type == 'logout') {
		var player = players[request.username];
		if (checkLogin(request.username, request.password) && player.token) {
			delete player.token;
			response.result = 'ok';			
		}
	}
	
	if (request.type == 'servers') {
		if (checkLogin(request.username, request.password)) {
			response.result = 'ok';
			response.servers = [];
			for (var index in servers)
				// TODO	if (server.ip) !!!	
				response.servers.push(getServerInfo(servers[index]));
		}
	}
	
	return response;
}

function getServerInfo(server) {
	var serverInfo = {};
	serverInfo.name = server.name;
	serverInfo.address = server.address;
	return serverInfo;
}

function loopStart() {
	setInterval(loop, 1000 / config.updatesPerSecond);		
}

// main loop
var updating = false;
function loop() {
	// check reentry guard
	if (updating == true) {
		console.log(new Date() + ' main loop reentry, cycle skipped!');
		return;
	}
	
	// get rid of clients that have timed out
	var time = new Date();
	for (var index in clients) {
		var client = clients[index];
		if (time - client.lastRequest > config.clientTimeout)
			client.connection.close();
	}
	
	// set reentry guard
	updating = true;
    
	// unset reentry guard
	updating = false;
}

loopStart();