// Keyboard input manager. Listens on window so focus never steals controls.

export interface InputSnapshot {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  brake: boolean;
  enter: boolean;
  restart: boolean;
}

const PREVENT = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "KeyE",
  "KeyR",
  "Space",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

export class Input {
  private keys = new Set<string>();
  private enterPressed = false;
  private restartPressed = false;

  private onKeyDown = (e: KeyboardEvent) => {
    if (PREVENT.has(e.code)) e.preventDefault();
    if (!e.repeat) {
      if (e.code === "KeyE") this.enterPressed = true;
      if (e.code === "KeyR") this.restartPressed = true;
    }
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onBlur = () => {
    this.keys.clear();
  };

  attach() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
  }

  detach() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
  }

  private has(...codes: string[]): boolean {
    return codes.some((c) => this.keys.has(c));
  }

  snapshot(): InputSnapshot {
    return {
      forward: this.has("KeyW", "ArrowUp"),
      back: this.has("KeyS", "ArrowDown"),
      left: this.has("KeyA", "ArrowLeft"),
      right: this.has("KeyD", "ArrowRight"),
      brake: this.has("Space"),
      enter: this.has("KeyE"),
      restart: this.has("KeyR"),
    };
  }

  consumeEnter(): boolean {
    const v = this.enterPressed;
    this.enterPressed = false;
    return v;
  }

  consumeRestart(): boolean {
    const v = this.restartPressed;
    this.restartPressed = false;
    return v;
  }
}
