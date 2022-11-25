import {Controller} from './breakout';

function main(): void {
  var canvas = document.getElementById("breakout") as HTMLCanvasElement;
  var controller = new Controller(canvas);
}
document.body.onload = main;
