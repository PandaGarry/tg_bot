import { describe, expect, it, vi } from "vitest";
import { Container } from "pixi.js";
import { destroyTileMap, drawTileMap, getTileChunkRanges, TILE_CHUNK_SIZE } from "../src/game/court/tileMap.js";

vi.mock("pixi.js", () => {
  class Container {
    children: Container[] = [];
    label = "";
    position = { x: 0, y: 0, set: (x: number, y: number) => { this.position.x = x; this.position.y = y; } };
    cached = false;
    cacheOptions: unknown;
    destroyed = false;
    addChild(child: Container) {
      this.children.push(child);
      return child;
    }
    removeChildren() {
      const children = [...this.children];
      this.children = [];
      return children;
    }
    cacheAsTexture(value: boolean | { resolution: number; antialias: boolean }) {
      this.cached = value !== false;
      if (typeof value !== "boolean") this.cacheOptions = value;
    }
    get isCachedAsTexture() {
      return this.cached;
    }
    destroy() {
      this.destroyed = true;
    }
  }
  class Graphics extends Container {
    polygons: number[][] = [];
    poly(points: number[]) { this.polygons.push(points); return this; }
    fill() { return this; }
    stroke() { return this; }
    moveTo() { return this; }
    lineTo() { return this; }
    ellipse() { return this; }
    clear() { return this; }
  }
  return { Container, Graphics };
});

describe("tile map chunks", () => {
  it("covers every cell exactly once, including partial edge chunks", () => {
    const ranges = getTileChunkRanges(40);
    const coverage = new Array(40 * 40).fill(0);
    for (const range of ranges) {
      expect(range.xEnd - range.xStart).toBeLessThanOrEqual(TILE_CHUNK_SIZE);
      expect(range.zEnd - range.zStart).toBeLessThanOrEqual(TILE_CHUNK_SIZE);
      for (let z = range.zStart; z < range.zEnd; z += 1) {
        for (let x = range.xStart; x < range.xEnd; x += 1) coverage[z * 40 + x] += 1;
      }
    }
    expect(ranges).toHaveLength(9);
    expect(coverage.every((count) => count === 1)).toBe(true);
    expect(ranges.some((range) => range.xEnd === 40 && range.zEnd === 40)).toBe(true);
  });

  it("rejects invalid dimensions", () => {
    expect(getTileChunkRanges(0)).toEqual([]);
    expect(getTileChunkRanges(10, 0)).toEqual([]);
    expect(getTileChunkRanges(2.5)).toEqual([]);
  });

  it("caches bounded chunks at no more than 2x resolution", () => {
    const ground = new Container();
    drawTileMap(ground, 40, 3);
    expect(ground.children).toHaveLength(10); // 9 chunks + the thin outer border
    const chunks = ground.children.slice(0, 9);
    expect(chunks.every((chunk) => chunk.isCachedAsTexture)).toBe(true);
    // Геометрия второго ряда/столбца остаётся локальной, а смещение живёт на Container.
    const secondChunk = chunks[1] as Container & { position: { x: number; y: number }; children: Array<{ polygons: number[][] }> };
    expect(secondChunk.position.x).not.toBe(0);
    expect(secondChunk.children[0]!.polygons[0]!.every((value) => Math.abs(value) < 16 * 72)).toBe(true);
    expect(chunks.every((chunk) => (chunk as Container & { cacheOptions: { resolution: number } }).cacheOptions.resolution === 2)).toBe(true);
    expect(ground.children[9]!.isCachedAsTexture).toBe(false);
  });

  it("disables cached textures before destroying chunks", () => {
    const ground = new Container();
    drawTileMap(ground, 17, 2);
    const chunks = ground.children.slice(0, 4);
    destroyTileMap(ground);
    expect(ground.children).toHaveLength(0);
    expect(chunks.every((chunk) => !chunk.isCachedAsTexture && (chunk as Container & { destroyed: boolean }).destroyed)).toBe(true);
  });
});
