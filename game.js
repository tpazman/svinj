var EntityTypes = {
	PLAYER : 0,
	ITEM : 1,
	PROJECTILE : 2
}

var ProjectileTypes = {
	ROCKET : 0,
	PIERCING : 1
}

var Teams = {
	BLUE : 0,
	RED : 1
}

var Entity = function(id, entityType, x, y, angle, image) {
	this.type = entityType;
	this.id = id;
	this.x = x;
	this.y = y;
	this.angle = angle;
	this.size = tileSize;
	this.animFrame = 0;
	this.active = false;
}

function vectorAngle(x1, y1, x2, y2) {
	var diffX = x2 - x1;
	var diffY = y1 - y2;
	if (diffX == 0)
		diffX++;
	var angleRad = Math.atan(diffY / diffX);
	var angle = Math.floor(angleRad / 2 / 3.14159 * 256);
	if (diffX < 0)
		angle = (angle + 128) % 256;
	if (angle < 0)
		angle = (angle + 256) % 256;
	return angle;
}

Entity.prototype.canSee(otherEntity) {
	var tileArray = map.layers[mapLayerIndex].data;
	var tileProperties = map.tilesets[mapTilesetIndex].tileproperties;
	var mapWidth = map.layers[mapLayerIndex].width;
	var mapHeight = map.layers[mapLayerIndex].height;

	var eyeX = this.x + tileWidth / 2;
	var eyeY = this.y + tileWidth / 4;			

	// check each corner of target
	for (var targetY = otherEntity.y; targetY <= otherEntity.y + otherEntity.size; targetY += otherEntity.size) {
		for (var targetX = otherEntity.x; targetX <= otherEntity.y + otherEntity.size; targetX += otherEntity.size) {		
			// if objects are next to each other, they are always visible
			if (Math.abs(targetX - this.x) < tileWidth && Math.abs(targetY - this.y) < tileHeight)
				return true;
				
			// calc angle
			var targetAngle = vectorAngle(eyeX, eyeY, targetX, targetY);
			// calc difference between angles
			var angleDiff = Math.abs(targetAngle - this.angle);
			// there are two angles between a pair of vectors - take the smaller one
			if (angleDiff > 128)
				angleDiff = 256 - angleDiff;
			
			// hack - make nearby objects a bit easier to see
			var maxDist = Math.max(Math.abs(targetX - this.x), Math.abs(targetY - this.y));
			var tempFov = fov;
			if (maxDist < 2 * tileSize)
				tempFov = 64;
			else if (maxDist < 3 * tileSize)
				tempFov = 32;
			else if (tileMaxDist < 4 * tileSize)
				tempFov = 16;					
			
			tempFov = Math.max(fov, tempFov);
					
			// if point is out of FoV, it isn't visible
			if (angleDiff > tempFov)
				continue;				
			
			var diffX = targetX - eyeX;
			var diffY = targetY - eyeY;
			var diffTotal = Math.sqrt(diffX * diffX + diffY * diffY);
			
			// if point is out of sight range, it isn't visible
			if (diffTotal > sightRange) 
				continue;
					
			var incX = diffX / diffTotal * fogSkip;
			var incY = diffY / diffTotal * fogSkip;
			var steps = Math.floor(diffX / incX);
			if (diffX == 0)
				steps = Math.floor(diffY / incY);
					
			steps = steps - 1;
			
			var visible = true;					
			var currentX = eyeX;
			var currentY = eyeY;
			for (var i = 0; i < steps; i++) {
				currentX += incX;
				currentY += incY;
				var tileX = Math.floor(currentX >> tileBit);
				var tileY = Math.floor(currentY >> tileBit);
				var tileIndex = tileY * mapWidth + tileX;
				var tilePropIndex = tileArray[tileIndex] - 1;
				if (tilePropIndex in tileProperties && tileProperties[tilePropIndex].canWalk == 0) {
					visible = false;
					break;
				}
			}
			
			if (visible)
				return true;
		}
	}
	return false;
}

function CreatePlayer(id, team, x, y, angle) {
	var player = new Entity(id, EntityTypes.PLAYER, x, y, angle);
	player.team = team;
	player.collisionPlayers = false;
	player.collisionWalls = true;	
	player.score = 0;
	player.health = config.InitialPlayerHealth;
	player.visibleEntities = [];	
	return player;
}

function CreateProjectile(id, type, x, y, angle) {
	var projectile = new Entity(id, EntityTypes.PROJECTILE, x, y, angle);
	projectile.collisionPlayers = true;
	if (type == ProjectileTypes.PIERCING) {
		projectile.collisionWalls = false;
		projectile.range = 1000;
		projectile.size = 8;
	} else if (type == ProjectileTypes.ROCKET) {
		projectile.collisionWalls = true;
		projectile.range = 1000;
		projectile.size = 32;
	}
}

