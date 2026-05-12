import {
    _decorator,
    Component,
    Node,
    UITransform,
    UIOpacity,
    Vec3,
    tween,
    Tween,
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('BottomCenterPadEffect')
export class BottomCenterPadEffect extends Component {
    @property(Node)
    paddle: Node = null!;

    @property
    followPaddle: boolean = true;

    @property
    followSmoothSpeed: number = 12;

    @property
    maxMoveX: number = 250;

    @property
    enablePulse: boolean = true;

    @property
    pulseScale: number = 1.04;

    @property
    pulseDuration: number = 0.65;

    @property
    minOpacity: number = 180;

    @property
    maxOpacity: number = 255;

    private originY: number = 0;
    private opacity: UIOpacity | null = null;

    onLoad() {
        this.originY = this.node.position.y;

        this.opacity = this.node.getComponent(UIOpacity);

        if (!this.opacity) {
            this.opacity = this.node.addComponent(UIOpacity);
        }

        this.opacity.opacity = this.maxOpacity;

        if (this.enablePulse) {
            this.startPulseEffect();
        }
    }

    onDestroy() {
        Tween.stopAllByTarget(this.node);

        if (this.opacity) {
            Tween.stopAllByTarget(this.opacity);
        }
    }

    update(deltaTime: number) {
        if (!this.followPaddle || !this.paddle) return;

        this.followPaddleX(deltaTime);
    }

    private followPaddleX(deltaTime: number) {
        const currentPos = this.node.position;

        // Vì GameArea và BottomPanel đều đang nằm giữa Canvas,
        // lấy trực tiếp paddle.position.x là đủ cho project hiện tại.
        let targetX = this.paddle.position.x;

        targetX = this.clamp(targetX, -this.maxMoveX, this.maxMoveX);

        this.node.setPosition(targetX, this.originY, 0);
    }

    private startPulseEffect() {
        tween(this.node)
            .to(this.pulseDuration, { scale: new Vec3(this.pulseScale, this.pulseScale, 1) })
            .to(this.pulseDuration, { scale: new Vec3(1, 1, 1) })
            .union()
            .repeatForever()
            .start();

        if (this.opacity) {
            tween(this.opacity)
                .to(this.pulseDuration, { opacity: this.minOpacity })
                .to(this.pulseDuration, { opacity: this.maxOpacity })
                .union()
                .repeatForever()
                .start();
        }
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }
}
