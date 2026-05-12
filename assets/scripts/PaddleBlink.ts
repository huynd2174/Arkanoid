import {
    _decorator,
    Component,
    Node,
    UITransform,
    UIOpacity,
    tween,
    Tween,
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('PaddleBlink')
export class PaddleBlink extends Component {
    @property(Node)
    leftLight: Node = null!;

    @property(Node)
    rightLight: Node = null!;

    @property
    sideOffset: number = 2;

    @property
    blinkDuration: number = 0.45;

    @property
    minOpacity: number = 80;

    @property
    maxOpacity: number = 255;

    private leftOpacity: UIOpacity | null = null;
    private rightOpacity: UIOpacity | null = null;

    onLoad() {
        this.leftOpacity = this.prepareLight(this.leftLight);
        this.rightOpacity = this.prepareLight(this.rightLight);

        this.startBlink(this.leftOpacity);
        this.startBlink(this.rightOpacity);
    }

    onDestroy() {
        if (this.leftOpacity) {
            Tween.stopAllByTarget(this.leftOpacity);
        }

        if (this.rightOpacity) {
            Tween.stopAllByTarget(this.rightOpacity);
        }
    }

    update() {
        this.updateLightPosition();
    }

    private prepareLight(light: Node): UIOpacity | null {
        if (!light) return null;

        let opacity = light.getComponent(UIOpacity);

        if (!opacity) {
            opacity = light.addComponent(UIOpacity);
        }

        opacity.opacity = this.maxOpacity;

        return opacity;
    }

    private startBlink(opacity: UIOpacity | null) {
        if (!opacity) return;

        tween(opacity)
            .to(this.blinkDuration, { opacity: this.minOpacity })
            .to(this.blinkDuration, { opacity: this.maxOpacity })
            .union()
            .repeatForever()
            .start();
    }

    private updateLightPosition() {
        const paddleUI = this.node.getComponent(UITransform);

        if (!paddleUI) return;

        const halfWidth = paddleUI.width / 2;

        if (this.leftLight) {
            this.leftLight.setPosition(-halfWidth + this.sideOffset, 0, 0);
        }

        if (this.rightLight) {
            this.rightLight.setPosition(halfWidth - this.sideOffset, 0, 0);
        }
    }
}