import { _decorator, Component } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('PowerUpItem')
export class PowerUpItem extends Component {
    @property
    powerUpType: string = 'expand';
}
