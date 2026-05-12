import { _decorator, Component } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('ObstacleItem')
export class ObstacleItem extends Component {
    @property
    fallSpeed: number = 72;

    @property
    chaseSpeed: number = 58;

    @property
    avoidSpeed: number = 62;

    @property
    chaseStartOffsetFromPaddle: number = 300;

    avoidDir: number = 0;
    fallVelocity: number = 0;
    swayTime: number = 0;
    swaySeed: number = 0;
}
