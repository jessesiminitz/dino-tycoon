import Phaser from 'phaser';

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 6;

const TAP_SLOP_PX = 10;
const TAP_MAX_MS = 300;
const LONG_PRESS_MS = 450;

/**
 * Camera gestures for touch (and mouse, for desktop testing):
 * one-finger drag pans, pinch zooms around the fingers, mouse wheel zooms,
 * tap and long-press are emitted as world coordinates.
 *
 * Zoom settles on whole-number steps after a pinch so pixel art stays crisp.
 *
 * With `drawMode` on (fence tools), one finger draws instead of panning and
 * two fingers still pan/zoom. Right- or middle-mouse drag always pans (desktop).
 *
 * Events: 'tap' (worldX, worldY), 'longpress' (worldX, worldY),
 *         'drawstart' | 'drawmove' | 'drawend' (worldX, worldY), 'drawcancel'.
 */
export class TouchController extends Phaser.Events.EventEmitter {
  private cam: Phaser.Cameras.Scene2D.Camera;
  private downAt = 0;
  private downX = 0;
  private downY = 0;
  private moved = false;
  private multiTouch = false;
  private longPressTimer?: Phaser.Time.TimerEvent;
  private pinchDist = 0;
  private pinchZoom = 1;
  private zoomTween?: Phaser.Tweens.Tween;
  private drawing = false;
  private mousePan = false;
  drawMode = false;

  constructor(private scene: Phaser.Scene) {
    super();
    this.cam = scene.cameras.main;
    scene.input.addPointer(1); // two fingers total
    scene.input.mouse?.disableContextMenu(); // right-drag pans on desktop

    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);
    scene.input.on('wheel', this.onWheel, this);
  }

  /** Zoom so that world point under screen (sx, sy) stays under it. */
  zoomAt(zoom: number, sx: number, sy: number): void {
    const cam = this.cam;
    const z = Phaser.Math.Clamp(zoom, MIN_ZOOM, MAX_ZOOM);
    // Phaser cameras zoom around their centre:
    //   screen = (world - scroll - centre) * zoom + centre
    const cx = cam.width / 2;
    const cy = cam.height / 2;
    const wx = (sx - cx) / cam.zoom + cx + cam.scrollX;
    const wy = (sy - cy) / cam.zoom + cy + cam.scrollY;
    cam.setZoom(z);
    cam.setScroll(wx - cx - (sx - cx) / z, wy - cy - (sy - cy) / z);
  }

  private activePointers(): Phaser.Input.Pointer[] {
    return this.scene.input.manager.pointers.filter((p) => p.isDown);
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    this.zoomTween?.stop();
    const active = this.activePointers();

    if (active.length >= 2) {
      this.multiTouch = true;
      this.cancelLongPress();
      this.cancelDraw();
      const [a, b] = active;
      this.pinchDist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      this.pinchZoom = this.cam.zoom;
      return;
    }

    this.multiTouch = false;
    this.moved = false;
    this.downAt = pointer.downTime;
    this.downX = pointer.x;
    this.downY = pointer.y;
    this.mousePan = pointer.rightButtonDown() || pointer.middleButtonDown();

    if (this.drawMode && !this.mousePan) {
      this.drawing = true;
      this.emitWorld('drawstart', pointer);
      return;
    }

    this.longPressTimer = this.scene.time.delayedCall(LONG_PRESS_MS, () => {
      if (!this.moved && !this.multiTouch && pointer.isDown) {
        const w = this.cam.getWorldPoint(pointer.x, pointer.y);
        this.emit('longpress', w.x, w.y);
        this.moved = true; // suppress the tap on release
      }
    });
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (!pointer.isDown) return;
    const active = this.activePointers();

    if (active.length >= 2) {
      const [a, b] = active;
      const dist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      if (this.pinchDist > 0) {
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        // Pan by the midpoint's movement, then zoom around the midpoint.
        const prevMidX = (a.prevPosition.x + b.prevPosition.x) / 2;
        const prevMidY = (a.prevPosition.y + b.prevPosition.y) / 2;
        this.cam.scrollX -= (midX - prevMidX) / this.cam.zoom;
        this.cam.scrollY -= (midY - prevMidY) / this.cam.zoom;
        this.zoomAt(this.pinchZoom * (dist / this.pinchDist), midX, midY);
      }
      return;
    }

    if (this.multiTouch) return; // lifting one finger of a pinch shouldn't jump-pan

    if (this.drawing) {
      if (Phaser.Math.Distance.Between(pointer.x, pointer.y, this.downX, this.downY) > TAP_SLOP_PX) this.moved = true;
      this.emitWorld('drawmove', pointer);
      return;
    }

    if (!this.moved && Phaser.Math.Distance.Between(pointer.x, pointer.y, this.downX, this.downY) > TAP_SLOP_PX) {
      this.moved = true;
      this.cancelLongPress();
    }
    if (this.moved) {
      this.cam.scrollX -= (pointer.x - pointer.prevPosition.x) / this.cam.zoom;
      this.cam.scrollY -= (pointer.y - pointer.prevPosition.y) / this.cam.zoom;
    }
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    this.cancelLongPress();
    const remaining = this.activePointers().length;

    if (this.multiTouch) {
      if (remaining === 0) {
        this.multiTouch = false;
        this.settleZoom(pointer.x, pointer.y);
      } else {
        this.pinchDist = 0;
      }
      return;
    }

    if (this.drawing) {
      this.drawing = false;
      if (this.moved) {
        this.emitWorld('drawend', pointer);
        return;
      }
      this.emit('drawcancel');
    }

    if (!this.moved && !this.mousePan && pointer.upTime - this.downAt < TAP_MAX_MS) {
      this.emitWorld('tap', pointer);
    }
  }

  private emitWorld(event: string, pointer: Phaser.Input.Pointer): void {
    const w = this.cam.getWorldPoint(pointer.x, pointer.y);
    this.emit(event, w.x, w.y);
  }

  private cancelDraw(): void {
    if (!this.drawing) return;
    this.drawing = false;
    this.emit('drawcancel');
  }

  private onWheel(pointer: Phaser.Input.Pointer, _objs: unknown, _dx: number, dy: number): void {
    const target = Math.round(this.cam.zoom) + (dy > 0 ? -1 : 1);
    this.animateZoom(target, pointer.x, pointer.y);
  }

  private settleZoom(sx: number, sy: number): void {
    this.animateZoom(Math.round(this.cam.zoom), sx, sy);
  }

  private animateZoom(target: number, sx: number, sy: number): void {
    target = Phaser.Math.Clamp(target, MIN_ZOOM, MAX_ZOOM);
    this.zoomTween?.stop();
    const proxy = { z: this.cam.zoom };
    this.zoomTween = this.scene.tweens.add({
      targets: proxy,
      z: target,
      duration: 140,
      ease: 'Quad.easeOut',
      onUpdate: () => this.zoomAt(proxy.z, sx, sy),
    });
  }

  private cancelLongPress(): void {
    this.longPressTimer?.remove(false);
    this.longPressTimer = undefined;
  }
}
