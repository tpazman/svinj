// message types enumeration
var messageType = {
	KEYDOWN : 11,
	KEYUP : 12,
	TURN : 13,
	CLICK : 14,
	PLAYERDATA : 15
}

// converts a websocket message to a game action object
function actionFromMessage(rawMessage, playerId) {
	var action = {};
	action.playerId = playerId;
	
	// byte 0 = message type
	action.type = rawMessage[0];
	action.valid = false;
	
	// keydown/up: byte 1 = keyCode
	if ((action.type == messageType.KEYDOWN || action.type == messageType.KEYUP) && rawMessage.length == 2) {
		action.keyCode = rawMessage[1];
		action.valid = true;
	}
	
	// turn/click: byte 1 = angle
	if ((action.type == messageType.TURN || action.type == messageType.CLICK) && rawMessage.length == 2) {
		action.angle = rawMessage[1] * 360 / 256;
		action.valid = true;
	}
	return action;
}

function messageFromPlayerData(players) {
	var arrayLength = 1 + Object.keys(players).length * 5;
	var buffer = new Buffer(arrayLength);
	buffer[0] = messageType.PLAYERDATA;  
	var arrayIndex = 1;
	for (var index in players) {
		var player = players[index];
		if (player.active == true) {
			buffer[arrayIndex++] = player.x >> 8;
			buffer[arrayIndex++] = player.x & 0x00ff;
			buffer[arrayIndex++] = player.y >> 8;
			buffer[arrayIndex++] = player.y & 0x00ff;
			buffer[arrayIndex++] = player.angle * 256 / 360;
		}
	}
	return buffer;
}

// interface
module.exports.messageType = messageType;
module.exports.actionFromMessage = actionFromMessage;
module.exports.messageFromPlayerData = messageFromPlayerData;