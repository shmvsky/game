class Bullet extends Phaser.Physics.Arcade.Image
{	
    constructor (scene)
    {
        super(scene, 0, 0, 'space', 'blaster');

        this.setBlendMode(1);
        this.setDepth(1);

        this.speed = 800;
        this.lifespan = 2100;

        this._temp = new Phaser.Math.Vector2();
    }

    fire (player)
    {
        this.lifespan = 2100;

        this.setActive(true);
        this.setVisible(true);
        this.setAngle(player.body.rotation);
        this.setPosition(player.x, player.y);
        this.body.reset(player.x, player.y);

        const angle = Phaser.Math.DegToRad(player.body.rotation);

        this.scene.physics.velocityFromRotation(angle, this.speed, this.body.velocity);

        this.body.velocity.x *= 2;
        this.body.velocity.y *= 2;

    }

    update (time, delta)
    {
        this.lifespan -= delta;

        if (this.lifespan <= 0)
        {
            this.setActive(false);
            this.setVisible(false);
            this.body.stop();
        }
    }

}

class Example extends Phaser.Scene
{

	player;

	players;

	asteroids;

	bullets;

	socket = io();

	destroyed = 0;
	destroyedText;

    lastFired = 0;
	fireCooldown = 100

    preload ()
    {
        this.load.image('background', 'assets/nebula.jpg');
        this.load.atlas('space', 'assets/space.png', 'assets/space.json');
    }
    create ()
    {
		this.loadGraphics();
		this.createMap();

		this.destroyedText = this.add.text(16, 16, 'Destroyed: ' + 0, {
			fontSize: '18px',
			padding: { x: 10, y: 5 },
			backgroundColor: '#000000',
			fill: '#ffffff'
		});

		this.destroyedText.setScrollFactor(0);
		this.destroyedText.setAlpha(0.5);

		this.bullets = this.physics.add.group({
            classType: Bullet,
            maxSize: 30,
            runChildUpdate: true
        });

		this.players = this.physics.add.group();

		this.asteroids = this.physics.add.group();

		this.cursors = this.input.keyboard.createCursorKeys();
		this.fire = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

		this.socket.on('loadPlayers', (players) => {
			for (const id in players) {
				if (id === this.socket.id) {
					console.log("loadPlayers id===this.socket.id");
					this.player = this.physics.add.image(players[id].x, players[id].y, 'space', 'ship').setDepth(2);
					this.player.setDrag(300);
					this.player.setAngularDrag(400);
					this.player.setMaxVelocity(600);
					this.player.setCollideWorldBounds(true, false);
					this.player.id = id;
					this.cameras.main.startFollow(this.player);
				} else {
					console.log("loadPlayers else");
					const otherPlayer = this.physics.add.image(players[id].x, players[id].y, 'space', 'ship').setDepth(2);
					otherPlayer.setRotation(players[id].rotation);
					otherPlayer.setCollideWorldBounds(true, false);
					otherPlayer.id = id;
					this.players.add(otherPlayer);
				}
			}
		});

		this.socket.on('loadAsteroids', (asteroids) => {
			for (const id in asteroids) {
				const newAsteroid = this.physics.add.sprite(asteroids[id].x, asteroids[id].y).play(asteroids[id].skin);
				newAsteroid.setSize(70, 70);
				newAsteroid.id = id;
				this.asteroids.add(newAsteroid);
			}
			this.physics.add.overlap(this.bullets, this.asteroids, this.destroyAsteroid, null, this);
		});

		this.socket.on('asteroidDestroyed', id => {
			this.asteroids.getChildren().forEach((a) => {
				if (a.id === id) {
					a.destroy();
				}
			});
		});

		this.socket.on('bulletFired', playerInfo => {
			this.players.getChildren().forEach(p => {
				console.log(playerInfo);
				if (playerInfo.id === p.id) {
					const bullet = this.bullets.get();		
					if (bullet) {
						bullet.fire(p);
					}
				}
			});
		});

		this.socket.on('newPlayer', (player) => {
			if (player.id !== this.socket.id) {
				console.log('newPlayer event');
				const newPlayer = this.physics.add.image(4000, 3000, 'space', 'ship').setDepth(2);
				newPlayer.id = player.id;
				this.players.add(newPlayer);
			}
		});

		this.socket.on('playerDisconnect', (id) => {
			this.players.getChildren().forEach(player => {
				if (player.id === id) {
					player.destroy();
				}
			});
		});

		this.socket.on('playerMoved', pl => {
			if (this.players) {
				this.players.getChildren().forEach((p) => {
					if (pl.id === p.id) {
					  p.setPosition(pl.x, pl.y);
					  p.setRotation(pl.rotation);
					}
				});
			}
		});

    }

    update (time, delta)
    {
		if (this.player) {
			if (this.cursors.left.isDown) {
					this.player.setAngularVelocity(-500);
				}
				else if (this.cursors.right.isDown) {
					this.player.setAngularVelocity(500);
				}
				else {
					this.player.setAngularVelocity(0);
				}
		
				if (this.cursors.up.isDown) {
					this.physics.velocityFromRotation(this.player.rotation, 2000, this.player.body.acceleration);
				}
				else {
					this.player.setAcceleration(0);
				}
		
				if (this.fire.isDown && time > this.lastFired + this.fireCooldown) {
				    const bullet = this.bullets.get();
		
				    if (bullet) {
				        bullet.fire(this.player, true);
				        this.lastFired = time;
						this.socket.emit('bulletFire', {id: this.player.id});
				    }
				}


				this.bg.tilePositionX += this.player.body.deltaX() * 0.5;
				this.bg.tilePositionY += this.player.body.deltaY() * 0.5;

				this.socket.emit('playerMove', { x: this.player.x, y: this.player.y, rotation: this.player.rotation });
		}
    }

	destroyAsteroid(bullet, asteroid) {
		this.destroyed += 1;
		this.destroyedText.setText('destroyed: ' + this.destroyed);

		asteroid.setTint(0xff0000);
        asteroid.destroy();
		bullet.destroy();

		this.socket.emit('asteroidDestroy',  asteroid.id);
	}

	loadGraphics() {
		this.textures.addSpriteSheetFromAtlas('mine-sheet', { atlas: 'space', frame: 'mine', frameWidth: 64 });
        this.textures.addSpriteSheetFromAtlas('asteroid1-sheet', { atlas: 'space', frame: 'asteroid1', frameWidth: 96 });
        this.textures.addSpriteSheetFromAtlas('asteroid2-sheet', { atlas: 'space', frame: 'asteroid2', frameWidth: 96 });
        this.textures.addSpriteSheetFromAtlas('asteroid3-sheet', { atlas: 'space', frame: 'asteroid3', frameWidth: 96 });
        this.textures.addSpriteSheetFromAtlas('asteroid4-sheet', { atlas: 'space', frame: 'asteroid4', frameWidth: 64 });

		this.anims.create({ key: 'mine-anim', frames: this.anims.generateFrameNumbers('mine-sheet', { start: 0, end: 15 }), frameRate: 20, repeat: -1 });
        this.anims.create({ key: 'asteroid1-anim', frames: this.anims.generateFrameNumbers('asteroid1-sheet', { start: 0, end: 24 }), frameRate: 20, repeat: -1 });
        this.anims.create({ key: 'asteroid2-anim', frames: this.anims.generateFrameNumbers('asteroid2-sheet', { start: 0, end: 24 }), frameRate: 20, repeat: -1 });
        this.anims.create({ key: 'asteroid3-anim', frames: this.anims.generateFrameNumbers('asteroid3-sheet', { start: 0, end: 24 }), frameRate: 20, repeat: -1 });
        this.anims.create({ key: 'asteroid4-anim', frames: this.anims.generateFrameNumbers('asteroid4-sheet', { start: 0, end: 23 }), frameRate: 20, repeat: -1 });
	}

	createMap() {
		this.physics.world.setBounds(3000, 2000, 2000, 2000);

        //  World size is 8000 x 6000
        // this.bg = this.add.tileSprite(400, 300, 800, 600, 'background').setScrollFactor(0);

		this.add.sprite(4000, 3000).play('asteroid1-anim');

		for (let i = 2900; i <= 5100; i += 100) {
			this.add.sprite(i, 1900).play('mine-anim');
		}

		for (let i = 2900; i <= 5100; i += 100) {
			this.add.sprite(i, 4100).play('mine-anim');
		}

		for (let i = 1900; i <= 4100; i += 100) {
			this.add.sprite(2900, i).play('mine-anim');
		}

		for (let i = 1900; i <= 4100; i += 100) {
			this.add.sprite(5100, i).play('mine-anim');
		}
	}

}

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'phaser-example',
    physics: {
        default: 'arcade',
        arcade: {
            debug: true
        }
    },
    scene: Example,
	scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};

const game = new Phaser.Game(config);

