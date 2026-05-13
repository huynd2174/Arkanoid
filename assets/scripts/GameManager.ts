import {
    _decorator,
    Component,
    Node,
    Prefab,
    instantiate,
    Vec3,
    UITransform,
    input,
    Input,
    EventTouch,
    Label,
    tween,
    Tween,
    Color,
    UIOpacity,
    Sprite,
    SpriteFrame,
    AudioSource,
    AudioClip,
    Animation,
    AnimationClip,
    sys,
} from 'cc';

import { PowerUpItem } from './PowerUpItem';
import { ObstacleItem } from './ObstacleItem';

const { ccclass, property } = _decorator;

enum PowerUpType {
    EXPAND = 'expand',
    MULTIBALL = 'multiball',
    FIREBALL = 'fireball',
    LASER = 'laser',
}

@ccclass('GameManager')
export class GameManager extends Component {
    @property(Node)
    gameArea: Node = null!;

    @property(Node)
    paddle: Node = null!;

    @property(SpriteFrame)
    normalPaddleFrame: SpriteFrame = null!;

    @property(AnimationClip)
    paddleBreakClip: AnimationClip = null!;

    @property(AnimationClip)
    paddleSpawnClip: AnimationClip = null!;

    @property(Node)
    ball: Node = null!;

    @property(Node)
    topWall: Node = null!;

    @property([Node])
    dropSpawnPoints: Node[] = [];

    @property(Prefab)
    brickPrefab: Prefab = null!;

    @property(Prefab)
    obstaclePrefab: Prefab = null!;

    @property(SpriteFrame)
    stoneFullFrame: SpriteFrame = null!;

    @property(SpriteFrame)
    stoneCrack1Frame: SpriteFrame = null!;

    @property(SpriteFrame)
    stoneCrack2Frame: SpriteFrame = null!;

    @property({ type: [SpriteFrame] })
    brickSpriteFrames: SpriteFrame[] = [];

    @property(Prefab)
    powerUpPrefab: Prefab = null!;

    @property(Prefab)
    laserPrefab: Prefab = null!;

    @property(AnimationClip)
    expandPowerUpClip: AnimationClip = null!;

    @property(AnimationClip)
    multiBallPowerUpClip: AnimationClip = null!;

    @property(AnimationClip)
    fireBallPowerUpClip: AnimationClip = null!;

    @property(AnimationClip)
    laserPowerUpClip: AnimationClip = null!;

    @property(AnimationClip)
    topGateLeftClip: AnimationClip = null!;

    @property(AnimationClip)
    topGateRightClip: AnimationClip = null!;

    @property(Label)
    scoreNumberLabel: Label = null!;

    @property(Label)
    bestScoreLabel: Label = null!;

    @property({ type: [Node] })
    heartIcons: Node[] = [];

    @property(Node)
    startButton: Node = null!;

    @property(Node)
    resultPanel: Node = null!;

    @property(Label)
    resultTitle: Label = null!;

    @property(Label)
    finalScoreLabel: Label = null!;

    @property(Node)
    retryButton: Node = null!;

    @property(AudioSource)
    audioSource: AudioSource = null!;

    @property(AudioClip)
    hitPaddleSound: AudioClip = null!;

    @property(AudioClip)
    hitBrickSound: AudioClip = null!;

    @property(AudioClip)
    ballLossSound: AudioClip = null!;

    @property(AudioClip)
    gameOverSound: AudioClip = null!;

    @property(AudioClip)
    winSound: AudioClip = null!;

    @property(AudioClip)
    buttonSound: AudioClip = null!;

    @property(AudioClip)
    powerUpReceivedSound: AudioClip = null!;

    @property(AudioClip)
    laserShotSound: AudioClip = null!;

    @property(AudioClip)
    obstacleDropSound: AudioClip = null!;

    private bricks: Node[] = [];
    private balls: Node[] = [];
    private ballVelocityMap: Map<Node, Vec3> = new Map();
    private brickHpMap: Map<Node, number> = new Map();
    private brickTypeMap: Map<Node, string> = new Map();
    private powerUps: Node[] = [];
    private lasers: Node[] = [];
    private obstacles: Node[] = [];

    private score: number = 0;
    private bestScore: number = 0;
    private lives: number = 3;
    private isPlaying: boolean = false;
    private isResettingLife: boolean = false;
    private isBallOnPaddle: boolean = true;
    private canLaunchBall: boolean = false;
    private canMovePaddle: boolean = false;

    private ballVelocity: Vec3 = new Vec3(260, 500, 0);
    private readonly ballRadius: number = 7.5;
    private readonly ballScaleDefault: number = 0.6;
    private readonly paddleScaleDefault: number = 1;

    private paddleTargetX: number = 0;
    private readonly paddleSmoothSpeed: number = 18;

    private readonly powerUpFallSpeed: number = 220;
    private readonly normalPaddleWidth: number = 100;
    private readonly extendedPaddleWidth: number = 150;
    private isPaddleExtended: boolean = false;
    private normalPaddleContentWidth: number = 0;
    private normalPaddleContentHeight: number = 0;
    private isPaddleBreaking: boolean = false;
    private paddleBuffToken: number = 0;
    private activePowerUpType: string | null = null;
    private isFireBallActive: boolean = false;
    private readonly fireBallDuration: number = 5;
    private fireBallToken: number = 0;
    private isLaserActive: boolean = false;
    private laserShootTimer: number = 0;
    private laserToken: number = 0;
    private readonly laserSpeed: number = 560;
    private readonly laserFireInterval: number = 0.65;
    private readonly laserDuration: number = 7;
    private obstacleSpawnTimer: number = 0;
    private nextObstacleSpawnTime: number = 10;
    private isGateDropping: boolean = false;
    private readonly obstacleSpawnIntervalMin: number = 9;
    private readonly obstacleSpawnIntervalMax: number = 14;

    private trailTimer: number = 0;
    private readonly trailInterval: number = 0.035;

    private gameAreaOriginPos: Vec3 = new Vec3(0, -40, 0);

    /** Tránh deltaTime quá lớn khi drop frame — giảm giật vật lý. */
    private readonly maxDeltaTime: number = 0.05;
    /** Quãng đường tối đa bóng đi mỗi sub-step (px) — giảm xuyên gạch/tường. */
    private readonly ballSubstepDistance: number = 14;
    private readonly maxBallSubsteps: number = 18;
    /** Số brick tối đa xử lý trong 1 sub-step để tránh vòng lặp nặng. */
    private readonly maxBrickHitsPerSubstep: number = 5;
    /** Tốc độ mục tiêu để game không bị nhanh quá lâu. */
    private readonly cruiseBallSpeed: number = 560;
    private readonly maxBallSpeed: number = 660;
    private readonly minBallVerticalSpeed: number = 110;
    /** Tốc độ giảm dần về cruise mỗi giây khi bóng đang quá nhanh. */
    private readonly speedRelaxPerSecond: number = 0.22;
    private readonly bestScoreStorageKey: string = 'arkanoid_best_score';

    onLoad() {
        this.gameAreaOriginPos = this.gameArea.position.clone();
        this.resolveObstacleGateRefs();
        this.loadBestScore();
        this.captureNormalPaddleVisual();

        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);

        if (this.startButton) {
            this.bindButtonEffects(this.startButton);
            this.startButton.on(Node.EventType.TOUCH_END, this.startGame, this);
        }

        if (this.retryButton) {
            this.bindButtonEffects(this.retryButton);
            this.retryButton.on(Node.EventType.TOUCH_END, this.startGame, this);
        }

        this.resetGame();
    }

    onDestroy() {
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);

        if (this.startButton) {
            this.unbindButtonEffects(this.startButton);
            this.startButton.off(Node.EventType.TOUCH_END, this.startGame, this);
        }

        if (this.retryButton) {
            this.unbindButtonEffects(this.retryButton);
            this.retryButton.off(Node.EventType.TOUCH_END, this.startGame, this);
        }
    }

    startGame() {
        this.playSound(this.buttonSound, 0.8);

        this.resetGame();
        this.forceCenterPaddleAndBall();

        this.isPlaying = true;
        this.isResettingLife = false;
        this.isBallOnPaddle = true;
        this.canLaunchBall = false;
        this.canMovePaddle = false;
        this.startButton.active = false;

        if (this.resultPanel) {
            Tween.stopAllByTarget(this.resultPanel);
            this.resultPanel.active = false;
        }

        this.ballVelocity.set(260, 500, 0);
        this.ballVelocityMap.clear();
        this.ballVelocityMap.set(this.ball, this.ballVelocity.clone());
        this.attachBallToPaddle();

        // Chặn TOUCH_END của nút START/RETRY vừa bấm.
        this.playPaddleSpawnAnimation(() => {
            this.canLaunchBall = true;
            this.canMovePaddle = true;
        });
    }

    resetGame() {
        this.isPlaying = false;
        this.score = 0;
        this.lives = 3;
        this.isResettingLife = false;
        this.isBallOnPaddle = true;
        this.canLaunchBall = false;
        this.canMovePaddle = false;
        this.updateScore();
        this.updateLives();

        this.clearBricks();
        this.clearPowerUps();
        this.clearObstacles();
        this.isGateDropping = false;
        this.obstacleSpawnTimer = 0;
        this.resetNextObstacleSpawnTime();
        this.createBricks();

        this.paddleTargetX = 0;
        this.trailTimer = 0;

        Tween.stopAllByTarget(this.gameArea);
        this.gameArea.setPosition(this.gameAreaOriginPos);

        Tween.stopAllByTarget(this.paddle);
        Tween.stopAllByTarget(this.ball);
        this.paddle.setScale(this.paddleScaleDefault, this.paddleScaleDefault, 1);
        this.ball.setScale(this.ballScaleDefault, this.ballScaleDefault, 1);

        this.clearPaddleBuff();
        this.resetPaddleVisual();

        this.clearExtraBalls();
        this.paddle.setPosition(0, -340, 0);
        this.ball.active = true;
        this.ball.setScale(this.ballScaleDefault, this.ballScaleDefault, 1);
        this.ball.setPosition(0, -280, 0);
        this.ballVelocity.set(260, 500, 0);
        this.balls = [this.ball];
        this.ballVelocityMap.clear();
        this.ballVelocityMap.set(this.ball, this.ballVelocity.clone());
        this.deactivateFireBall();
        this.deactivateLaser();
        this.clearLasers();
        this.attachBallToPaddle();
        this.startButton.active = true;

        if (this.resultPanel) {
            Tween.stopAllByTarget(this.resultPanel);
            this.resultPanel.active = false;
        }
    }

    update(deltaTime: number) {
        const dt = this.clampDeltaTime(deltaTime);

        this.updatePaddleSmooth(dt);

        // Cho bóng bám paddle cả khi chưa START hoặc đang chờ launch lại.
        if (this.isBallOnPaddle) {
            this.attachBallToPaddle();
        }

        if (!this.isPlaying) return;

        if (this.isBallOnPaddle) {
            return;
        }

        this.updateBalls(dt);
        this.updateBallTrail(dt);
        this.updatePowerUps(dt);
        this.updateLaserSystem(dt);
        this.updateObstacleSystem(dt);
        this.checkWin();
    }

    private clampDeltaTime(deltaTime: number): number {
        if (deltaTime <= 0) return 0;
        return Math.min(deltaTime, this.maxDeltaTime);
    }

    /** Nhiều bước nhỏ trong một frame: mượt hơn, ít “lọt” qua gạch khi bóng nhanh. */
    private simulateBallPhysics(
        dt: number,
        ball: Node = this.ball,
        velocity: Vec3 = this.ballVelocity,
        loseLifeOnLost: boolean = true
    ): boolean {
        const vx = velocity.x;
        const vy = velocity.y;
        const speed = Math.sqrt(vx * vx + vy * vy);
        const travel = speed * dt;
        let steps = Math.ceil(travel / this.ballSubstepDistance);
        steps = Math.max(1, Math.min(this.maxBallSubsteps, steps));
        const h = dt / steps;

        for (let s = 0; s < steps; s++) {
            const previousBallPos = ball.position.clone();

            this.moveBall(h, ball, velocity);
            this.checkWallCollision(ball, velocity);
            this.checkPaddleCollision(ball, velocity);

            for (let hits = 0; hits < this.maxBrickHitsPerSubstep; hits++) {
                if (!this.checkBrickCollision(ball, velocity, previousBallPos)) break;
            }

            if (this.checkLose(ball, loseLifeOnLost)) {
                return false;
            }
        }

        return true;
    }

    private onTouchMove(event: EventTouch) {
        if (this.isPaddleBreaking) return;
        if (!this.isPlaying || this.isResettingLife || !this.canMovePaddle) return;

        const delta = event.getUIDelta();

        const areaUI = this.gameArea.getComponent(UITransform)!;
        const paddleUI = this.paddle.getComponent(UITransform)!;

        const halfAreaWidth = areaUI.width / 2;
        const halfPaddleWidth = paddleUI.width / 2;

        let nextX = this.paddleTargetX + delta.x;

        nextX = this.clamp(
            nextX,
            -halfAreaWidth + halfPaddleWidth,
            halfAreaWidth - halfPaddleWidth
        );

        this.paddleTargetX = nextX;

        if (this.isBallOnPaddle) {
            this.attachBallToPaddle();
        }
    }

    private onTouchEnd() {
        this.tryLaunchBall();
    }

    private tryLaunchBall() {
        if (this.isPaddleBreaking) return;
        if (!this.isPlaying || this.isResettingLife || !this.isBallOnPaddle) return;
        if (!this.canLaunchBall) return;

        this.isBallOnPaddle = false;
        this.canLaunchBall = false;
        this.ballVelocity.set(260, 500, 0);
        this.ballVelocityMap.clear();
        this.ballVelocityMap.set(this.ball, this.ballVelocity.clone());
    }

    private updatePaddleSmooth(deltaTime: number) {
        const currentPos = this.paddle.position;

        const t = Math.min(1, deltaTime * this.paddleSmoothSpeed);
        const newX = currentPos.x + (this.paddleTargetX - currentPos.x) * t;

        this.paddle.setPosition(newX, currentPos.y, 0);
    }

    private moveBall(deltaTime: number, ball: Node = this.ball, velocity: Vec3 = this.ballVelocity) {
        const pos = ball.position.clone();

        pos.x += velocity.x * deltaTime;
        pos.y += velocity.y * deltaTime;

        ball.setPosition(pos);
    }

    private checkWallCollision(ball: Node = this.ball, velocity: Vec3 = this.ballVelocity) {
        const areaUI = this.gameArea.getComponent(UITransform)!;

        const halfWidth = areaUI.width / 2;
        const halfHeight = areaUI.height / 2;

        const pos = ball.position.clone();

        const left = -halfWidth + this.ballRadius;
        const right = halfWidth - this.ballRadius;
        const top = halfHeight - this.ballRadius;
        let wallHit = false;

        if (pos.x < left) {
            if (velocity.x < 0) {
                pos.x = left + (left - pos.x);
                velocity.x = Math.abs(velocity.x);
                wallHit = true;
            } else {
                pos.x = left;
            }
        }

        if (pos.x > right) {
            if (velocity.x > 0) {
                pos.x = right - (pos.x - right);
                velocity.x = -Math.abs(velocity.x);
                wallHit = true;
            } else {
                pos.x = right;
            }
        }

        if (pos.y > top) {
            if (velocity.y > 0) {
                pos.y = top - (pos.y - top);
                velocity.y = -Math.abs(velocity.y);
                wallHit = true;
            } else {
                pos.y = top;
            }
        }

        pos.x = this.clamp(pos.x, left, right);
        pos.y = Math.min(pos.y, top);

        if (wallHit && Math.abs(velocity.x) < 45 && Math.abs(velocity.y) > 0) {
            velocity.x = velocity.x < 0 ? -45 : 45;
            this.normalizeBallSpeed(velocity);
        }

        if (wallHit) {
            this.ensureBallHasVerticalMotion(velocity, velocity.y);
        }

        ball.setPosition(pos);
    }

    private normalizeBallSpeed(velocity: Vec3) {
        const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

        if (speed <= 0) return;

        const targetSpeed = this.clamp(speed, 260, this.maxBallSpeed);

        velocity.x = velocity.x / speed * targetSpeed;
        velocity.y = velocity.y / speed * targetSpeed;
    }

    private ensureBallHasVerticalMotion(velocity: Vec3, preferredYDirection: number = 0) {
        const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

        if (speed <= 0) return;

        const minVertical = Math.min(this.minBallVerticalSpeed, speed * 0.45);

        if (Math.abs(velocity.y) >= minVertical) return;

        const ySign = velocity.y !== 0
            ? Math.sign(velocity.y)
            : (preferredYDirection !== 0 ? Math.sign(preferredYDirection) : -1);
        const xSign = velocity.x !== 0 ? Math.sign(velocity.x) : 1;
        const nextX = Math.sqrt(Math.max(speed * speed - minVertical * minVertical, 0));

        velocity.x = xSign * nextX;
        velocity.y = ySign * minVertical;
    }

    private checkPaddleCollision(ball: Node = this.ball, velocity: Vec3 = this.ballVelocity) {
        if (velocity.y > 0) return;

        if (!this.isRectHit(ball, this.paddle)) return;

        const ballPos = ball.position;
        const paddlePos = this.paddle.position;
        const paddleUI = this.paddle.getComponent(UITransform)!;

        // Bỏ qua va chạm nếu bóng đang nằm quá sâu bên dưới paddle (chạm cạnh bên/dưới)
        // để tránh lỗi "dịch chuyển tức thời" bóng lên trên đỉnh paddle.
        if (ballPos.y < paddlePos.y - 2) {
            velocity.x *= -1; // Chỉ bật ngang
            this.normalizeBallSpeed(velocity);
            this.ensureBallHasVerticalMotion(velocity, velocity.y);
            return;
        }

        const offsetRaw = (ballPos.x - paddlePos.x) / ((paddleUI.width * this.paddle.scale.x) / 2);
        const offset = this.clamp(offsetRaw, -1, 1);

        const speed = Math.sqrt(
            velocity.x * velocity.x +
            velocity.y * velocity.y
        );

        const maxAngle = 60 * Math.PI / 180;
        const angle = offset * maxAngle;

        const boostedSpeed = Math.min(speed * 1.008, this.maxBallSpeed);

        velocity.x = Math.sin(angle) * boostedSpeed;
        velocity.y = Math.abs(Math.cos(angle) * boostedSpeed);

        // Tránh bóng đi gần như thẳng đứng quá lâu (dễ nhàm/chậm nhịp game).
        const minHorizontal = boostedSpeed * 0.18;
        if (Math.abs(velocity.x) < minHorizontal) {
            const sx = offset === 0
                ? (velocity.x !== 0 ? Math.sign(velocity.x) : (ball.position.x >= paddlePos.x ? 1 : -1))
                : Math.sign(offset);
            velocity.x = sx * minHorizontal;
            const vy2 = boostedSpeed * boostedSpeed - velocity.x * velocity.x;
            velocity.y = Math.sqrt(Math.max(vy2, 0));
        }

        const newY = paddlePos.y + (paddleUI.height * this.paddle.scale.y) / 2 + this.ballRadius;
        ball.setPosition(ballPos.x, newY, 0);

        this.playPaddleHitEffect();
        this.playBallHitEffect(ball);
        this.playSound(this.hitPaddleSound, 0.9);
    }

    /**
     * Va chạm brick ổn định:
     * - Chỉ lấy va chạm gần nhất (lún sâu nhất) để xử lý trước.
     * - Multi-hit được xử lý qua vòng lặp substep bên ngoài.
     * - Chặn double-reflection và nảy góc dị chuẩn Arkanoid.
     */
    private checkBrickCollision(
        ball: Node = this.ball,
        velocity: Vec3 = this.ballVelocity,
        previousBallPosition?: Vec3
    ): boolean {
        const r = this.ballRadius;
        const pos = ball.position.clone();
        let nearestIndex = -1;
        let bestScore = Number.POSITIVE_INFINITY;
        let nearestBrick: Node | null = null;
        let nx = 0;
        let ny = 1;
        let penetrationDepth = 0;

        for (let i = this.bricks.length - 1; i >= 0; i--) {
            const brick = this.bricks[i];
            if (!brick || !brick.isValid) continue;
            const bUI = brick.getComponent(UITransform)!;
            const cx = brick.position.x;
            const cy = brick.position.y;
            const halfW = bUI.width * 0.5;
            const halfH = bUI.height * 0.5;
            const closestX = this.clamp(pos.x, cx - halfW, cx + halfW);
            const closestY = this.clamp(pos.y, cy - halfH, cy + halfH);
            const dx = pos.x - closestX;
            const dy = pos.y - closestY;
            const distSq = dx * dx + dy * dy;

            if (distSq > r * r) continue;

            const collision = this.resolveBrickCollision(
                pos,
                previousBallPosition ?? pos,
                velocity,
                cx,
                cy,
                halfW,
                halfH,
                r,
                distSq,
                dx,
                dy
            );
            const approach = Math.max(0, -(velocity.x * collision.nx + velocity.y * collision.ny));
            const contactScore = collision.penetration - approach * 0.001;

            if (contactScore < bestScore) {
                bestScore = contactScore;
                nearestIndex = i;
                nearestBrick = brick;
                nx = collision.nx;
                ny = collision.ny;
                penetrationDepth = collision.penetration;
            }
        }
        if (nearestIndex === -1 || !nearestBrick) return false;

        if (this.isFireBallActive) {
            this.hitBrick(nearestBrick, nearestIndex, ball, true);

            velocity.x *= 1.002;
            velocity.y *= 1.002;

            return true;
        }

        pos.x += nx * (penetrationDepth + 0.5);
        pos.y += ny * (penetrationDepth + 0.5);
        const vx = velocity.x;
        const vy = velocity.y;
        const dot = vx * nx + vy * ny;
        // CHỈ đổi hướng khi bóng đang bay VÀO viên gạch (dot < 0)
        if (dot < 0) {
            velocity.x = vx - 2 * dot * nx;
            velocity.y = vy - 2 * dot * ny;
        }

        ball.setPosition(pos);
        this.hitBrick(nearestBrick, nearestIndex, ball);

        const speed = Math.sqrt(
            velocity.x * velocity.x +
            velocity.y * velocity.y
        );
        const boosted = Math.min(speed * 1.0015, this.maxBallSpeed);
        if (speed > 0) {
            const scale = boosted / speed;
            velocity.x *= scale;
            velocity.y *= scale;
        }
        this.ensureBallHasVerticalMotion(velocity, velocity.y);
        return true;
    }

    private resolveBrickCollision(
        currentPos: Vec3,
        previousPos: Vec3,
        velocity: Vec3,
        brickX: number,
        brickY: number,
        halfW: number,
        halfH: number,
        ballRadius: number,
        distSq: number,
        closestDx: number,
        closestDy: number
    ): { nx: number; ny: number; penetration: number } {
        const prevBottom = previousPos.y - ballRadius;
        const prevTop = previousPos.y + ballRadius;
        const prevLeft = previousPos.x - ballRadius;
        const prevRight = previousPos.x + ballRadius;
        const brickLeft = brickX - halfW;
        const brickRight = brickX + halfW;
        const brickBottom = brickY - halfH;
        const brickTop = brickY + halfH;

        if (velocity.y < 0 && prevBottom >= brickTop) {
            return { nx: 0, ny: 1, penetration: Math.max(brickTop - (currentPos.y - ballRadius), 0) };
        }

        if (velocity.y > 0 && prevTop <= brickBottom) {
            return { nx: 0, ny: -1, penetration: Math.max((currentPos.y + ballRadius) - brickBottom, 0) };
        }

        if (velocity.x > 0 && prevRight <= brickLeft) {
            return { nx: -1, ny: 0, penetration: Math.max((currentPos.x + ballRadius) - brickLeft, 0) };
        }

        if (velocity.x < 0 && prevLeft >= brickRight) {
            return { nx: 1, ny: 0, penetration: Math.max(brickRight - (currentPos.x - ballRadius), 0) };
        }

        if (distSq > 1e-8) {
            const dist = Math.sqrt(distSq);

            return {
                nx: closestDx / dist,
                ny: closestDy / dist,
                penetration: Math.max(ballRadius - dist, 0),
            };
        }

        const dx = currentPos.x - brickX;
        const dy = currentPos.y - brickY;
        const penX = (halfW + ballRadius) - Math.abs(dx);
        const penY = (halfH + ballRadius) - Math.abs(dy);

        if (penX < penY) {
            return {
                nx: dx !== 0 ? Math.sign(dx) : (velocity.x >= 0 ? -1 : 1),
                ny: 0,
                penetration: penX,
            };
        }

        return {
            nx: 0,
            ny: dy !== 0 ? Math.sign(dy) : (velocity.y >= 0 ? -1 : 1),
            penetration: penY,
        };
    }

    private relaxBallSpeed(deltaTime: number, velocity: Vec3 = this.ballVelocity) {
        const vx = velocity.x;
        const vy = velocity.y;
        const speed = Math.sqrt(vx * vx + vy * vy);
        if (speed <= 0) return;

        if (speed <= this.cruiseBallSpeed) {
            this.ensureBallHasVerticalMotion(velocity, velocity.y);
            return;
        }

        const t = Math.min(1, this.speedRelaxPerSecond * deltaTime);
        const targetSpeed = speed + (this.cruiseBallSpeed - speed) * t;
        const scale = targetSpeed / speed;
        velocity.x *= scale;
        velocity.y *= scale;
        this.ensureBallHasVerticalMotion(velocity, velocity.y);
    }

    /** Bóng rơi khỏi đáy vùng chơi: mất mạng hoặc GAME OVER khi hết lives. */
    private checkLose(ball: Node = this.ball, loseLifeOnLost: boolean = true): boolean {
        if (this.isResettingLife) {
            return true;
        }

        const areaUI = this.gameArea.getComponent(UITransform)!;
        const halfH = areaUI.height * 0.5;
        const gameBottomY = -halfH;
        const ballBottom = ball.position.y - this.ballRadius;

        if (ballBottom < gameBottomY) {
            if (loseLifeOnLost) {
                this.loseLifeWithPaddleBreak();
            }
            return true;
        }

        return false;
    }

    private loseLifeWithPaddleBreak() {
        if (this.isResettingLife || this.isPaddleBreaking) return;

        this.isResettingLife = true;
        this.isGateDropping = false;

        this.playPaddleBreakAnimation(() => {
            this.loseLife();
        });
    }

    private loseLife() {
        this.isResettingLife = true;

        const lostHeartIndex = this.lives - 1;

        this.lives -= 1;

        if (lostHeartIndex >= 0) {
            this.playLoseHeartEffect(lostHeartIndex);
        }

        this.playScreenShake(12, 0.18);
        this.playSound(this.ballLossSound, 1);
        this.deactivateFireBall();
        this.deactivateLaser();
        this.clearLasers();
        this.isGateDropping = false;

        if (this.lives <= 0) {
            this.isPlaying = false;
            this.startButton.active = false;
            this.canLaunchBall = false;
            this.fadeOutAndClearPowerUps(0.35);
            this.clearObstacles();
            this.clearPaddleBuff();
            this.fadeOutNode(this.ball, 0.35);

            tween(this.node)
                .delay(0.38)
                .call(() => {
                    this.showResultPanel('GAME OVER');
                    this.playSound(this.gameOverSound, 1);
                })
                .start();

            return;
        }

        this.isPlaying = false;
        this.startButton.active = false;
        this.isBallOnPaddle = true;
        this.canLaunchBall = false;
        this.fadeOutAndClearPowerUps(0.35);
        this.clearPaddleBuff();

        this.resetBallAndPaddleAfterLifeLost();
    }

    private resetBallAndPaddleAfterLifeLost() {
        this.preparePaddleForSpawn();
        this.paddleTargetX = 0;
        this.ballVelocity.set(260, 500, 0);
        this.clearExtraBalls();
        this.isGateDropping = false;
        this.obstacleSpawnTimer = 0;
        this.resetNextObstacleSpawnTime();
        this.balls = [this.ball];
        this.ballVelocityMap.clear();
        this.ballVelocityMap.set(this.ball, this.ballVelocity.clone());
        this.deactivateFireBall();
        this.deactivateLaser();
        this.clearLasers();

        Tween.stopAllByTarget(this.paddle);
        let ballOpacity = this.ball.getComponent(UIOpacity);
        if (!ballOpacity) {
            ballOpacity = this.ball.addComponent(UIOpacity);
        }
        Tween.stopAllByTarget(ballOpacity);
        ballOpacity.opacity = 255;
        this.ball.active = true;

        tween(ballOpacity)
            .to(0.35, { opacity: 0 })
            .call(() => {
                if (!this.ball || !this.ball.isValid) return;
                this.ball.active = false;
                ballOpacity!.opacity = 255;
                this.startPaddleRespawn();
            })
            .start();

    }

    private startPaddleRespawn() {
        this.paddle.setPosition(0, -340, 0);
        this.paddleTargetX = 0;
        this.ball.active = true;
        this.ball.setScale(this.ballScaleDefault, this.ballScaleDefault, 1);
        this.attachBallToPaddle();
        this.playPaddleSpawnAnimation(() => {
            this.finishLifeReset();
        });
    }

    private finishLifeReset() {
        if (this.lives <= 0) return;

        this.updateLives();
        this.isResettingLife = false;
        this.isPlaying = true;
        this.isBallOnPaddle = true;
        this.canLaunchBall = true;
        this.canMovePaddle = true;
    }

    private checkWin() {
        if (this.bricks.length <= 0) {
            this.isPlaying = false;
            this.startButton.active = false;
            this.clearExtraBalls();
            this.ball.active = false;
            this.clearPowerUps();
            this.deactivateLaser();
            this.clearLasers();
            this.clearObstacles();
            this.isGateDropping = false;

            this.showResultPanel('YOU WIN!');
            this.playSound(this.winSound, 1);
        }
    }

    private createBricks() {
        // Layout kiểu Arkanoid mẫu: 3 cụm gạch, màu cố định theo từng hàng.
        // Thứ tự màu lấy từ mảng brickSpriteFrames (Inspector):
        // 0=blue, 1=green, 2=red, 3=yellow, 4=purple, 5=grey
        const rows = 8;
        const groups = 3;
        const colsPerGroup = 4;

        const brickW = 36;
        const brickH = 20;

        const gapX = 2;
        const gapY = 2;
        const groupGap = 40;

        const groupWidth = colsPerGroup * brickW + (colsPerGroup - 1) * gapX;
        const totalWidth = groups * groupWidth + (groups - 1) * groupGap;

        const startX = -totalWidth / 2 + brickW / 2;
        const startY = 360;

        // Màu theo từng hàng (cố định, không random)
        const rowColorIndices = [3, 2, 4, 0, 1, 0, 5, 3];

        for (let row = 0; row < rows; row++) {
            for (let group = 0; group < groups; group++) {
                for (let col = 0; col < colsPerGroup; col++) {
                    const brick = instantiate(this.brickPrefab);
                    const brickSprite = brick.getComponent(Sprite);
                    const brickUI = brick.getComponent(UITransform);

                    // Ép kích thước khi spawn để tránh lệch layout do prefab gốc quá to.
                    if (brickUI) {
                        brickUI.setContentSize(brickW, brickH);
                    }

                    if (brickSprite && this.brickSpriteFrames.length > 0) {
                        const colorIndex = rowColorIndices[row % rowColorIndices.length];
                        const frame = this.brickSpriteFrames[colorIndex] ?? this.brickSpriteFrames[0];
                        if (frame) {
                            brickSprite.spriteFrame = frame;
                        }
                    }

                    brick.setParent(this.gameArea);

                    const groupOffset = group * (groupWidth + groupGap);
                    const x = startX + groupOffset + col * (brickW + gapX);
                    const y = startY - row * (brickH + gapY);

                    brick.setPosition(x, y, 0);

                    // Hàng đầu tiên và một vài viên ngẫu nhiên sẽ là gạch đá
                    const isStoneBrick = row === 0 || ((row === 2 || row === 4) && (col === 1 || col === 2));

                    if (isStoneBrick) {
                        this.setupStoneBrick(brick);
                    } else {
                        this.setupNormalBrick(brick);
                    }

                    this.bricks.push(brick);
                }
            }
        }
    }

    private clearBricks() {
        for (const brick of this.bricks) {
            if (brick && brick.isValid) {
                brick.destroy();
            }
        }

        this.bricks = [];
        this.brickHpMap.clear();
        this.brickTypeMap.clear();
    }

    private updateScore() {
        if (this.scoreNumberLabel) {
            this.scoreNumberLabel.string = `${this.score}`;
        }

        if (this.bestScoreLabel) {
            this.bestScoreLabel.string = `${this.bestScore}`;
        }
    }

    private loadBestScore() {
        const raw = sys.localStorage.getItem(this.bestScoreStorageKey);
        const parsed = raw ? Number(raw) : 0;
        this.bestScore = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    }

    private saveBestScore() {
        sys.localStorage.setItem(this.bestScoreStorageKey, String(this.bestScore));
    }

    private addScore(points: number) {
        this.score += points;

        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            this.saveBestScore();
        }

        this.updateScore();
        this.playScoreHudEffect();
    }

    private playScoreHudEffect() {
        const target = this.scoreNumberLabel?.node;
        const scoreText = this.scoreNumberLabel;

        if (!target) return;

        Tween.stopAllByTarget(target);
        target.setScale(1, 1, 1);

        tween(target)
            .to(0.06, { scale: new Vec3(1.16, 1.16, 1) })
            .to(0.10, { scale: new Vec3(1, 1, 1) })
            .start();

        if (!scoreText) return;

        const originColor = scoreText.color.clone();
        Tween.stopAllByTarget(scoreText);
        scoreText.color = new Color(255, 244, 150, 255);

        tween(scoreText)
            .delay(0.10)
            .call(() => {
                scoreText.color = originColor;
            })
            .start();
    }

    private updateLives() {
        for (let i = 0; i < this.heartIcons.length; i++) {
            const heart = this.heartIcons[i];

            if (!heart) continue;

            heart.active = i < this.lives;
            heart.setScale(1, 1, 1);
        }
    }

    private isRectHit(a: Node, b: Node): boolean {
        const aUI = a.getComponent(UITransform)!;
        const bUI = b.getComponent(UITransform)!;

        const aPos = a.position;
        const bPos = b.position;

        const aHalfW = (aUI.width * a.scale.x) / 2;
        const aHalfH = (aUI.height * a.scale.y) / 2;

        const bHalfW = (bUI.width * b.scale.x) / 2;
        const bHalfH = (bUI.height * b.scale.y) / 2;

        const hitX = Math.abs(aPos.x - bPos.x) <= aHalfW + bHalfW;
        const hitY = Math.abs(aPos.y - bPos.y) <= aHalfH + bHalfH;

        return hitX && hitY;
    }

    private playLoseHeartEffect(heartIndex: number) {
        const heart = this.heartIcons[heartIndex];

        if (!heart || !heart.isValid) return;

        heart.active = true;
        heart.setScale(1, 1, 1);

        tween(heart)
            .to(0.08, { scale: new Vec3(1.35, 1.35, 1) })
            .to(0.08, { scale: new Vec3(0.75, 0.75, 1) })
            .to(0.10, { scale: new Vec3(0, 0, 1) })
            .call(() => {
                if (heart && heart.isValid) {
                    heart.active = false;
                    heart.setScale(1, 1, 1);
                }
            })
            .start();
    }

    private bindButtonEffects(button: Node) {
        this.startButtonGlow(button);
        button.on(Node.EventType.TOUCH_START, this.onButtonTouchStart, this);
        button.on(Node.EventType.TOUCH_END, this.onButtonTouchEnd, this);
        button.on(Node.EventType.TOUCH_CANCEL, this.onButtonTouchEnd, this);
    }

    private unbindButtonEffects(button: Node) {
        this.stopButtonGlow(button);
        button.off(Node.EventType.TOUCH_START, this.onButtonTouchStart, this);
        button.off(Node.EventType.TOUCH_END, this.onButtonTouchEnd, this);
        button.off(Node.EventType.TOUCH_CANCEL, this.onButtonTouchEnd, this);
    }

    private onButtonTouchStart(event: EventTouch) {
        const button = event.currentTarget as Node;
        if (!button || !button.isValid) return;

        Tween.stopAllByTarget(button);
        button.setScale(1, 1, 1);

        tween(button)
            .to(0.06, { scale: new Vec3(0.92, 0.92, 1) })
            .start();
    }

    private onButtonTouchEnd(event: EventTouch) {
        const button = event.currentTarget as Node;
        if (!button || !button.isValid) return;

        this.playButtonReleaseEffect(button);
    }

    private playButtonReleaseEffect(button: Node) {
        Tween.stopAllByTarget(button);

        tween(button)
            .to(0.08, { scale: new Vec3(1.08, 1.08, 1) })
            .to(0.10, { scale: new Vec3(1, 1, 1) })
            .start();
    }

    private startButtonGlow(button: Node) {
        const buttonSprite = button.getComponent(Sprite);

        if (!buttonSprite) return;

        Tween.stopAllByTarget(buttonSprite);

        const baseColor = new Color(40, 150, 255, 255);
        const glowColor = new Color(110, 235, 255, 255);

        buttonSprite.color = baseColor;

        tween(buttonSprite)
            .repeatForever(
                tween(buttonSprite)
                    .to(0.75, { color: glowColor })
                    .to(0.75, { color: baseColor })
            )
            .start();
    }

    private stopButtonGlow(button: Node) {
        const buttonSprite = button.getComponent(Sprite);

        if (!buttonSprite) return;

        Tween.stopAllByTarget(buttonSprite);
        buttonSprite.color = new Color(40, 150, 255, 255);
    }

    private captureNormalPaddleVisual() {
        const paddleUI = this.paddle.getComponent(UITransform);

        if (paddleUI) {
            this.normalPaddleContentWidth = paddleUI.width;
            this.normalPaddleContentHeight = paddleUI.height;
        }

        if (!this.normalPaddleFrame) {
            const sprite = this.paddle.getComponent(Sprite);

            if (sprite && sprite.spriteFrame) {
                this.normalPaddleFrame = sprite.spriteFrame;
            }
        }
    }

    private playPaddleBreakAnimation(onComplete?: () => void) {
        if (this.isPaddleBreaking) return;

        this.isPaddleBreaking = true;
        this.isPlaying = false;
        this.canMovePaddle = false;
        this.canLaunchBall = false;

        Tween.stopAllByTarget(this.paddle);

        const anim = this.paddle.getComponent(Animation);
        const opacity = this.paddle.getComponent(UIOpacity) ?? this.paddle.addComponent(UIOpacity);

        opacity.opacity = 255;
        this.setPaddleLightsActive(false);

        if (!anim) {
            this.isPaddleBreaking = false;

            if (onComplete) {
                onComplete();
            }

            return;
        }

        anim.stop();

        const finish = () => {
            this.isPaddleBreaking = false;

            if (onComplete) {
                onComplete();
            }
        };

        const finishAfterFade = () => {
            Tween.stopAllByTarget(opacity);

            tween(opacity)
                .to(0.1, { opacity: 0 })
                .call(finish)
                .start();
        };

        if (!anim.getState('paddle_break')) {
            if (this.paddleBreakClip) {
                anim.createState(this.paddleBreakClip, 'paddle_break');
            } else {
                finish();
                return;
            }
        }

        anim.once(Animation.EventType.FINISHED, finishAfterFade, this);
        anim.play('paddle_break');
    }

    private playPaddleSpawnAnimation(onComplete?: () => void) {
        this.preparePaddleForSpawn();

        const anim = this.paddle.getComponent(Animation);
        const opacity = this.paddle.getComponent(UIOpacity) ?? this.paddle.addComponent(UIOpacity);

        if (!anim) {
            this.resetPaddleVisual();

            if (onComplete) {
                onComplete();
            }

            return;
        }

        anim.stop();

        const finish = () => {
            this.resetPaddleVisual();

            if (onComplete) {
                onComplete();
            }
        };

        if (!anim.getState('paddle_spawn')) {
            if (this.paddleSpawnClip) {
                anim.createState(this.paddleSpawnClip, 'paddle_spawn');
            } else {
                finish();
                return;
            }
        }

        anim.once(Animation.EventType.FINISHED, finish, this);
        anim.play('paddle_spawn');

        tween(opacity)
            .to(0.08, { opacity: 255 })
            .start();
    }

    private preparePaddleForSpawn() {
        Tween.stopAllByTarget(this.paddle);

        const anim = this.paddle.getComponent(Animation);
        const sprite = this.paddle.getComponent(Sprite);
        const opacity = this.paddle.getComponent(UIOpacity) ?? this.paddle.addComponent(UIOpacity);
        const ui = this.paddle.getComponent(UITransform);

        if (anim) {
            anim.stop();
        }

        if (sprite) {
            sprite.spriteFrame = null;
        }

        if (ui && this.normalPaddleContentWidth > 0 && this.normalPaddleContentHeight > 0) {
            ui.setContentSize(this.normalPaddleContentWidth, this.normalPaddleContentHeight);
        }

        Tween.stopAllByTarget(opacity);
        opacity.opacity = 0;

        this.paddle.active = true;
        this.paddle.setScale(this.paddleScaleDefault, this.paddleScaleDefault, 1);
        this.setPaddleLightsActive(false);
        this.isPaddleBreaking = false;
    }

    private setPaddleLightsActive(active: boolean) {
        const leftLight = this.paddle.getChildByName('LeftLight');
        const rightLight = this.paddle.getChildByName('RightLight');

        if (leftLight) {
            leftLight.active = active;
        }

        if (rightLight) {
            rightLight.active = active;
        }
    }

    private resetPaddleVisual() {
        const anim = this.paddle.getComponent(Animation);
        const sprite = this.paddle.getComponent(Sprite);
        const opacity = this.paddle.getComponent(UIOpacity);
        const ui = this.paddle.getComponent(UITransform);

        if (anim) {
            anim.stop();
        }

        if (sprite && this.normalPaddleFrame) {
            sprite.spriteFrame = this.normalPaddleFrame;
        }

        if (opacity) {
            Tween.stopAllByTarget(opacity);
            opacity.opacity = 255;
        }

        if (ui && this.normalPaddleContentWidth > 0 && this.normalPaddleContentHeight > 0) {
            ui.setContentSize(this.normalPaddleContentWidth, this.normalPaddleContentHeight);
        }

        this.paddle.active = true;
        this.paddle.setScale(this.paddleScaleDefault, this.paddleScaleDefault, 1);
        this.setPaddleLightsActive(true);

        this.isPaddleBreaking = false;
    }

    private playPaddleHitEffect() {
        if (this.isPaddleBreaking) return;

        this.paddle.setScale(this.paddleScaleDefault, this.paddleScaleDefault, 1);

        tween(this.paddle)
            .to(0.06, { scale: new Vec3(this.paddleScaleDefault * 1.12, this.paddleScaleDefault * 0.82, 1) })
            .to(0.08, { scale: new Vec3(this.paddleScaleDefault, this.paddleScaleDefault, 1) })
            .start();
    }

    private playBallHitEffect(targetBall: Node = this.ball) {
        if (!targetBall || !targetBall.isValid) return;

        const baseScale = this.isFireBallActive
            ? this.ballScaleDefault * 1.15
            : this.ballScaleDefault;

        targetBall.setScale(baseScale, baseScale, 1);

        tween(targetBall)
            .to(0.05, { scale: new Vec3(baseScale * 1.18, baseScale * 0.82, 1) })
            .to(0.08, { scale: new Vec3(baseScale, baseScale, 1) })
            .start();
    }

    private playBrickBreakEffect(brick: Node) {
        brick.setScale(1, 1, 1);

        tween(brick)
            .to(0.06, { scale: new Vec3(1.12, 1.12, 1) })
            .to(0.08, { scale: new Vec3(0, 0, 1) })
            .call(() => {
                if (brick && brick.isValid) {
                    brick.destroy();
                }
            })
            .start();
    }

    private playScorePopup(startPosition: Vec3) {
        const scoreNode = new Node('ScorePopup');

        scoreNode.setParent(this.gameArea);
        scoreNode.setPosition(startPosition.x, startPosition.y + 10, 0);

        const uiTransform = scoreNode.addComponent(UITransform);
        uiTransform.setContentSize(120, 50);

        const shadowNode = new Node('ScorePopupShadow');
        shadowNode.setParent(scoreNode);
        shadowNode.setPosition(2, -2, 0);

        const shadowUI = shadowNode.addComponent(UITransform);
        shadowUI.setContentSize(120, 50);

        const shadowLabel = shadowNode.addComponent(Label);
        shadowLabel.string = '+10';
        shadowLabel.fontSize = 32;
        shadowLabel.lineHeight = 36;
        shadowLabel.color = new Color(20, 10, 0, 220);

        const label = scoreNode.addComponent(Label);
        label.string = '+10';
        label.fontSize = 32;
        label.lineHeight = 36;
        label.color = new Color(255, 245, 120, 255);

        const opacity = scoreNode.addComponent(UIOpacity);
        opacity.opacity = 255;

        tween(scoreNode)
            .to(0.08, {
                scale: new Vec3(1.25, 1.25, 1),
            })
            .to(0.32, {
                position: new Vec3(startPosition.x, startPosition.y + 70, 0),
                scale: new Vec3(1, 1, 1),
            })
            .start();

        tween(opacity)
            .delay(0.08)
            .to(0.32, { opacity: 0 })
            .call(() => {
                if (scoreNode && scoreNode.isValid) {
                    scoreNode.destroy();
                }
            })
            .start();
    }

    private updateBallTrail(deltaTime: number) {
        if (!this.balls || this.balls.length <= 0) return;

        this.trailTimer += deltaTime;

        if (this.trailTimer < this.trailInterval) return;

        this.trailTimer = 0;

        for (const ball of this.balls) {
            if (!ball || !ball.isValid || !ball.active) continue;

            this.createBallTrail(ball);
        }
    }

    private createBallTrail(ball: Node = this.ball) {
        const ballSprite = ball.getComponent(Sprite);
        const ballUI = ball.getComponent(UITransform);

        if (!ballSprite || !ballSprite.spriteFrame || !ballUI) return;

        const trailNode = new Node('BallTrail');

        trailNode.setParent(this.gameArea);
        trailNode.setSiblingIndex(0);
        trailNode.setPosition(ball.position.x, ball.position.y, 0);
        trailNode.setScale(ball.scale.x, ball.scale.y, 1);

        const trailUI = trailNode.addComponent(UITransform);
        trailUI.setContentSize(ballUI.width, ballUI.height);

        const trailSprite = trailNode.addComponent(Sprite);
        trailSprite.spriteFrame = ballSprite.spriteFrame;
        trailSprite.color = new Color(120, 220, 255, 180);

        const opacity = trailNode.addComponent(UIOpacity);
        opacity.opacity = 150;

        tween(trailNode)
            .to(0.22, { scale: new Vec3(ball.scale.x * 0.45, ball.scale.y * 0.45, 1) })
            .start();

        tween(opacity)
            .to(0.22, { opacity: 0 })
            .call(() => {
                if (trailNode && trailNode.isValid) {
                    trailNode.destroy();
                }
            })
            .start();
    }

    private playScreenShake(intensity: number = 6, duration: number = 0.15) {
        Tween.stopAllByTarget(this.gameArea);

        const origin = this.gameAreaOriginPos.clone();

        const p1 = new Vec3(origin.x + intensity, origin.y + intensity * 0.5, origin.z);
        const p2 = new Vec3(origin.x - intensity, origin.y - intensity * 0.5, origin.z);
        const p3 = new Vec3(origin.x + intensity * 0.6, origin.y - intensity * 0.4, origin.z);
        const p4 = new Vec3(origin.x - intensity * 0.4, origin.y + intensity * 0.4, origin.z);

        const step = duration / 5;

        tween(this.gameArea)
            .to(step, { position: p1 })
            .to(step, { position: p2 })
            .to(step, { position: p3 })
            .to(step, { position: p4 })
            .to(step, { position: origin })
            .start();
    }

    private showResultPanel(title: string) {
        if (!this.resultPanel || !this.resultTitle || !this.finalScoreLabel) {
            if (this.startButton) {
                this.startButton.active = true;
            }
            return;
        }

        Tween.stopAllByTarget(this.resultPanel);

        this.resultPanel.active = true;
        this.resultPanel.setScale(0.85, 0.85, 1);

        this.resultTitle.string = title;
        this.finalScoreLabel.string = `${this.score}`;

        tween(this.resultPanel)
            .to(0.16, { scale: new Vec3(1.06, 1.06, 1) })
            .to(0.10, { scale: new Vec3(1, 1, 1) })
            .start();
    }

    private playSound(clip: AudioClip | null, volume: number = 1) {
        if (!this.audioSource || !clip) return;

        this.audioSource.playOneShot(clip, volume);
    }

    private trySpawnPowerUp(position: Vec3) {
        if (!this.powerUpPrefab) return;
        if (this.powerUps.length > 0) return;

        const chance = Math.random();

        // 30% tỉ lệ rơi power-up
        if (chance > 0.08) return;

        const powerUp = instantiate(this.powerUpPrefab);

        powerUp.setParent(this.gameArea);
        powerUp.setPosition(position.x, position.y, 0);

        // Nếu prefab không bật Play On Load, ép chạy animation xoay.
        const anim = powerUp.getComponent(Animation);
        if (anim) {
            anim.play();
        }

        const type = this.getRandomPowerUpType();

        const item = powerUp.getComponent(PowerUpItem);
        if (item) {
            item.powerUpType = type;
        }

        this.applyPowerUpAnimation(powerUp, type);
        this.powerUps.push(powerUp);
    }

    private getRandomPowerUpType(): string {
        const types = [
            PowerUpType.EXPAND,
            PowerUpType.MULTIBALL,
            PowerUpType.FIREBALL,
            PowerUpType.LASER,
        ];

        const randomIndex = Math.floor(Math.random() * types.length);

        return types[randomIndex];
    }

    private applyPowerUpAnimation(powerUp: Node, type: string) {
        const animation = powerUp.getComponent(Animation);

        if (!animation) return;

        let clip: AnimationClip | null = null;

        if (type === PowerUpType.EXPAND) {
            clip = this.expandPowerUpClip;
        } else if (type === PowerUpType.MULTIBALL) {
            clip = this.multiBallPowerUpClip;
        } else if (type === PowerUpType.FIREBALL) {
            clip = this.fireBallPowerUpClip;
        } else if (type === PowerUpType.LASER) {
            clip = this.laserPowerUpClip;
        }

        if (!clip) return;

        const state = animation.getState(clip.name);

        if (!state) {
            animation.createState(clip, clip.name);
        }

        animation.play(clip.name);
    }

    private updatePowerUps(deltaTime: number) {
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            const powerUp = this.powerUps[i];

            if (!powerUp || !powerUp.isValid) {
                this.powerUps.splice(i, 1);
                continue;
            }

            const pos = powerUp.position.clone();
            pos.y -= this.powerUpFallSpeed * deltaTime;
            powerUp.setPosition(pos);

            if (this.isRectHit(powerUp, this.paddle)) {
                this.powerUps.splice(i, 1);
                this.collectPowerUp(powerUp);
                continue;
            }

            const areaUI = this.gameArea.getComponent(UITransform)!;
            const bottom = -areaUI.height / 2 - 80;

            if (pos.y < bottom) {
                this.powerUps.splice(i, 1);
                powerUp.destroy();
            }
        }
    }

    private collectPowerUp(powerUp: Node) {
        if (!powerUp || !powerUp.isValid) return;

        const item = powerUp.getComponent(PowerUpItem);
        const type = item ? item.powerUpType : PowerUpType.EXPAND;

        powerUp.destroy();
        this.playSound(this.powerUpReceivedSound, 0.9);

        if (this.activePowerUpType && this.activePowerUpType !== type) {
            this.stopActivePowerUp();
        }

        if (type === PowerUpType.EXPAND) {
            this.extendPaddle();
        } else if (type === PowerUpType.MULTIBALL) {
            this.splitBallsToThree();
        } else if (type === PowerUpType.FIREBALL) {
            this.activateFireBall();
        } else if (type === PowerUpType.LASER) {
            this.activateLaser();
        }
    }

    private hasActivePowerUp(): boolean {
        return this.activePowerUpType !== null;
    }

    private stopActivePowerUp() {
        if (this.activePowerUpType === PowerUpType.EXPAND) {
            this.clearPaddleBuff();
        } else if (this.activePowerUpType === PowerUpType.FIREBALL) {
            this.deactivateFireBall();
        } else if (this.activePowerUpType === PowerUpType.LASER) {
            this.deactivateLaser();
        }

        this.activePowerUpType = null;
    }

    private extendPaddle() {
        this.activePowerUpType = PowerUpType.EXPAND;
        this.paddleBuffToken += 1;
        const token = this.paddleBuffToken;
        const wasExtended = this.isPaddleExtended;
        this.isPaddleExtended = true;
        this.animatePaddleWidthTo(this.extendedPaddleWidth, 0.18);

        // Chỉ pop hiệu ứng khi vừa chuyển từ normal -> extended.
        if (!wasExtended) {
            tween(this.paddle)
                .to(0.12, { scale: new Vec3(this.paddleScaleDefault * 1.08, this.paddleScaleDefault * 1.08, 1) })
                .to(0.10, { scale: new Vec3(this.paddleScaleDefault, this.paddleScaleDefault, 1) })
                .start();
        }

        // Mỗi lần nhặt mới sẽ tạo token mới -> timer cũ tự vô hiệu, luôn lấy lần nhặt cuối.
        this.scheduleOnce(() => {
            if (token !== this.paddleBuffToken) return;
            this.isPaddleExtended = false;
            if (this.activePowerUpType === PowerUpType.EXPAND) {
                this.activePowerUpType = null;
            }
            this.animatePaddleWidthTo(this.normalPaddleWidth, 0.24);
        }, 5);
    }

    private setPaddleWidth(width: number) {
        const paddleUI = this.paddle.getComponent(UITransform);

        if (!paddleUI) return;

        paddleUI.setContentSize(width, paddleUI.height);

        // Nếu đang đứng sát mép, nới rộng có thể bị lọt ra ngoài → clamp lại ngay.
        const areaUI = this.gameArea.getComponent(UITransform);
        if (!areaUI) return;

        const halfAreaWidth = areaUI.width / 2;
        const halfPaddleWidth = width / 2;

        const clampedX = this.clamp(
            this.paddle.position.x,
            -halfAreaWidth + halfPaddleWidth,
            halfAreaWidth - halfPaddleWidth
        );

        this.paddleTargetX = clampedX;
        this.paddle.setPosition(clampedX, this.paddle.position.y, 0);

        if (this.isBallOnPaddle) {
            this.attachBallToPaddle();
        }
    }

    private clearPowerUps() {
        for (const powerUp of this.powerUps) {
            if (powerUp && powerUp.isValid) {
                powerUp.destroy();
            }
        }

        this.powerUps = [];
    }

    private fadeOutAndClearPowerUps(duration: number = 0.35) {
        for (const powerUp of this.powerUps) {
            if (powerUp && powerUp.isValid) {
                this.fadeOutNode(powerUp, duration, true);
            }
        }

        this.powerUps = [];
    }

    private fadeOutNode(node: Node, duration: number = 0.35, destroyAfterFade: boolean = false) {
        if (!node || !node.isValid || !node.active) return;

        let opacity = node.getComponent(UIOpacity);
        if (!opacity) {
            opacity = node.addComponent(UIOpacity);
        }

        Tween.stopAllByTarget(opacity);
        opacity.opacity = 255;

        tween(opacity)
            .to(duration, { opacity: 0 })
            .call(() => {
                if (!node || !node.isValid) return;

                if (destroyAfterFade) {
                    node.destroy();
                    return;
                }

                node.active = false;
                opacity!.opacity = 255;
            })
            .start();
    }

    private clearPaddleBuff() {
        this.paddleBuffToken += 1;
        this.isPaddleExtended = false;
        if (this.activePowerUpType === PowerUpType.EXPAND) {
            this.activePowerUpType = null;
        }
        Tween.stopAllByTarget(this.paddle);
        this.paddle.setScale(this.paddleScaleDefault, this.paddleScaleDefault, 1);
        this.setPaddleWidth(this.normalPaddleWidth);
    }

    private forceCenterPaddleAndBall() {
        this.paddleTargetX = 0;
        this.paddle.setPosition(0, -340, 0);
        if (this.isBallOnPaddle) {
            this.attachBallToPaddle();
        }
    }

    private animatePaddleWidthTo(targetWidth: number, duration: number = 0.2) {
        const paddleUI = this.paddle.getComponent(UITransform);
        if (!paddleUI) return;

        const state = { width: paddleUI.width };
        Tween.stopAllByTarget(paddleUI);

        tween(state)
            .to(duration, { width: targetWidth }, {
                onUpdate: () => {
                    this.setPaddleWidth(state.width);
                },
            })
            .start();
    }

    private attachBallToPaddle() {
        const paddleUI = this.paddle.getComponent(UITransform);
        if (!paddleUI) return;

        const paddlePos = this.paddle.position;
        // Canh theo bán kính thực (đã scale) để bóng nằm sát trên paddle.
        const ballY = paddlePos.y + paddleUI.height / 2 + this.ballRadius;
        this.ball.setPosition(paddlePos.x, ballY, 0);
    }

    private updateBalls(deltaTime: number) {
        for (let i = this.balls.length - 1; i >= 0; i--) {
            const ball = this.balls[i];

            if (!ball || !ball.isValid) {
                this.balls.splice(i, 1);
                continue;
            }

            const velocity = this.ballVelocityMap.get(ball);

            if (!velocity) continue;

            const isAlive = this.simulateBallPhysics(deltaTime, ball, velocity, false);
            this.relaxBallSpeed(deltaTime, velocity);

            if (!isAlive) {
                this.handleBallLost(ball, i);
                if (this.isResettingLife) return;
            }
        }

        if (this.balls.length <= 0 && !this.isResettingLife) {
            this.loseLifeWithPaddleBreak();
        }
    }

    private handleBallLost(ball: Node, ballIndex: number) {
        if (this.isResettingLife) return;

        if (this.balls.length > 1) {
            this.removeBall(ball, ballIndex);
            return;
        }

        this.loseLifeWithPaddleBreak();
    }

    private removeBall(ball: Node, ballIndex: number) {
        this.balls.splice(ballIndex, 1);
        this.ballVelocityMap.delete(ball);
        Tween.stopAllByTarget(ball);

        if (ball === this.ball) {
            ball.active = false;
            if (this.activePowerUpType === PowerUpType.MULTIBALL && this.balls.length <= 1) {
                this.activePowerUpType = null;
            }
            return;
        }

        if (ball && ball.isValid) {
            ball.destroy();
        }

        if (this.activePowerUpType === PowerUpType.MULTIBALL && this.balls.length <= 1) {
            this.activePowerUpType = null;
        }
    }

    private clearMultiBallPowerUp() {
        let sourceBall: Node = this.ball;

        for (const candidate of this.balls) {
            if (candidate && candidate.isValid && candidate.active) {
                sourceBall = candidate;
                break;
            }
        }

        const sourcePosition = sourceBall.position.clone();
        const sourceVelocity = (this.ballVelocityMap.get(sourceBall) ?? this.ballVelocity).clone();

        for (const ball of this.balls) {
            if (ball && ball.isValid && ball !== this.ball) {
                Tween.stopAllByTarget(ball);
                ball.destroy();
            }
        }

        if (this.ball && this.ball.isValid) {
            Tween.stopAllByTarget(this.ball);
            this.ball.active = true;
            this.ball.setPosition(sourcePosition);
            this.ball.setScale(this.ballScaleDefault, this.ballScaleDefault, 1);
        }

        this.ballVelocity.set(sourceVelocity.x, sourceVelocity.y, sourceVelocity.z);
        this.balls = [this.ball];
        this.ballVelocityMap.clear();
        this.ballVelocityMap.set(this.ball, sourceVelocity);
    }

    private clearExtraBalls() {
        for (const ball of this.balls) {
            if (ball && ball.isValid && ball !== this.ball) {
                Tween.stopAllByTarget(ball);
                ball.destroy();
            }
        }

        this.balls = [];
        this.ballVelocityMap.clear();

        if (this.ball && this.ball.isValid) {
            Tween.stopAllByTarget(this.ball);
            this.ball.active = true;
            this.ball.setScale(this.ballScaleDefault, this.ballScaleDefault, 1);
        }

        if (this.activePowerUpType === PowerUpType.MULTIBALL) {
            this.activePowerUpType = null;
        }
    }

    private splitBallsToThree() {
        if (!this.ball || !this.ball.isValid) return;
        this.activePowerUpType = PowerUpType.MULTIBALL;

        let sourceBall: Node = this.ball;

        for (const candidate of this.balls) {
            if (candidate && candidate.isValid && candidate.active) {
                sourceBall = candidate;
                break;
            }
        }

        const startPos = sourceBall.position.clone();
        const sourceVelocity = this.ballVelocityMap.get(sourceBall) ?? this.ballVelocity;
        const currentSpeed = Math.sqrt(
            sourceVelocity.x * sourceVelocity.x +
            sourceVelocity.y * sourceVelocity.y
        );
        const speed = Math.max(this.cruiseBallSpeed, currentSpeed);
        const baseVelocity = currentSpeed > 0
            ? new Vec3(sourceVelocity.x / currentSpeed * speed, sourceVelocity.y / currentSpeed * speed, 0)
            : new Vec3(0, this.cruiseBallSpeed, 0);

        if (!this.balls.includes(sourceBall)) {
            this.balls.push(sourceBall);
        }

        const spreadAngle = 22 * Math.PI / 180;
        const leftVelocity = this.rotateVelocity(baseVelocity, -spreadAngle);
        const rightVelocity = this.rotateVelocity(baseVelocity, spreadAngle);

        this.spawnExtraBall(startPos, leftVelocity);
        this.spawnExtraBall(startPos, rightVelocity);

        this.playBallHitEffect(sourceBall);
    }

    private rotateVelocity(velocity: Vec3, angle: number): Vec3 {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        return new Vec3(
            velocity.x * cos - velocity.y * sin,
            velocity.x * sin + velocity.y * cos,
            0
        );
    }

    private spawnExtraBall(position: Vec3, velocity: Vec3) {
        const newBall = instantiate(this.ball);

        newBall.setParent(this.gameArea);
        newBall.setPosition(position.x, position.y, 0);
        newBall.setScale(this.ballScaleDefault, this.ballScaleDefault, 1);
        newBall.active = true;

        const opacity = newBall.getComponent(UIOpacity);
        if (opacity) {
            opacity.opacity = 255;
        }

        this.balls.push(newBall);
        this.ballVelocityMap.set(newBall, velocity);

        if (this.isFireBallActive) {
            this.applyFireBallVisualToBall(newBall, true);
        }
    }

    private setupNormalBrick(brick: Node) {
        this.brickHpMap.set(brick, 1);
        this.brickTypeMap.set(brick, 'normal');
    }

    private setupStoneBrick(brick: Node) {
        this.brickHpMap.set(brick, 3);
        this.brickTypeMap.set(brick, 'stone');

        const sprite = brick.getComponent(Sprite);

        if (sprite && this.stoneFullFrame) {
            sprite.spriteFrame = this.stoneFullFrame;
        }
    }

    private hitBrick(
        brick: Node,
        brickIndex: number,
        hitBall: Node = this.ball,
        forceBreak: boolean = false,
        playBallEffect: boolean = true
    ) {
        const brickPos = brick.position.clone();

        let hp = this.brickHpMap.get(brick) ?? 1;
        hp = forceBreak ? 0 : hp - 1;

        this.brickHpMap.set(brick, hp);

        if (playBallEffect) {
            this.playBallHitEffect(hitBall);
        }
        this.playScreenShake(3, 0.05);
        this.playSound(this.hitBrickSound, 0.8);

        if (hp > 0) {
            this.updateBrickDamageSprite(brick, hp);
            this.playBrickDamageEffect(brick);

            // Gạch đá bị đánh nhưng chưa vỡ thì chỉ cộng ít điểm
            this.addScore(5);

            return;
        }

        this.bricks.splice(brickIndex, 1);
        this.brickHpMap.delete(brick);
        this.brickTypeMap.delete(brick);

        this.playScorePopup(brickPos);
        this.trySpawnPowerUp(brickPos);
        this.playBrickBreakEffect(brick);

        this.addScore(10);
    }

    private updateBrickDamageSprite(brick: Node, hp: number) {
        const type = this.brickTypeMap.get(brick);

        if (type !== 'stone') return;

        const sprite = brick.getComponent(Sprite);

        if (!sprite) return;

        if (hp === 2 && this.stoneCrack1Frame) {
            sprite.spriteFrame = this.stoneCrack1Frame;
        } else if (hp === 1 && this.stoneCrack2Frame) {
            sprite.spriteFrame = this.stoneCrack2Frame;
        }
    }

    private playBrickDamageEffect(brick: Node) {
        brick.setScale(1, 1, 1);

        tween(brick)
            .to(0.05, { scale: new Vec3(1.08, 1.08, 1) })
            .to(0.07, { scale: new Vec3(1, 1, 1) })
            .start();
    }

    private activateFireBall() {
        this.activePowerUpType = PowerUpType.FIREBALL;
        this.isFireBallActive = true;
        this.fireBallToken += 1;
        const token = this.fireBallToken;

        this.applyFireBallVisual(true);

        tween(this.node)
            .delay(this.fireBallDuration)
            .call(() => {
                if (token !== this.fireBallToken) return;
                this.deactivateFireBall();
            })
            .start();
    }

    private deactivateFireBall() {
        this.fireBallToken += 1;
        this.isFireBallActive = false;

        if (this.activePowerUpType === PowerUpType.FIREBALL) {
            this.activePowerUpType = null;
        }

        this.applyFireBallVisual(false);
    }

    private applyFireBallVisual(active: boolean) {
        if (this.balls && this.balls.length > 0) {
            for (const ball of this.balls) {
                this.applyFireBallVisualToBall(ball, active);
            }
            return;
        }

        this.applyFireBallVisualToBall(this.ball, active);
    }

    private applyFireBallVisualToBall(ball: Node, active: boolean) {
        if (!ball || !ball.isValid) return;

        Tween.stopAllByTarget(ball);

        const sprite = ball.getComponent(Sprite);
        if (sprite) {
            sprite.color = active
                ? new Color(255, 120, 40, 255)
                : new Color(255, 255, 255, 255);
        }

        const scale = active
            ? this.ballScaleDefault * 1.15
            : this.ballScaleDefault;

        ball.setScale(scale, scale, 1);
    }

    private activateLaser() {
        this.activePowerUpType = PowerUpType.LASER;
        this.isLaserActive = true;
        this.laserShootTimer = this.laserFireInterval;
        this.laserToken += 1;
        const token = this.laserToken;

        tween(this.node)
            .delay(this.laserDuration)
            .call(() => {
                if (token !== this.laserToken) return;
                this.deactivateLaser();
            })
            .start();
    }

    private deactivateLaser() {
        this.laserToken += 1;
        this.isLaserActive = false;
        this.laserShootTimer = 0;

        if (this.activePowerUpType === PowerUpType.LASER) {
            this.activePowerUpType = null;
        }
    }

    private updateLaserSystem(deltaTime: number) {
        if (this.isLaserActive) {
            this.laserShootTimer += deltaTime;

            if (this.laserShootTimer >= this.laserFireInterval) {
                this.laserShootTimer = 0;
                this.shootLaserFromPaddle();
            }
        }

        this.updateLasers(deltaTime);
    }

    private shootLaserFromPaddle() {
        if (!this.laserPrefab) return;

        const paddleUI = this.paddle.getComponent(UITransform);
        if (!paddleUI) return;

        const paddlePos = this.paddle.position;
        const halfWidth = paddleUI.width / 2;

        const leftX = paddlePos.x - halfWidth + 18;
        const rightX = paddlePos.x + halfWidth - 18;
        const startY = paddlePos.y + 38;

        this.spawnLaser(leftX, startY);
        this.spawnLaser(rightX, startY);

        this.playSound(this.laserShotSound, 0.45);
    }

    private spawnLaser(x: number, y: number) {
        const laser = instantiate(this.laserPrefab);

        laser.setParent(this.gameArea);
        laser.setPosition(x, y, 0);
        laser.setScale(1, 1, 1);

        this.lasers.push(laser);

        tween(laser)
            .to(0.06, { scale: new Vec3(1.2, 1.2, 1) })
            .to(0.06, { scale: new Vec3(1, 1, 1) })
            .start();
    }

    private updateLasers(deltaTime: number) {
        for (let i = this.lasers.length - 1; i >= 0; i--) {
            const laser = this.lasers[i];

            if (!laser || !laser.isValid) {
                this.lasers.splice(i, 1);
                continue;
            }

            const pos = laser.position.clone();
            pos.y += this.laserSpeed * deltaTime;
            laser.setPosition(pos);

            if (this.checkLaserHitBrick(laser)) {
                this.removeLaser(laser, i);
                continue;
            }

            const areaUI = this.gameArea.getComponent(UITransform);
            const top = areaUI ? areaUI.height / 2 + 80 : 600;

            if (pos.y > top) {
                this.removeLaser(laser, i);
            }
        }
    }

    private checkLaserHitBrick(laser: Node): boolean {
        for (let i = this.bricks.length - 1; i >= 0; i--) {
            const brick = this.bricks[i];

            if (!brick || !brick.isValid) continue;

            if (this.isRectHit(laser, brick)) {
                this.hitBrick(brick, i, this.ball, false, false);
                return true;
            }
        }

        return false;
    }

    private removeLaser(laser: Node, index: number) {
        this.lasers.splice(index, 1);

        if (laser && laser.isValid) {
            Tween.stopAllByTarget(laser);
            laser.destroy();
        }
    }

    private clearLasers() {
        for (const laser of this.lasers) {
            if (laser && laser.isValid) {
                Tween.stopAllByTarget(laser);
                laser.destroy();
            }
        }

        this.lasers = [];
    }

    private resetNextObstacleSpawnTime() {
        const range = this.obstacleSpawnIntervalMax - this.obstacleSpawnIntervalMin;
        this.nextObstacleSpawnTime = this.obstacleSpawnIntervalMin + Math.random() * range;
    }

    private resolveObstacleGateRefs() {
        if (!this.gameArea || !this.gameArea.isValid) return;

        if (!this.topWall || !this.topWall.isValid) {
            const frame = this.findChildByName(this.gameArea, 'Frame');
            this.topWall = frame
                ? this.findChildByName(frame, 'TopWall')
                : this.findChildByName(this.gameArea, 'TopWall');
        }

        const validSpawnPoints = this.dropSpawnPoints
            ? this.dropSpawnPoints.filter((node) => node && node.isValid)
            : [];

        if (validSpawnPoints.length >= 2) {
            this.dropSpawnPoints = validSpawnPoints;
            return;
        }

        const left = this.findChildByName(this.gameArea, 'LeftGateSpawnPoint');
        const right = this.findChildByName(this.gameArea, 'RightGateSpawnPoint');

        if (left && right) {
            this.dropSpawnPoints = [left, right];
        }
    }

    private findChildByName(root: Node, name: string): Node | null {
        if (!root || !root.isValid) return null;

        if (root.name === name) return root;

        for (const child of root.children) {
            const found = this.findChildByName(child, name);

            if (found) return found;
        }

        return null;
    }

    private updateObstacleSystem(deltaTime: number) {
        this.obstacleSpawnTimer += deltaTime;

        if (
            this.obstacleSpawnTimer >= this.nextObstacleSpawnTime &&
            !this.isGateDropping
        ) {
            this.obstacleSpawnTimer = 0;
            this.resetNextObstacleSpawnTime();
            this.playRandomGateDropSequence();
        }

        this.updateObstacles(deltaTime);
    }

    private playRandomGateDropSequence() {
        this.resolveObstacleGateRefs();

        if (!this.obstaclePrefab) return;

        const gateIndex = Math.random() < 0.5 ? 0 : 1;

        this.playTopWallGateSequence(gateIndex);
    }

    private playTopWallGateSequence(gateIndex: number) {
        this.isGateDropping = true;

        let anim = this.topWall && this.topWall.isValid
            ? this.topWall.getComponent(Animation)
            : null;

        if (!anim && this.topWall && this.topWall.isValid) {
            anim = this.topWall.addComponent(Animation);
        }

        if (anim) {
            const clip = gateIndex === 0 ? this.topGateLeftClip : this.topGateRightClip;

            if (clip) {
                const stateName = gateIndex === 0
                    ? 'top_gate_open_close_left'
                    : 'top_gate_open_close_right';

                const state = anim.getState(stateName);

                if (!state) {
                    anim.createState(clip, stateName);
                }

                anim.play(stateName);
            }
        }

        this.scheduleOnce(() => {
            this.spawnObstacleFromGate(gateIndex);
        }, 0.24);

        this.scheduleOnce(() => {
            this.isGateDropping = false;
        }, 0.9);
    }

    private spawnObstacleFromGate(gateIndex: number) {
        if (!this.obstaclePrefab) return;
        if (!this.isPlaying || this.isResettingLife) return;

        this.resolveObstacleGateRefs();

        const spawnPoint = this.dropSpawnPoints[gateIndex];

        const obstacle = instantiate(this.obstaclePrefab);

        obstacle.setParent(this.gameArea);

        if (spawnPoint && spawnPoint.isValid) {
            obstacle.setPosition(spawnPoint.position.clone());
        } else {
            obstacle.setPosition(this.getGateDropPosition(gateIndex));
        }

        this.obstacles.push(obstacle);

        this.playSound(this.obstacleDropSound, 0.7);
    }

    private getGateDropPosition(gateIndex: number): Vec3 {
        const gateX = gateIndex === 0 ? -150 : 150;

        if (this.topWall && this.topWall.isValid) {
            const topWallPos = this.topWall.position;
            return new Vec3(topWallPos.x + gateX, topWallPos.y - 40, 0);
        }

        return new Vec3(gateX, 475, 0);
    }

    private updateObstacles(deltaTime: number) {
        const areaUI = this.gameArea.getComponent(UITransform);
        if (!areaUI) return;

        const leftLimit = -areaUI.width / 2 + 25;
        const rightLimit = areaUI.width / 2 - 25;
        const bottomLimit = -areaUI.height / 2 - 70;

        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obstacle = this.obstacles[i];

            if (!obstacle || !obstacle.isValid) {
                this.obstacles.splice(i, 1);
                continue;
            }

            const item = obstacle.getComponent(ObstacleItem);
            const fallSpeed = item ? Math.min(item.fallSpeed, 82) : 72;
            const chaseSpeed = item ? Math.min(item.chaseSpeed, 64) : 58;
            const avoidSpeed = item ? Math.min(item.avoidSpeed, 70) : 62;
            const chaseOffset = item ? item.chaseStartOffsetFromPaddle : 300;

            const oldPos = obstacle.position.clone();
            const newPos = oldPos.clone();
            const shouldChasePaddle = oldPos.y <= this.paddle.position.y + chaseOffset;

            if (shouldChasePaddle) {
                const diffX = this.paddle.position.x - oldPos.x;
                const maxMoveX = chaseSpeed * deltaTime;

                newPos.x += this.clamp(diffX, -maxMoveX, maxMoveX);
            }

            let currentFallSpeed = fallSpeed;

            if (item) {
                if (item.swaySeed === 0) {
                    item.swaySeed = Math.random() * Math.PI * 2;
                }

                item.swayTime += deltaTime;
                item.fallVelocity = Math.min(fallSpeed, item.fallVelocity + 38 * deltaTime);
                currentFallSpeed = item.fallVelocity;

                newPos.x += Math.sin(item.swayTime * 2.4 + item.swaySeed) * 18 * deltaTime;
                obstacle.angle = Math.sin(item.swayTime * 3.2 + item.swaySeed) * 4;
            }

            newPos.y -= currentFallSpeed * deltaTime;
            newPos.x = this.clamp(newPos.x, leftLimit, rightLimit);

            obstacle.setPosition(newPos);

            if (this.isObstacleTouchingAnyBrick(obstacle)) {
                if (item && item.avoidDir === 0) {
                    item.avoidDir = this.paddle.position.x >= oldPos.x ? 1 : -1;
                }

                const dir = item ? item.avoidDir : 1;
                const sideStep = avoidSpeed * deltaTime;
                const resolvedPos = this.findObstacleBrickAvoidPosition(
                    obstacle,
                    oldPos,
                    newPos,
                    dir,
                    sideStep,
                    currentFallSpeed * deltaTime,
                    leftLimit,
                    rightLimit
                );

                if (resolvedPos) {
                    if (item && resolvedPos.x < oldPos.x) {
                        item.avoidDir = -1;
                    } else if (item && resolvedPos.x > oldPos.x) {
                        item.avoidDir = 1;
                    }

                    obstacle.setPosition(resolvedPos);
                } else {
                    obstacle.setPosition(oldPos);
                }
            } else if (item) {
                item.avoidDir = 0;
            }

            if (this.checkObstacleHitBall(obstacle)) {
                this.removeObstacle(obstacle, i);
                continue;
            }

            if (this.isRectHit(obstacle, this.paddle)) {
                this.onObstacleHitPaddle(obstacle, i);
                continue;
            }

            if (obstacle.position.y < bottomLimit) {
                this.removeObstacle(obstacle, i);
            }
        }
    }

    private isObstacleTouchingAnyBrick(obstacle: Node): boolean {
        for (const brick of this.bricks) {
            if (!brick || !brick.isValid) continue;

            if (this.isRectHit(obstacle, brick)) {
                return true;
            }
        }

        return false;
    }

    private findObstacleBrickAvoidPosition(
        obstacle: Node,
        origin: Vec3,
        blockedPosition: Vec3,
        preferredDir: number,
        sideStep: number,
        fallStep: number,
        leftLimit: number,
        rightLimit: number
    ): Vec3 | null {
        const directions = [preferredDir, -preferredDir];
        const dropSteps = [fallStep * 0.2, 0, fallStep * 0.5];
        const minStep = Math.max(sideStep, 0.5);
        const maxStep = Math.max(sideStep, minStep);

        for (const drop of dropSteps) {
            for (const dir of directions) {
                for (let distance = minStep; distance <= maxStep; distance += minStep) {
                    const candidate = origin.clone();
                    candidate.x = this.clamp(origin.x + dir * distance, leftLimit, rightLimit);
                    candidate.y = origin.y - drop;

                    if (!this.isObstacleTouchingAnyBrickAt(obstacle, candidate)) {
                        return candidate;
                    }
                }
            }
        }

        const upStep = Math.max(fallStep, sideStep, 1);
        const maxUpStep = Math.max(upStep * 15, 150); // Cho phép leo lên cao hơn để thoát kẹt

        // Đi lên trên đến khi sang ngang được
        for (let height = upStep; height <= maxUpStep; height += upStep) {
            for (const dir of directions) {
                for (let distance = minStep; distance <= maxStep * 4; distance += minStep) {
                    const candidateDiag = origin.clone();
                    candidateDiag.y = origin.y + height;
                    candidateDiag.x = this.clamp(origin.x + dir * distance, leftLimit, rightLimit);

                    if (!this.isObstacleTouchingAnyBrickAt(obstacle, candidateDiag)) {
                        return candidateDiag;
                    }
                }
            }
        }

        return this.getObstaclePositionOutsideNearestBrick(
            obstacle,
            blockedPosition,
            preferredDir,
            leftLimit,
            rightLimit
        );
    }

    private getObstaclePositionOutsideNearestBrick(
        obstacle: Node,
        origin: Vec3,
        preferredDir: number,
        leftLimit: number,
        rightLimit: number
    ): Vec3 | null {
        const obstacleUI = obstacle.getComponent(UITransform);
        if (!obstacleUI) return null;

        const obstacleHalfW = obstacleUI.width * Math.abs(obstacle.scale.x) / 2;
        const obstacleHalfH = obstacleUI.height * Math.abs(obstacle.scale.y) / 2;
        let nearestBrick: Node | null = null;
        let nearestDistance = Number.POSITIVE_INFINITY;

        for (const brick of this.bricks) {
            if (!brick || !brick.isValid) continue;

            if (!this.isObstacleTouchingBrickAt(obstacle, brick, origin)) continue;

            const dx = Math.abs(origin.x - brick.position.x);
            const dy = Math.abs(origin.y - brick.position.y);
            const distance = dx + dy;

            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestBrick = brick;
            }
        }

        if (!nearestBrick) return null;

        const brickUI = nearestBrick.getComponent(UITransform);
        if (!brickUI) return null;

        const brickHalfW = brickUI.width * Math.abs(nearestBrick.scale.x) / 2;
        const brickHalfH = brickUI.height * Math.abs(nearestBrick.scale.y) / 2;
        const margin = 2;
        const candidates: Vec3[] = [];

        for (const dir of [preferredDir, -preferredDir]) {
            const x = dir > 0
                ? nearestBrick.position.x + brickHalfW + obstacleHalfW + margin
                : nearestBrick.position.x - brickHalfW - obstacleHalfW - margin;

            candidates.push(new Vec3(this.clamp(x, leftLimit, rightLimit), origin.y, 0));
        }

        candidates.push(new Vec3(
            origin.x,
            nearestBrick.position.y + brickHalfH + obstacleHalfH + margin,
            0
        ));

        for (const candidate of candidates) {
            if (!this.isObstacleTouchingAnyBrickAt(obstacle, candidate)) {
                return candidate;
            }
        }

        return null;
    }

    private isObstacleTouchingAnyBrickAt(obstacle: Node, position: Vec3): boolean {
        const originalPosition = obstacle.position.clone();

        obstacle.setPosition(position);
        const isTouching = this.isObstacleTouchingAnyBrick(obstacle);
        obstacle.setPosition(originalPosition);

        return isTouching;
    }

    private isObstacleTouchingBrickAt(obstacle: Node, brick: Node, position: Vec3): boolean {
        const originalPosition = obstacle.position.clone();

        obstacle.setPosition(position);
        const isTouching = this.isRectHit(obstacle, brick);
        obstacle.setPosition(originalPosition);

        return isTouching;
    }

    private checkObstacleHitBall(obstacle: Node): boolean {
        if (this.balls && this.balls.length > 0) {
            for (const ball of this.balls) {
                if (!ball || !ball.isValid || !ball.active) continue;

                if (this.isRectHit(ball, obstacle)) {
                    const velocity = this.ballVelocityMap.get(ball);

                    if (velocity) {
                        this.bounceBallFromObstacle(ball, obstacle, velocity);
                    }

                    return true;
                }
            }

            return false;
        }

        if (!this.ball || !this.ball.active) return false;

        if (!this.isRectHit(this.ball, obstacle)) return false;

        this.bounceBallFromObstacle(this.ball, obstacle, this.ballVelocity);

        return true;
    }

    private bounceBallFromObstacle(ball: Node, obstacle: Node, velocity: Vec3) {
        const ballPos = ball.position;
        const obstaclePos = obstacle.position;

        const diffX = ballPos.x - obstaclePos.x;
        const diffY = ballPos.y - obstaclePos.y;

        if (Math.abs(diffX) > Math.abs(diffY)) {
            velocity.x *= -1;
        } else {
            velocity.y *= -1;
        }

        velocity.x *= 1.01;
        velocity.y *= 1.01;
        this.ensureBallHasVerticalMotion(velocity, velocity.y);

        this.playBallHitEffect(ball);
        this.playScreenShake(4, 0.08);
        this.playSound(this.hitBrickSound, 0.65);
    }

    private onObstacleHitPaddle(obstacle: Node, index: number) {
        this.removeObstacle(obstacle, index);

        this.playPaddleHitEffect();
        this.playScreenShake(4, 0.08);
        this.playSound(this.hitPaddleSound, 0.7);
    }

    private removeObstacle(obstacle: Node, index: number) {
        this.obstacles.splice(index, 1);

        if (obstacle && obstacle.isValid) {
            Tween.stopAllByTarget(obstacle);
            obstacle.destroy();
        }
    }

    private clearObstacles() {
        for (const obstacle of this.obstacles) {
            if (obstacle && obstacle.isValid) {
                Tween.stopAllByTarget(obstacle);
                obstacle.destroy();
            }
        }

        this.obstacles = [];
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }
}
