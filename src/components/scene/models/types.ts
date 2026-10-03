import type { RefObject } from "react";

export type ModelProps = {
  phase: number;
  /** 興奮の度合い (0〜1)。突っつかれると上がり、ヒレの動きなどが速くなる */
  excite: RefObject<number>;
};
