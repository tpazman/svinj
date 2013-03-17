var entityTypes = {
	DESTROYED : 0,
	BLUEROBOT : 1,
	REDROBOT : 2,
	GREENROBOT : 3,
	ORANGEROBOT : 4,
	PURPLEROBOT : 5,
	MISSILE : 6,
	HEALTH : 7,
	MISSILEAMMO : 8
}

var mouseButtons = {
	LEFT : 0,
	RIGHT : 1
}

var scoreLimit = 20;
var endMatchPause = 10000;

// index of map layer
var mapLayerIndex = 0;

// index of object layer
var objectLayerIndex = 1;

// index of map tileset
var mapTilesetIndex = 0;

// index of object tileset
var objectTilesetIndex = 1;

// key definitions
var keys = {
	LEFT : 65,
	RIGHT : 68,
	UP : 87,
	DOWN : 83
}

// animation delay
var animDelay = 16;
// number of frames per animation
var animFrames = 4;

// constants
var invariantPlayerSpeed = 180;
var playerSpeed;
var multipleDirectionModifier = 0.707;
var playerStartingHealth = 100;
var playerMaxHealth = 150;
var playerMaxAmmo = 20;
var fireCooldown = 500;
var invariantMissileSpeed = 420;
var borderSoftness = 2;

// data
var config;
var gameState;
var clients;
var entities;
var freeEntityIds;	
var map;

var tileSize;
var tileArray;
var tileProperties;

var freePlayerTypes;

// initialize state
var init = function(cfg, gs, cli, ent, mp) {
	config = cfg;
	clients = cli;
	entities = ent;
	map = mp;
	gameState = gs;
	
	freeEntityIds = [];
	for (var i = 0; i < config.maxEntities; i++)
		freeEntityIds.push(i);
		
	freePlayerTypes = [];
	freePlayerTypes.push(entityTypes.BLUEROBOT);
	freePlayerTypes.push(entityTypes.REDROBOT);
	freePlayerTypes.push(entityTypes.GREENROBOT);
	freePlayerTypes.push(entityTypes.ORANGEROBOT);
	freePlayerTypes.push(entityTypes.PURPLEROBOT);	
	
	playerSpeed = invariantPlayerSpeed / config.updatesPerSecond;
	
    tileSize = map.tilesets[mapTilesetIndex].tilewidth;
	tileArray = map.layers[mapLayerIndex].data;
	tileProperties = map.tilesets[mapTilesetIndex].tileproperties;	
	objectArray = map.layers[objectLayerIndex].data;
	objectProperties = map.tilesets[objectTilesetIndex].tileproperties;		
	
	gameState.updatedPositions = true;
	gameState.updatedScore = true;
	
	startMatch();
}

function addObjects() {
	var width = map.layers[objectLayerIndex].width;
	var height = map.layers[objectLayerIndex].height;
	var first = map.tilesets[objectTilesetIndex].firstgid;
	for (var y = 0; y < height; y++) {
		for (var x = 0; x < width; x++) {
			var objectIndex = objectArray[y * width + x] - first;
			if (!(objectIndex in objectProperties))
				continue;
				
			var objectType = objectProperties[objectIndex].objectType;
			if (objectType == entityTypes.HEALTH)
				CreateHealth(x, y);
			else if (objectType == entityTypes.MISSILEAMMO)
				CreateMissileAmmo(x, y);			
		}
	}
}

function refreshObjects() {
	for (var index in entities) {
		var entity = entities[index];
		
		if (!entity.pickUp || entity.active)
			continue;
			
		var time = new Date();
		
		if (time - entity.lastCooldown > entity.cooldown)
			entity.active = true;
	}
}

function startMatch() {
	for (var index in clients)
		addPlayer(clients[index]);
		
	addObjects();
}

function Explode(entity, targetX, targetY) {
	if (!entity.explosion)
		return;

	var explosionCenter = { x : entity.x + entity.width / 2 + entity.collisionX, y : entity.y + entity.height / 2 + entity.collisionY };
	
	for (var index in clients) {
		if (!(clients[index].entityId >= 0))
			continue;
			
		var player = entities[clients[index].entityId];
		damage = entity.explosion.damage;
		
		if (!(targetX >= player.x && targetX <= player.x + player.width && targetY >= player.y && targetY <= player.y + player.height)) {
			var playerCenter = { x : player.x + player.width / 2, y : player.y + player.height / 2 };
			var halfWidth = player.width / 2;
			var halfHeight = player.height / 2;
			var playerRadius = Math.sqrt(halfWidth*halfWidth + halfHeight*halfHeight);
			
			var dx = explosionCenter.x - playerCenter.x;
			var dy = explosionCenter.y - playerCenter.y;
			var distance = Math.sqrt(dx*dx + dy*dy);
			var radius = entity.explosion.radius;
			var overlap = Math.min(radius, radius + entity.collisionSize / 2 + playerRadius - distance);
			
			if (overlap > 0)
				damage = (1 + 2 * overlap / radius) * damage / 3;
			else
				damage = 0;
		}
		
		
		player.health -= Math.floor(damage);
		if (player.health <= 0)
			killPlayer(player, entity.ownerId);
	}
}

function CreateMissile(owner, tx, ty, angle) {
	var entity = {};
	entity.ownerId = owner.id;
	entity.height = 10;
	entity.width = 26;
	entity.animFrame = 0;
	entity.destroyOnImpact = true;
	entity.rotates = true;	
	entity.collisionSize = 12;
	entity.passThrough = true;
	entity.explosion = { damage : 50, radius : 32 };
	entity.id = freeEntityIds.shift();
	entity.type = entityTypes.MISSILE;
	
	entity.angle = angle;
	var angleRad = -entity.angle / 256 * 2 * 3.141592;
	entity.cos = Math.cos(angleRad);
	entity.sin = Math.sin(angleRad);	
	var radius = entity.width / 2;
	entity.collisionX = entity.cos * radius;
	entity.collisionY = entity.sin * radius;

	sx = owner.x + 4;
	sy = owner.y + 4;
	var dx = tx - entity.collisionX - entity.width / 2 - sx;
	var dy = ty - entity.collisionY - entity.height / 2 - sy;
	var factor = Math.sqrt(dx*dx + dy*dy);

	entity.cos = dx / factor;
	entity.sin = dy / factor;
	var missileSpeed = invariantMissileSpeed / config.updatesPerSecond;
	entity.xSpeed = entity.cos;
	entity.ySpeed = entity.sin;
	entity.x = sx + entity.xSpeed * 30;
	entity.y = sy + entity.ySpeed * 30;	
	entity.xSpeed *= missileSpeed;
	entity.ySpeed *= missileSpeed;	
	entity.active = true;

	entities[entity.id] = entity;	
}

function CreateHealth(x, y) {
	var entity = {};
	entity.x = x * tileSize;
	entity.y = y * tileSize;
	entity.height = 32;
	entity.width = 32;
	entity.animFrame = 0;
	entity.pickUp = true;
	entity.giveHealth = 50;
	entity.passThrough = true;
	entity.active = true;
	entity.cooldown = 30000;
	entity.lastCooldown = +new Date();	
	entity.id = freeEntityIds.shift();
	entity.type = entityTypes.HEALTH;
	entity.stationary = true;
	entities[entity.id] = entity;	
}

function CreateMissileAmmo(x, y) {
	var entity = {};
	entity.x = x * tileSize;
	entity.y = y * tileSize;
	entity.height = 32;
	entity.width = 32;
	entity.animFrame = 0;
	entity.pickUp = true;
	entity.giveMissileAmmo = 5;
	entity.passThrough = true;
	entity.active = true;
	entity.cooldown = 15000;
	entity.lastCooldown = +new Date();		
	entity.id = freeEntityIds.shift();
	entity.type = entityTypes.MISSILEAMMO;
	entity.stationary = true;	
	entities[entity.id] = entity;	
}

function destroyEntity (entity, targetX, targetY) {
	Explode(entity, targetX, targetY);

	freeEntityIds.push(entity.id);
	delete entities[entity.id];
}

function findFreeTile (entity) {
	var legalPosition = false;
	var tile = { x : 0, y : 0};
	while (!legalPosition) {
		tile.x = Math.floor(Math.random() * map.layers[mapLayerIndex].width);
		tile.y = Math.floor(Math.random() * map.layers[mapLayerIndex].height);
		
		if (canMove(entity, tile.x * tileSize, tile.y * tileSize))
			legalPosition = true;
	}       
	
	return tile;
}

function endMatch() {
	gameState.matchInProgress = true;
	gameState.endTime = new Date();
	gameState.countDown = endMatchPause;
}

function killPlayer (player, killerId) {
	player.deaths++;
	if (killerId != player.id)
		entities[killerId].kills++;
	else {
		if (entities[killerId].kills > 0)
			entities[killerId].kills--;
	}

	var tile = findFreeTile(player);
	player.health = playerStartingHealth;
	player.x = tileSize * tile.x;
	player.y = tileSize * tile.y;
	player.missileAmmo = 8;
	
	gameState.updatedScore = true;
	
	if (killerId.kills == scoreLimit) {
		endMatch();
	}	
}

function addPlayer(client) {
	if (!client.isPlayer)
		return;
		
	var id = freeEntityIds.shift();
	var type = freePlayerTypes.shift();
	var entity = {};
	entity.id = id;
	entity.type = type;
	entity.height = 32;
	entity.width = 32;
	var tile = findFreeTile(entity);
	entity.x = tileSize * tile.x;
	entity.y = tileSize * tile.y;
	entity.angle = 0;
	entity.ySpeed = 0;
	entity.xSpeed = 0;
	entity.canSlide = true;
	entity.health = playerStartingHealth;
	entity.missileAmmo = 8;
	entity.kills = 0;
	entity.deaths = 0;
	entity.animFrame = 0;
	entity.lastFire = new Date();
	entity.active = true;
	entities[id] = entity;
	client.entityId = id;
	gameState.updatedPositions = true;
	gameState.updatedScore = true;
}

function removePlayer(client) {
	if (!client.isPlayer)
		return;

	if (client.entityId in entities) {
		freePlayerTypes.push(entities[client.entityId].type);	
		delete entities[client.entityId];
		freeEntityIds.push(client.entityId);
	}
	client.entityId = -1;
	gameState.updatedPositions = true;	
	gameState.updatedScore = true;	
}

// update state
var update = function() {
	handleInput();
	refreshObjects();
	moveEntities();
}

function handleInput() {
	for (var index in clients) {
		var client = clients[index];
		if (!client.isPlayer)
			continue;
		
		var entity = entities[client.entityId];	
		
		// handle mouse movement
		if (client.mouseAngle != entity.angle) {
			entity.angle = client.mouseAngle;
			gameState.updatedPositions = true;
		}
		
		// handle left click
		if (mouseButtons.LEFT in client.pressedKeys) {
			var time = new Date();
			if (time - entity.lastFire > fireCooldown && entity.missileAmmo > 0) {
				var params = client.pressedKeys[mouseButtons.LEFT];
				entity.lastFire = time;
				entity.missileAmmo--;
				CreateMissile(entity, params.x, params.y, params.angle);
			}
			delete client.pressedKeys[mouseButtons.LEFT];			
		}
		
		// handle right click
		if (mouseButtons.RIGHT in client.pressedKeys) {
		
		}		
		
		// handle keyboard
		
		entity.xSpeed = 0;
		entity.ySpeed = 0;
		
		// check if the player is moving in two directions
		if (keys.LEFT in client.pressedKeys)
			entity.xSpeed -= playerSpeed;
		if (keys.RIGHT in client.pressedKeys)
			entity.xSpeed += playerSpeed;
		if (keys.UP in client.pressedKeys)
			entity.ySpeed -= playerSpeed;
		if (keys.DOWN in client.pressedKeys)
			entity.ySpeed += playerSpeed;
		
		// modify speed
		if (Math.abs(entity.xSpeed) + Math.abs(entity.ySpeed) > playerSpeed) {
			entity.xSpeed *= multipleDirectionModifier;
			entity.ySpeed *= multipleDirectionModifier;
		}
	}
}

function pickUp(entity, pickEntity) {
	if (!entity.health)
		return;
		
	pickEntity.active = false;
	pickEntity.lastCooldown = new Date();
	
	if (pickEntity.giveHealth)
		entity.health = Math.min(playerMaxHealth, entity.health + pickEntity.giveHealth);
		
	if (pickEntity.giveMissileAmmo)
		entity.missileAmmo = Math.min(playerMaxAmmo, entity.missileAmmo + pickEntity.giveMissileAmmo);		
}

function moveEntities() {
	for (var index in entities) {
		var entity = entities[index];
		

		gameState.updatedPositions = true;	
		
		if ('stationary' in entity) {
			entity.animFrame = (entity.animFrame + 1) % (animFrames * animDelay);			
			continue;
		}
		
		if (entity.xSpeed == 0 && entity.ySpeed == 0)
			continue;
			
		entity.animFrame = (entity.animFrame + 1) % (animFrames * animDelay);				
		
		var targetX = entity.x + entity.xSpeed;
		var targetY = entity.y + entity.ySpeed;
			
		if (!entity.canSlide) {
			if (canMove(entity, targetX, targetY)) {
				entity.x = targetX;
				entity.y = targetY;
			} else if (entity.destroyOnImpact) {
				entity.x = targetX;
				entity.y = targetY;
				destroyEntity(entity, targetX, targetY);
			} 
		} else {
			// if legal vertical move, move player
			if (canMove(entity, entity.x, targetY))
				entity.y = targetY;

			// if legal horizontal move, move player            
			if (canMove(entity, targetX, entity.y))
				entity.x = targetX;	
		}
		
		for (var pickIndex in entities) {	
			var pickEntity = entities[pickIndex];
			if (!pickEntity.pickUp || !pickEntity.active) 
				continue;
			
			if (isIn(entity, pickEntity))
				pickUp(entity, pickEntity);
		}
	}
}

function isIn(entity1, entity2) {
	if (entity1.x + entity1.width > entity2.x && entity1.x < entity2.x + entity2.width && entity1.y + entity1.height > entity2.y && entity1.y < entity2.y + entity2.height)
		return true;
	else
		return false;
}

function canMove(entity, x, y) {
    var legalPosition = true;

	var width = entity.width;
	var height = entity.height;
	if (entity.rotates) {
		x += entity.width / 2 + entity.collisionX - entity.collisionSize / 2;
		y += entity.height / 2 + entity.collisionY - entity.collisionSize / 2;
		width = entity.collisionSize;
		height = entity.collisionSize;
		//var minSize = Math.min(width, height);
		//width = Math.max(Math.abs(entity.cos) * entity.width, minSize);
		//height = Math.max(Math.abs(entity.sin) * entity.height, minSize);
	} 
	
    x = Math.floor(x);
    y = Math.floor(y);	
	
    var requiredFreePoints = [  {x : x + borderSoftness, y : y + borderSoftness},
                                {x : x + borderSoftness, y : y + height - borderSoftness},
                                {x : x + width - borderSoftness, y : y + borderSoftness},
                                {x : x + width - borderSoftness, y : y + height - borderSoftness} ];
    
    for (var index in requiredFreePoints) {
        var point = requiredFreePoints[index];
        var tile = getTile(point.x, point.y);
        var tileIndex = tileArray[tile.y * map.layers[objectLayerIndex].width + tile.x] - 1;
        if (tileIndex in tileProperties && tileProperties[tileIndex].canWalk == 0)
            return false;
		
		for (var entityIndex in entities) {
			var otherEntity = entities[entityIndex];
			
			if (otherEntity == entity || otherEntity.passThrough)
				continue;
			
			var left = otherEntity.x;
			var right = left + otherEntity.width;
			var top = otherEntity.y;
			var bottom = top + otherEntity.height;
			
			if (point.x >= left && point.x <= right && point.y >= top && point.y <= bottom)
				return false;
		}
     }
        
    return legalPosition;
}

function getTile(x, y) {
    var tile = {};
    tile.x = Math.floor(x / tileSize);
    tile.y = Math.floor(y / tileSize);
    return tile;
}

// interface
module.exports.update = update;
module.exports.init = init;
module.exports.addPlayer = addPlayer;
module.exports.removePlayer = removePlayer;