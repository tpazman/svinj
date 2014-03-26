// message types enumeration
var messageType = {
	SERVERINFO : 9,
	ISPLAYER : 10,
	KEYDOWN : 11,
	KEYUP : 12,
	TURN : 13,
	LCLICK : 14,
	RCLICK : 15,
	ENTITYDATA : 16,
	ENTITYDATAWITHSCORE : 17,
	SERVERFULL : 18
}

// converts a websocket message to a game action object
function actionFromMessage(rawMessage, client) {
	var action = {};
	action.clientId = client.id;
	
	// byte 0 = message type
	action.type = rawMessage[0];
	action.valid = false;
	
	// keydown/up: byte 1 = keyCode
	if ((action.type == messageType.KEYDOWN || action.type == messageType.KEYUP) && rawMessage.length == 2) {
		action.keyCode = rawMessage[1];
		action.valid = true;
	}
	
	// turn/click: byte 1 = angle
	if ((action.type == messageType.TURN) && rawMessage.length == 2) {
		action.angle = rawMessage[1];
		action.valid = true;
	}
	
	if ((action.type == messageType.LCLICK || action.type == messageType.RCLICK) && rawMessage.length == 6) {
		action.x = rawMessage[1] << 8;
		action.x += rawMessage[2];
		action.y = rawMessage[3] << 8;
		action.y += rawMessage[4];
		action.angle = rawMessage[5];
		action.valid = true;
	}
	
	if (action.type == messageType.ISPLAYER) {
		action.immediate = true;
		action.valid = true;
	}
	
	return action;
}

function messageServerFull() {
	var buffer = new Buffer(1);
	buffer[0] = messageType.SERVERFULL;
	return buffer;
}

function messageYourId(id) {
	var buffer = new Buffer(3);
	buffer[0] = messageType.YOURID;
	buffer[1] = id >> 8;
	buffer[2] = id & 0x00ff;
	return buffer;
}

function messageFromEntityData(entities, client, withScore) {
	var entrySize = 8;
	if (withScore)
		entrySize = 10;
		
	var inactiveEntities = 0;
	for (var index in entities)
		if (!entities[index].active)
			inactiveEntities++;
	var arrayLength = 4 + (Object.keys(entities).length - inactiveEntities) * entrySize;
	var buffer = new Buffer(arrayLength);
	
	buffer[0] = messageType.ENTITYDATA;  
	if (withScore)
		buffer[0] = messageType.ENTITYDATAWITHSCORE;
		
	buffer[1] = client.entityId;
	buffer[2] = entities[client.entityId].health;	
	buffer[3] = entities[client.entityId].missileAmmo;		
	var arrayIndex = 4;
	for (var index in entities) {
		var entity = entities[index];
		if (!entity.active)
			continue;
		buffer[arrayIndex++] = entity.id;	
		buffer[arrayIndex++] = entity.type;
		if (withScore) {
			buffer[arrayIndex++] = entity.kills;
			buffer[arrayIndex++] = entity.deaths;
		}
		buffer[arrayIndex++] = entity.x >> 8;
		buffer[arrayIndex++] = entity.x & 0x00ff;
		buffer[arrayIndex++] = entity.y >> 8;
		buffer[arrayIndex++] = entity.y & 0x00ff;
		buffer[arrayIndex++] = entity.angle;
		buffer[arrayIndex++] = entity.animFrame;
	}
	
	return buffer;
}

// interface
module.exports.messageType = messageType;
module.exports.actionFromMessage = actionFromMessage;
module.exports.messageFromEntityData = messageFromEntityData;
module.exports.messageServerFull = messageServerFull;
module.exports.messageYourId = messageYourId;